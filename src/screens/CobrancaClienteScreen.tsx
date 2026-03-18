/**
 * CobrancaClienteScreen.tsx
 * Passo 3 — formulário de cobrança por produto (tabs por locação ativa)
 *
 * ✅ Saldo devedor anterior: carregado automaticamente e somado ao total
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

import { locacaoRepository }   from '../repositories/LocacaoRepository';
import { cobrancaRepository }  from '../repositories/CobrancaRepository';
import { cobrancaService }     from '../services/CobrancaService';
import { masks }               from '../utils/masks';
import { formatarMoeda }       from '../utils/currency';
import { Locacao }             from '../types';
import {
  CobrancasStackParamList,
  CobrancasStackNavigationProp,
  DadosCobrancaParam,
} from '../navigation/CobrancasStack';

type RoutePropType = RouteProp<CobrancasStackParamList, 'CobrancaCliente'>;

const FORMA_LABELS: Record<string, string> = {
  PercentualReceber: 'Percentual a Receber',
  PercentualPagar:   'Percentual a Pagar',
  Periodo:           'Período Fixo',
};

export default function CobrancaClienteScreen() {
  const route      = useRoute<RoutePropType>();
  const navigation = useNavigation<CobrancasStackNavigationProp>();
  const { clienteId, clienteNome } = route.params;

  const [locacoes,       setLocacoes]       = useState<Locacao[]>([]);
  const [tabAtiva,       setTabAtiva]       = useState(0);
  const [carregando,     setCarregando]     = useState(true);
  const [relogioAtual,   setRelogioAtual]   = useState('');
  const [valorRecebido,  setValorRecebido]  = useState('');
  const [observacao,     setObservacao]     = useState('');
  const [calculo,        setCalculo]        = useState<any>(null);
  const [erroRelogio,    setErroRelogio]    = useState('');
  // saldo devedor pendente por locação ativa (locacaoId → valor)
  const [saldosPendentes, setSaldosPendentes] = useState<Record<string, number>>({});
  // saldo devedor de locações finalizadas (produto já retirado)
  const [saldosFinalizados, setSaldosFinalizados] = useState<{
    locacaoId: string;
    produtoIdentificador: string;
    saldoPendente: number;
  }[]>([]);

  const tabRef = useRef(tabAtiva);

  // limpar form ao trocar tab
  useEffect(() => {
    if (tabRef.current !== tabAtiva) {
      tabRef.current = tabAtiva;
      setRelogioAtual('');
      setValorRecebido('');
      setObservacao('');
      setCalculo(null);
      setErroRelogio('');
    }
  }, [tabAtiva]);

  // carregar locações ativas + saldo devedor de cada uma
  useEffect(() => {
    setCarregando(true);
    locacaoRepository.getAtivasByCliente(clienteId)
      .then(async lista => {
        setLocacoes(lista);
        // Para cada locação, busca o saldo pendente
        const saldos: Record<string, number> = {};
        await Promise.all(
          lista.map(async loc => {
            const saldo = await cobrancaRepository.getSaldoPendenteByLocacao(String(loc.id));
            if (saldo > 0) saldos[String(loc.id)] = saldo;
          })
        );
        setSaldosPendentes(saldos);

        // Carrega saldos de locações finalizadas (produto retirado com débito)
        const finalizados = await cobrancaRepository.getSaldosPendentesFinalizados(clienteId);
        setSaldosFinalizados(finalizados);
      })
      .catch(() => setLocacoes([]))
      .finally(() => setCarregando(false));
  }, [clienteId]);

  const locacao = locacoes[tabAtiva] ?? null;
  const relogioAnterior = locacao
    ? (locacao.ultimaLeituraRelogio ?? parseInt(locacao.numeroRelogio || '0', 10))
    : 0;

  // saldo devedor pendente da locação ativa na tab
  const saldoAnterior = locacao ? (saldosPendentes[String(locacao.id)] ?? 0) : 0;

  // total real = total calculado + saldo anterior
  const totalComSaldo = calculo ? calculo.totalClientePaga + saldoAnterior : saldoAnterior;

  // recalcular em tempo real
  useEffect(() => {
    if (!locacao || !relogioAtual.trim()) { setCalculo(null); setErroRelogio(''); return; }
    const atual = parseInt(relogioAtual.replace(/\D/g, ''), 10);
    if (isNaN(atual)) { setCalculo(null); return; }
    if (atual < relogioAnterior) {
      setErroRelogio('Relógio atual não pode ser menor que o anterior');
      setCalculo(null); return;
    }
    setErroRelogio('');
    setCalculo(cobrancaService.calcularCobranca({
      relogioAnterior, relogioAtual: atual,
      valorFicha:         locacao.precoFicha || 0,
      percentualEmpresa:  locacao.percentualEmpresa || 0,
      descontoPartidasQtd: 0, descontoDinheiro: 0,
      formaPagamento:     locacao.formaPagamento,
    }));
  }, [relogioAtual, relogioAnterior, locacao]);

  const handleAvancar = useCallback(() => {
    if (!locacao)             { return; }
    if (!relogioAtual.trim()) { Alert.alert('Campo obrigatório', 'Informe o relógio atual'); return; }
    if (erroRelogio)          { Alert.alert('Valor inválido', erroRelogio); return; }
    if (!calculo)             { Alert.alert('Erro', 'Não foi possível calcular'); return; }

    const atual       = parseInt(relogioAtual.replace(/\D/g, ''), 10);
    const recebidoNum = parseFloat(valorRecebido.replace(',', '.')) || 0;

    const dados: DadosCobrancaParam = {
      locacaoId:             String(locacao.id),
      clienteId,
      clienteNome,
      produtoIdentificador:  locacao.produtoIdentificador,
      produtoTipo:           locacao.produtoTipo,
      formaPagamento:        locacao.formaPagamento,
      percentualEmpresa:     locacao.percentualEmpresa,
      precoFicha:            locacao.precoFicha,
      relogioAnterior,
      relogioAtual:          atual,
      fichasRodadas:         calculo.fichasRodadas,
      valorFicha:            locacao.precoFicha,
      totalBruto:            calculo.totalBruto,
      descontoPartidasQtd:   0,
      descontoPartidasValor: 0,
      descontoDinheiro:      0,
      subtotalAposDescontos: calculo.subtotalAposDescontoDinheiro,
      valorPercentual:       calculo.valorPercentual,
      totalClientePaga:      calculo.totalClientePaga,
      valorRecebido:         recebidoNum,
      dataInicio:            locacao.dataUltimaCobranca || locacao.dataLocacao || new Date().toISOString(),
      observacao,
      saldoAnterior,          // ✅ passa o saldo anterior para a tela de confirmação
    };
    navigation.navigate('ConfirmacaoPagamento', { dados });
  }, [locacao, relogioAtual, erroRelogio, calculo, valorRecebido, relogioAnterior,
      clienteId, clienteNome, observacao, saldoAnterior, navigation]);

  if (carregando) return <View style={s.center}><ActivityIndicator size="large" color="#1976D2" /></View>;
  if (locacoes.length === 0) return (
    <View style={s.center}>
      <Ionicons name="cube-outline" size={56} color="#E0E0E0" />
      <Text style={s.emptyText}>Nenhum produto ativo para este cliente</Text>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* ── TABS ──────────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.tabsContainer} contentContainerStyle={s.tabsScroll}>
        {locacoes.map((loc, idx) => {
          const temSaldo = (saldosPendentes[String(loc.id)] ?? 0) > 0;
          return (
            <TouchableOpacity key={String(loc.id)} style={s.tab} onPress={() => setTabAtiva(idx)}>
              <View style={s.tabLabelRow}>
                <Text style={[s.tabText, tabAtiva === idx && s.tabTextActive]}>
                  {loc.produtoTipo.toUpperCase()} N° {loc.produtoIdentificador}
                </Text>
                {temSaldo && <View style={s.tabSaldoBadge}><Text style={s.tabSaldoBadgeText}>$</Text></View>}
              </View>
              {tabAtiva === idx && <View style={s.tabLine} />}
            </TouchableOpacity>
          );
        })}
        {/* Tabs de saldo devedor de produtos já retirados */}
        {saldosFinalizados.map(sf => (
          <TouchableOpacity
            key={`fin_${sf.locacaoId}`}
            style={s.tab}
            onPress={() => navigation.navigate('QuitacaoSaldo', {
              locacaoId: sf.locacaoId,
              clienteId,
              clienteNome,
              produtoIdentificador: sf.produtoIdentificador,
            })}
          >
            <View style={s.tabLabelRow}>
              <Text style={[s.tabText, s.tabTextSaldo]}>
                SALDO N° {sf.produtoIdentificador}
              </Text>
              <View style={s.tabSaldoBadge}><Text style={s.tabSaldoBadgeText}>$</Text></View>
            </View>
            <View style={[s.tabLine, { backgroundColor: '#E53935' }]} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {locacao && (<>
            {/* ── status + histórico ──────────────────────────────── */}
            <View style={s.statusRow}>
              <Text style={s.statusPendente}>PENDENTE !</Text>
              <TouchableOpacity
                style={s.historicoBtn}
                onPress={() => navigation.navigate('HistoricoCobranca', {
                  clienteId,
                  produtoId: locacao.produtoIdentificador,
                })}
              >
                <Ionicons name="time-outline" size={15} color="#1976D2" />
                <Text style={s.historicoBtnText}>Histórico</Text>
              </TouchableOpacity>
            </View>

            {/* ── ALERTA SALDO DEVEDOR ANTERIOR ──────────────────── */}
            {saldoAnterior > 0 && (
              <View style={s.saldoAlert}>
                <Ionicons name="alert-circle" size={18} color="#E53935" />
                <View style={{ flex: 1 }}>
                  <Text style={s.saldoAlertTitle}>Saldo devedor anterior</Text>
                  <Text style={s.saldoAlertDesc}>
                    Este produto possui {formatarMoeda(saldoAnterior)} de cobranças anteriores não quitadas.
                    O valor será somado ao total desta cobrança.
                  </Text>
                </View>
                <Text style={s.saldoAlertValor}>{formatarMoeda(saldoAnterior)}</Text>
              </View>
            )}

            {/* ── CARD PRODUTO ────────────────────────────────────── */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="cube" size={20} color="#1976D2" />
                <Text style={s.cardTitle}>Produto</Text>
              </View>
              <View style={s.cardBody}>
                <View style={s.fieldRow}>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Produto</Text>
                    <Text style={s.fieldValue}>{locacao.produtoTipo} - {locacao.produtoIdentificador}</Text>
                  </View>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>CH</Text>
                    <Text style={s.fieldValue}>-</Text>
                  </View>
                </View>
                {locacao.observacao ? (
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Observação</Text>
                    <Text style={s.fieldValue}>{locacao.observacao}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ── CARD COBRANÇA ───────────────────────────────────── */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="cash" size={20} color="#1976D2" />
                <Text style={s.cardTitle}>Cobrança</Text>
              </View>
              <View style={s.cardBody}>
                <View style={s.fieldRow}>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Forma Pagamento</Text>
                    <Text style={s.fieldValue}>{FORMA_LABELS[locacao.formaPagamento] ?? locacao.formaPagamento}</Text>
                  </View>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Preço Ficha</Text>
                    <Text style={s.fieldValue}>R$ {locacao.precoFicha.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={s.fieldRow}>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Percentual Empresa</Text>
                    <Text style={s.fieldValue}>{locacao.percentualEmpresa.toFixed(1)}%</Text>
                  </View>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Relógio anterior</Text>
                    <Text style={s.fieldValue}>{relogioAnterior.toLocaleString('pt-BR')}</Text>
                  </View>
                </View>

                <View style={s.div} />

                {/* relógio atual */}
                <View style={s.inputGroup}>
                  <Text style={s.inputLabelBold}>RELÓGIO ATUAL</Text>
                  <TextInput
                    style={[s.inputLine, erroRelogio ? s.inputLineError : null]}
                    placeholder="___________" placeholderTextColor="#BDBDBD"
                    value={relogioAtual}
                    onChangeText={v => setRelogioAtual(masks.relogio(v))}
                    keyboardType="numeric"
                  />
                  {erroRelogio ? <Text style={s.inputError}>{erroRelogio}</Text> : null}
                </View>

                <View style={s.calcRow}>
                  <Text style={s.calcLabel}>FICHAS RODADAS</Text>
                  <Text style={s.calcValue}>{calculo ? calculo.fichasRodadas : 0}</Text>
                </View>
                <View style={s.calcRow}>
                  <Text style={s.calcLabelBold}>TOTAL BRUTO</Text>
                  <Text style={s.calcValue}>{formatarMoeda(calculo?.totalBruto ?? 0)}</Text>
                </View>
                <View style={s.calcRow}>
                  <Text style={s.calcLabel}>SUBTOTAL (%)</Text>
                  <Text style={s.calcValue}>{formatarMoeda(calculo?.subtotalAposDescontoDinheiro ?? 0)}</Text>
                </View>

                {/* linha de saldo anterior (quando existir) */}
                {saldoAnterior > 0 && (
                  <View style={[s.calcRow, s.calcRowSaldo]}>
                    <Text style={s.calcLabelSaldo}>+ SALDO ANTERIOR</Text>
                    <Text style={s.calcValueSaldo}>{formatarMoeda(saldoAnterior)}</Text>
                  </View>
                )}

                <View style={s.div} />

                <View style={s.calcRow}>
                  <Text style={s.totalLabel}>
                    TOTAL {saldoAnterior > 0 ? '(COM SALDO)' : '(CLIENTE PAGA)'}
                  </Text>
                  <Text style={[s.totalValue, saldoAnterior > 0 && s.totalValueComSaldo]}>
                    {formatarMoeda(totalComSaldo)}
                  </Text>
                </View>

                {/* valor recebido */}
                <View style={[s.inputGroup, { marginTop: 8 }]}>
                  <Text style={s.inputLabelBold}>VALOR RECEBIDO</Text>
                  <TextInput
                    style={s.inputLine} placeholder="R$ 0,00" placeholderTextColor="#BDBDBD"
                    value={valorRecebido} onChangeText={setValorRecebido} keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </>)}
          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── BOTÃO AVANÇAR ────────────────────────────────────────── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btnAvancar, (!calculo || !!erroRelogio) && s.btnDisabled]}
          onPress={handleAvancar} disabled={!calculo || !!erroRelogio} activeOpacity={0.85}
        >
          <Text style={s.btnAvancarText}>
            {saldoAnterior > 0 ? `AVANÇAR · ${formatarMoeda(totalComSaldo)}` : 'AVANÇAR'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F0F0' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText:    { fontSize: 15, color: '#9E9E9E', textAlign: 'center' },
  tabsContainer:{ maxHeight: 48, backgroundColor: '#FFFFFF' },
  tabsScroll:   { paddingHorizontal: 4 },
  tab:          { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, alignItems: 'center' },
  tabLabelRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText:      { fontSize: 13, fontWeight: '600', color: '#9E9E9E', letterSpacing: 0.5 },
  tabTextActive:{ color: '#1E293B' },
  tabTextSaldo: { color: '#E53935' },
  tabSaldoBadge:{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#E53935', justifyContent: 'center', alignItems: 'center' },
  tabSaldoBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  tabLine:      { height: 3, backgroundColor: '#FF6D00', borderRadius: 2, width: '100%', marginTop: 4 },

  scroll:       { flex: 1 },
  scrollContent:{ padding: 12 },

  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
  statusPendente:{ fontSize: 14, fontWeight: '700', color: '#FF6D00' },
  historicoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF', borderRadius: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  historicoBtnText: { fontSize: 12, fontWeight: '700', color: '#1976D2' },

  // alerta saldo anterior
  saldoAlert:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF3E0', borderRadius: 8, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#E53935' },
  saldoAlertTitle:{ fontSize: 12, fontWeight: '700', color: '#E53935', marginBottom: 2 },
  saldoAlertDesc: { fontSize: 11, color: '#D32F2F', lineHeight: 16 },
  saldoAlertValor:{ fontSize: 15, fontWeight: '800', color: '#E53935', alignSelf: 'center' },

  card:         { backgroundColor: '#FFFFFF', borderRadius: 4, marginBottom: 12, elevation: 1 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  cardTitle:    { fontSize: 15, fontWeight: '600', color: '#1976D2' },
  cardBody:     { padding: 16, gap: 12 },
  fieldRow:     { flexDirection: 'row', gap: 16 },
  fieldBlock:   { flex: 1 },
  fieldLabel:   { fontSize: 11, color: '#9E9E9E', marginBottom: 2 },
  fieldValue:   { fontSize: 14, color: '#212121' },
  div:          { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  inputGroup:   { marginTop: 4 },
  inputLabelBold:{ fontSize: 12, fontWeight: '700', color: '#424242', letterSpacing: 0.3 },
  inputLine:    { borderBottomWidth: 1, borderBottomColor: '#9E9E9E', fontSize: 16, color: '#212121', paddingVertical: 6, marginTop: 2 },
  inputLineError:{ borderBottomColor: '#E53935' },
  inputError:   { fontSize: 11, color: '#E53935', marginTop: 4 },
  calcRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  calcRowSaldo: { backgroundColor: '#FFF3E0', marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 4 },
  calcLabel:    { fontSize: 13, color: '#616161' },
  calcLabelBold:{ fontSize: 13, color: '#212121', fontWeight: '700' },
  calcLabelSaldo:{ fontSize: 12, fontWeight: '700', color: '#E53935' },
  calcValue:    { fontSize: 13, color: '#212121', textAlign: 'right' },
  calcValueSaldo:{ fontSize: 13, fontWeight: '700', color: '#E53935' },
  totalLabel:   { fontSize: 14, fontWeight: '700', color: '#212121' },
  totalValue:   { fontSize: 16, fontWeight: '700', color: '#1976D2' },
  totalValueComSaldo: { color: '#E53935' },
  footer:       { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  btnAvancar:   { backgroundColor: '#1565C0', borderRadius: 6, padding: 16, alignItems: 'center' },
  btnDisabled:  { backgroundColor: '#BDBDBD' },
  btnAvancarText:{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
});
