/**
 * CobrancaClienteScreen.tsx
 * Passo 3 — formulário de cobrança por produto (tabs por locação ativa)
 *
 * Suporta 3 formas de pagamento:
 * - PercentualReceber: empresa recebe X% — cliente PAGA
 * - PercentualPagar:   empresa paga X% ao cliente — empresa PAGA ao cliente (+ bonificação)
 * - Periodo:           valor fixo mensal/semanal/etc — inclui saldo devedor
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

export default function CobrancaClienteScreen() {
  const route      = useRoute<RoutePropType>();
  const navigation = useNavigation<CobrancasStackNavigationProp>();
  const { clienteId, clienteNome } = route.params;

  const [locacoes,       setLocacoes]       = useState<Locacao[]>([]);
  const [tabAtiva,       setTabAtiva]       = useState(0);
  const [carregando,     setCarregando]     = useState(true);

  // campos do formulário
  const [relogioAtual,     setRelogioAtual]     = useState('');
  const [descontoPartidas, setDescontoPartidas] = useState('');
  const [descontoDinheiro, setDescontoDinheiro] = useState('');
  const [bonificacao,      setBonificacao]      = useState('');
  const [valorRecebido,    setValorRecebido]    = useState('');
  const [observacao,       setObservacao]       = useState('');
  const [incluirPeriodo,   setIncluirPeriodo]   = useState(false);

  const [calculo,        setCalculo]        = useState<any>(null);
  const [erroRelogio,    setErroRelogio]    = useState('');
  const [showDescontos,  setShowDescontos]  = useState(false);
  const [trocaPano,      setTrocaPano]      = useState(false);

  const [saldosPendentes, setSaldosPendentes] = useState<Record<string, number>>({});
  const [saldosFinalizados, setSaldosFinalizados] = useState<{
    locacaoId: string; produtoIdentificador: string; saldoPendente: number;
  }[]>([]);

  const tabRef = useRef(tabAtiva);

  // limpar form ao trocar tab
  useEffect(() => {
    if (tabRef.current !== tabAtiva) {
      tabRef.current = tabAtiva;
      setRelogioAtual(''); setDescontoPartidas(''); setDescontoDinheiro('');
      setBonificacao('');  setValorRecebido('');   setObservacao('');
      setCalculo(null);    setErroRelogio('');      setIncluirPeriodo(false);
      setTrocaPano(false); setShowDescontos(false);
    }
  }, [tabAtiva]);

  // carregar locações ativas + saldos
  useEffect(() => {
    setCarregando(true);
    locacaoRepository.getAtivasByCliente(clienteId)
      .then(async lista => {
        setLocacoes(lista);
        const saldos: Record<string, number> = {};
        await Promise.all(lista.map(async loc => {
          const saldo = await cobrancaRepository.getSaldoPendenteByLocacao(String(loc.id));
          if (saldo > 0) saldos[String(loc.id)] = saldo;
        }));
        setSaldosPendentes(saldos);
        const finalizados = await cobrancaRepository.getSaldosPendentesFinalizados(clienteId);
        setSaldosFinalizados(finalizados);
      })
      .catch(() => setLocacoes([]))
      .finally(() => setCarregando(false));
  }, [clienteId]);

  const locacao = locacoes[tabAtiva] ?? null;
  const forma   = locacao?.formaPagamento ?? 'PercentualReceber';
  const isPagar    = forma === 'PercentualPagar';
  const isReceber  = forma === 'PercentualReceber';
  const isPeriodo  = forma === 'Periodo';

  // Relógio anterior vem do Produto (via locação):
  // 1. Se houver ultimaLeituraRelogio na locação, usa esse valor (foi atualizado na última cobrança)
  // 2. Senão, usa o numeroRelogio da locação (que é o relógio do produto no momento da locação)
  const relogioAnterior = locacao
    ? (locacao.ultimaLeituraRelogio ?? parseInt(locacao.numeroRelogio || '0', 10))
    : 0;

  const saldoAnterior = locacao ? (saldosPendentes[String(locacao.id)] ?? 0) : 0;

  // ── cálculo em tempo real (apenas % modes) ─────────────────────────────
  useEffect(() => {
    if (!locacao) { setCalculo(null); setErroRelogio(''); return; }
    if (isPeriodo) {
      // Período: registrar relógio se informado, mas não bloquear
      if (relogioAtual.trim()) {
        const atualP = parseInt(relogioAtual.replace(/\D/g, ''), 10);
        if (!isNaN(atualP) && atualP < relogioAnterior) {
          setErroRelogio('Relógio atual não pode ser menor que o anterior');
        } else {
          setErroRelogio('');
        }
      } else {
        setErroRelogio('');
      }
      setCalculo(null); return;
    }
    if (!relogioAtual.trim()) { setCalculo(null); setErroRelogio(''); return; }
    const atual = parseInt(relogioAtual.replace(/\D/g, ''), 10);
    if (isNaN(atual)) { setCalculo(null); return; }
    if (atual < relogioAnterior) {
      setErroRelogio('Relógio atual não pode ser menor que o anterior');
      setCalculo(null); return;
    }
    setErroRelogio('');
    setCalculo(cobrancaService.calcularCobranca({
      relogioAnterior,
      relogioAtual:        atual,
      valorFicha:          locacao.precoFicha || 0,
      percentualEmpresa:   locacao.percentualEmpresa || 0,
      descontoPartidasQtd: parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0,
      descontoDinheiro:    parseFloat(descontoDinheiro.replace(',', '.')) || 0,
      bonificacao:         parseFloat(bonificacao.replace(',', '.')) || 0,
      formaPagamento:      forma,
    }));
  }, [relogioAtual, descontoPartidas, descontoDinheiro, bonificacao, relogioAnterior, locacao, forma, isPeriodo]);

  // ── total para modo período ────────────────────────────────────────────
  const valorPeriodo = locacao?.valorFixo ?? 0;
  const totalPeriodo = isPeriodo
    ? saldoAnterior + (incluirPeriodo ? valorPeriodo : 0)
    : 0;
    
  // Debug log
  useEffect(() => {
    if (isPeriodo && locacao) {
      console.log('[CobrancaClienteScreen] Modo Período:', {
        valorFixo: locacao.valorFixo,
        valorPeriodo,
        saldoAnterior,
        totalPeriodo,
        incluirPeriodo
      });
    }
  }, [isPeriodo, locacao, valorPeriodo, saldoAnterior, totalPeriodo, incluirPeriodo]);

  // ── antes do vencimento? ───────────────────────────────────────────────
  const antesVencimento = isPeriodo && locacao?.dataPrimeiraCobranca
    ? new Date(locacao.dataPrimeiraCobranca) > new Date()
    : false;

  // ── total exibido ──────────────────────────────────────────────────────
  const totalExibido = isPeriodo
    ? totalPeriodo
    : calculo
      ? (isPagar ? calculo.totalClientePaga : calculo.totalClientePaga + saldoAnterior)
      : (isReceber ? saldoAnterior : 0);

  const podeAvancar = isPeriodo
    ? (totalPeriodo > 0 || valorPeriodo > 0) && !erroRelogio
    : !!calculo && !erroRelogio;

  // ── avançar ────────────────────────────────────────────────────────────
  const handleAvancar = useCallback(() => {
    if (!locacao) return;
    if (!isPeriodo && !relogioAtual.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o relógio atual'); return;
    }
    if (erroRelogio) { Alert.alert('Valor inválido', erroRelogio); return; }
    if (!podeAvancar) { Alert.alert('Erro', 'Preencha os dados'); return; }

    const atual       = parseInt(relogioAtual.replace(/\D/g, ''), 10) || 0;
    const recebidoNum = parseFloat(valorRecebido.replace(',', '.')) || 0;

    const dados: DadosCobrancaParam = {
      locacaoId:             String(locacao.id),
      clienteId,
      clienteNome,
      produtoIdentificador:  locacao.produtoIdentificador,
      produtoTipo:           locacao.produtoTipo,
      formaPagamento:        forma,
      percentualEmpresa:     locacao.percentualEmpresa,
      precoFicha:            locacao.precoFicha,
      relogioAnterior,
      relogioAtual:          atual,
      fichasRodadas:         calculo?.fichasRodadas ?? (atual > 0 && relogioAnterior > 0 ? Math.max(0, atual - relogioAnterior) : 0),
      valorFicha:            locacao.precoFicha,
      totalBruto:            calculo?.totalBruto ?? 0,
      descontoPartidasQtd:   parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0,
      descontoPartidasValor: calculo?.descontoPartidasValor ?? 0,
      descontoDinheiro:      parseFloat(descontoDinheiro.replace(',', '.')) || 0,
      subtotalAposDescontos: calculo?.subtotalAposDescontoDinheiro ?? 0,
      valorPercentual:       calculo?.valorPercentual ?? 0,
      totalClientePaga:      isPeriodo ? totalPeriodo : (calculo?.totalClientePaga ?? 0),
      valorRecebido:         recebidoNum,
      dataInicio:            locacao.dataUltimaCobranca || locacao.dataLocacao || new Date().toISOString(),
      observacao,
      saldoAnterior:         isPeriodo ? saldoAnterior : (isReceber ? saldoAnterior : 0),
      bonificacao:           parseFloat(bonificacao.replace(',', '.')) || 0,
      incluirPeriodo,
      valorPeriodo,
      trocaPano,
    };
    navigation.navigate('ConfirmacaoPagamento', { dados });
  }, [locacao, isPeriodo, isReceber, isPagar, relogioAtual, erroRelogio, podeAvancar,
      calculo, valorRecebido, relogioAnterior, clienteId, clienteNome, observacao,
      saldoAnterior, bonificacao, descontoPartidas, descontoDinheiro,
      forma, totalPeriodo, incluirPeriodo, valorPeriodo, navigation]);

  if (carregando) return <View style={s.center}><ActivityIndicator size="large" color="#1976D2" /></View>;
  if (locacoes.length === 0) return (
    <View style={s.center}>
      <Ionicons name="cube-outline" size={56} color="#E0E0E0" />
      <Text style={s.emptyText}>Nenhum produto ativo para este cliente</Text>
    </View>
  );

  const labelTotal  = isPagar ? 'TOTAL (CLIENTE RECEBE)' : 'TOTAL (CLIENTE PAGA)';
  const labelValor  = isPagar ? 'VALOR PAGO' : 'VALOR RECEBIDO';

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* ── TABS ─────────────────────────────────────────────────── */}
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
        {saldosFinalizados.map(sf => (
          <TouchableOpacity key={`fin_${sf.locacaoId}`} style={s.tab}
            onPress={() => navigation.navigate('QuitacaoSaldo', {
              locacaoId: sf.locacaoId, clienteId, clienteNome,
              produtoIdentificador: sf.produtoIdentificador,
            })}>
            <View style={s.tabLabelRow}>
              <Text style={[s.tabText, s.tabTextSaldo]}>SALDO N° {sf.produtoIdentificador}</Text>
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
            {/* status + histórico */}
            <View style={s.statusRow}>
              <Text style={s.statusPendente}>PENDENTE !</Text>
              <View style={s.statusRight}>
                <TouchableOpacity style={s.historicoBtn}
                  onPress={() => navigation.navigate('HistoricoCobranca', {
                    clienteId, produtoId: locacao.produtoIdentificador,
                  })}>
                  <Ionicons name="time-outline" size={15} color="#1976D2" />
                  <Text style={s.historicoBtnText}>Histórico</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── CARD PRODUTO ─────────────────────────────────── */}
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
                </View>
                {/* Mostrar Relógio Anterior (do Produto) - sempre visível */}
                <View style={s.fieldRow}>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Relógio Anterior</Text>
                    <Text style={[s.fieldValue, s.fieldValueHighlight]}>{relogioAnterior > 0 ? relogioAnterior.toLocaleString('pt-BR') : '-'}</Text>
                  </View>
                </View>
                {locacao.observacao ? (
                  <Text style={s.fieldLabel}>{locacao.observacao}</Text>
                ) : null}
              </View>
            </View>

            {/* ── CARD COBRANÇA ────────────────────────────────── */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="cash" size={20} color="#1976D2" />
                <Text style={s.cardTitle}>Cobrança</Text>
              </View>
              <View style={s.cardBody}>
                {/* info da locação */}
                <View style={s.fieldRow}>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Forma Pagamento</Text>
                    <Text style={s.fieldValue}>
                      {isPagar ? 'Percentual a Pagar' : isReceber ? 'Percentual a Receber' :
                        locacao.periodicidade || 'Período Fixo'}
                    </Text>
                  </View>
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>{isPeriodo ? 'Valor Período' : 'Preço Ficha'}</Text>
                    <Text style={s.fieldValue}>
                      {isPeriodo ? formatarMoeda(valorPeriodo) : `R$ ${locacao.precoFicha.toFixed(2)}`}
                    </Text>
                  </View>
                </View>
                {!isPeriodo && (
                  <View style={s.fieldRow}>
                    <View style={s.fieldBlock}>
                      <Text style={s.fieldLabel}>Percentual Empresa</Text>
                      <Text style={s.fieldValue}>{locacao.percentualEmpresa.toFixed(1)}%</Text>
                    </View>
                  </View>
                )}
                {isPeriodo && locacao.dataPrimeiraCobranca && (
                  <View style={s.fieldBlock}>
                    <Text style={s.fieldLabel}>Data de vencimento</Text>
                    <Text style={s.fieldValue}>
                      {new Date(locacao.dataPrimeiraCobranca).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                )}

                <View style={s.div} />

                {/* ── MODO PERÍODO ─────────────────────────────── */}
                {isPeriodo ? (<>
                  {saldoAnterior > 0 && (<>
                    <View style={s.calcRow}>
                      <Text style={[s.calcLabelBold, { color: '#E53935' }]}>SALDO DEVEDOR</Text>
                      <Text style={[s.calcValue, { color: '#E53935', fontWeight: '700' }]}>
                        {formatarMoeda(saldoAnterior)}
                      </Text>
                    </View>
                    <View style={s.calcRow}>
                      <Text style={s.calcLabel}>SUBTOTAL</Text>
                      <Text style={s.calcValue}>{formatarMoeda(saldoAnterior)}</Text>
                    </View>
                  </>)}

                  {/* Incluir período */}
                  {antesVencimento && !incluirPeriodo ? (
                    <View style={s.notaBox}>
                      <Text style={s.notaText}>
                        *Valor do período não incluso devido a cobrança estar sendo cobrada antes do vencimento.
                        Para cobrar o próximo período clique em Atualizar.
                      </Text>
                      <TouchableOpacity style={s.btnAtualizar} onPress={() => setIncluirPeriodo(true)}>
                        <Text style={s.btnAtualizarText}>ATUALIZAR</Text>
                      </TouchableOpacity>
                    </View>
                  ) : incluirPeriodo ? (
                    <View style={s.calcRow}>
                      <Text style={s.calcLabel}>+ PERÍODO ({locacao.periodicidade})</Text>
                      <Text style={s.calcValue}>{formatarMoeda(valorPeriodo)}</Text>
                    </View>
                  ) : valorPeriodo > 0 && !antesVencimento ? (
                    <View style={s.calcRow}>
                      <Text style={s.calcLabel}>PERÍODO ({locacao.periodicidade})</Text>
                      <Text style={s.calcValue}>{formatarMoeda(valorPeriodo)}</Text>
                    </View>
                  ) : null}

                  <View style={s.div} />
                  <View style={s.calcRow}>
                    <Text style={s.totalLabel}>TOTAL (CLIENTE PAGA)</Text>
                    <Text style={s.totalValue}>
                      {formatarMoeda(totalPeriodo)}
                      {antesVencimento && !incluirPeriodo ? '*' : ''}
                    </Text>
                  </View>

                  {/* Relógio atual — informativo no modo período */}
                  <View style={s.div} />
                  <View style={s.inputGroup}>
                    <Text style={[s.inputLabelBold, { color: '#9E9E9E' }]}>
                      RELÓGIO ATUAL (OPCIONAL — APENAS INFORMATIVO)
                    </Text>
                    <TextInput
                      style={[s.inputLine, erroRelogio ? s.inputLineError : null]}
                      placeholder="___________" placeholderTextColor="#BDBDBD"
                      value={relogioAtual}
                      onChangeText={v => setRelogioAtual(masks.relogio(v))}
                      keyboardType="numeric"
                    />
                    {erroRelogio ? <Text style={s.inputError}>{erroRelogio}</Text> : null}
                    {relogioAtual.trim() && !erroRelogio && (() => {
                      const a = parseInt(relogioAtual.replace(/\D/g, ''), 10);
                      const fichas = isNaN(a) ? 0 : Math.max(0, a - relogioAnterior);
                      return fichas > 0
                        ? <Text style={[s.calcLabel, { marginTop: 4 }]}>{fichas} fichas rodadas</Text>
                        : null;
                    })()}
                  </View>
                </>) : (<>
                  {/* ── MODO % ──────────────────────────────────── */}
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

                  {calculo && (<>
                    <View style={s.calcRow}>
                      <Text style={s.calcLabel}>FICHAS RODADAS</Text>
                      <Text style={s.calcValue}>{calculo.fichasRodadas}</Text>
                    </View>
                    <View style={s.calcRow}>
                      <Text style={s.calcLabelBold}>TOTAL BRUTO</Text>
                      <Text style={s.calcValue}>{formatarMoeda(calculo.totalBruto)}</Text>
                    </View>
                  </>)}

                  {/* Botão de opções (descontos/bonificação) */}
                  <TouchableOpacity
                    style={s.btnOpcoes}
                    onPress={() => setShowDescontos(v => !v)}
                  >
                    <Ionicons
                      name={showDescontos ? 'remove-circle-outline' : 'add-circle-outline'}
                      size={16} color="#1976D2"
                    />
                    <Text style={s.btnOpcoesText}>
                      {showDescontos ? 'Remover opções' : 'Adicionar desconto / bonificação'}
                    </Text>
                  </TouchableOpacity>

                  {showDescontos && (<>
                    {/* Partidas Grátis */}
                    <View style={s.inputGroupRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.inputLabelBold}>PARTIDAS GRÁTIS (QTD)</Text>
                        <TextInput
                          style={s.inputLine} placeholder="0" placeholderTextColor="#BDBDBD"
                          value={descontoPartidas} onChangeText={v => setDescontoPartidas(masks.number(v))}
                          keyboardType="numeric"
                        />
                      </View>
                      {descontoPartidas.length > 0 && (
                        <TouchableOpacity onPress={() => setDescontoPartidas('')} style={s.btnClear}>
                          <Ionicons name="close" size={20} color="#9E9E9E" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Desconto Dinheiro */}
                    <View style={s.inputGroupRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.inputLabelBold}>DESC. DINHEIRO</Text>
                        <TextInput
                          style={s.inputLine} placeholder="R$ 0,00" placeholderTextColor="#BDBDBD"
                          value={descontoDinheiro} onChangeText={setDescontoDinheiro}
                          keyboardType="numeric"
                        />
                      </View>
                      {descontoDinheiro.length > 0 && (
                        <TouchableOpacity onPress={() => setDescontoDinheiro('')} style={s.btnClear}>
                          <Ionicons name="close" size={20} color="#9E9E9E" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Bonificação (só PercentualPagar) */}
                    {isPagar && (
                      <View style={s.inputGroupRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.inputLabelBold}>BONIFICAÇÃO</Text>
                          <TextInput
                            style={s.inputLine} placeholder="R$ 0,00" placeholderTextColor="#BDBDBD"
                            value={bonificacao} onChangeText={setBonificacao}
                            keyboardType="numeric"
                          />
                        </View>
                        {bonificacao.length > 0 && (
                          <TouchableOpacity onPress={() => setBonificacao('')} style={s.btnClear}>
                            <Ionicons name="close" size={20} color="#9E9E9E" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    {/* Manutenção */}
                    <TouchableOpacity
                      style={s.checkboxRow}
                      onPress={() => setTrocaPano(v => !v)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.checkbox, trocaPano && s.checkboxChecked]}>
                        {trocaPano && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.checkboxLabel}>Troca de pano / manutenção</Text>
                        <Text style={s.checkboxDesc}>Registra data de manutenção no produto</Text>
                      </View>
                    </TouchableOpacity>
                  </>)}

                  {/* Resultados dos descontos (sempre visíveis quando há valor) */}
                  {calculo && (<>
                    {calculo.descontoPartidasValor > 0 && (
                      <View style={s.calcRow}>
                        <Text style={s.calcLabel}>– DESC. PARTIDAS</Text>
                        <Text style={[s.calcValue, { color: '#DC2626' }]}>– {formatarMoeda(calculo.descontoPartidasValor)}</Text>
                      </View>
                    )}
                    {calculo.descontoDinheiroValor > 0 && (
                      <View style={s.calcRow}>
                        <Text style={s.calcLabel}>– DESC. DINHEIRO</Text>
                        <Text style={[s.calcValue, { color: '#DC2626' }]}>– {formatarMoeda(calculo.descontoDinheiroValor)}</Text>
                      </View>
                    )}
                    <View style={s.calcRow}>
                      <Text style={s.calcLabel}>SUBTOTAL (%)</Text>
                      <Text style={s.calcValue}>{formatarMoeda(calculo.valorPercentual)}</Text>
                    </View>
                    {isPagar && calculo.bonificacaoValor > 0 && (
                      <View style={s.calcRow}>
                        <Text style={s.calcLabel}>+ BONIFICAÇÃO</Text>
                        <Text style={[s.calcValue, { color: '#2E7D32' }]}>+ {formatarMoeda(calculo.bonificacaoValor)}</Text>
                      </View>
                    )}
                  </>)}

                  {/* Saldo anterior (só PercentualReceber) */}
                  {isReceber && saldoAnterior > 0 && (
                    <View style={[s.calcRow, s.calcRowSaldo]}>
                      <Text style={s.calcLabelSaldo}>+ SALDO ANTERIOR</Text>
                      <Text style={s.calcValueSaldo}>{formatarMoeda(saldoAnterior)}</Text>
                    </View>
                  )}

                  <View style={s.div} />
                  <View style={s.calcRow}>
                    <Text style={s.totalLabel}>{labelTotal}</Text>
                    <Text style={[s.totalValue, saldoAnterior > 0 && isReceber && s.totalValueComSaldo]}>
                      {formatarMoeda(totalExibido)}
                    </Text>
                  </View>
                </>)}

                {/* Valor recebido / pago */}
                <View style={[s.inputGroup, { marginTop: 8 }]}>
                  <Text style={s.inputLabelBold}>{labelValor}</Text>
                  <TextInput
                    style={s.inputLine} placeholder="R$ 0,00" placeholderTextColor="#BDBDBD"
                    value={valorRecebido} onChangeText={setValorRecebido} keyboardType="numeric"
                  />
                </View>
                {/* Saldo devedor / troco feedback */}
                {valorRecebido.trim() && totalExibido > 0 && (() => {
                  const recebido = parseFloat(valorRecebido.replace(',', '.')) || 0;
                  const saldo = totalExibido - recebido;
                  if (saldo > 0.005) return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, padding: 8, backgroundColor: '#FEF2F2', borderRadius: 6 }}>
                      <Ionicons name="alert-circle" size={16} color="#E53935" />
                      <Text style={{ fontSize: 13, color: '#E53935', fontWeight: '600' }}>
                        Ficará saldo devedor de {formatarMoeda(saldo)}
                      </Text>
                    </View>
                  );
                  if (saldo < -0.005) return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, padding: 8, backgroundColor: '#F0FDF4', borderRadius: 6 }}>
                      <Ionicons name="return-down-back" size={16} color="#16A34A" />
                      <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '600' }}>
                        Troco: {formatarMoeda(Math.abs(saldo))}
                      </Text>
                    </View>
                  );
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, padding: 8, backgroundColor: '#F0FDF4', borderRadius: 6 }}>
                      <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                      <Text style={{ fontSize: 13, color: '#16A34A', fontWeight: '600' }}>Pagamento exato</Text>
                    </View>
                  );
                })()}
              </View>
            </View>
          </>)}
          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── BOTÃO AVANÇAR ──────────────────────────────────────── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btnAvancar, !podeAvancar && s.btnDisabled]}
          onPress={handleAvancar} disabled={!podeAvancar} activeOpacity={0.85}
        >
          <Text style={s.btnAvancarText}>AVANÇAR</Text>
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
  statusRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPendente:{ fontSize: 14, fontWeight: '700', color: '#FF6D00' },
  historicoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF', borderRadius: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  historicoBtnText: { fontSize: 12, fontWeight: '700', color: '#1976D2' },
  card:         { backgroundColor: '#FFFFFF', borderRadius: 4, marginBottom: 12, elevation: 1 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  cardTitle:    { fontSize: 15, fontWeight: '600', color: '#1976D2' },
  cardBody:     { padding: 16, gap: 12 },
  fieldRow:     { flexDirection: 'row', gap: 16 },
  fieldBlock:   { flex: 1 },
  fieldLabel:   { fontSize: 11, color: '#9E9E9E', marginBottom: 2 },
  fieldValue:   { fontSize: 14, color: '#212121' },
  fieldValueHighlight: { fontSize: 16, fontWeight: '700', color: '#1976D2' },
  div:          { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  inputGroup:   { marginTop: 4 },
  inputGroupRow:{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4, gap: 8 },
  inputLabelBold:{ fontSize: 12, fontWeight: '700', color: '#424242', letterSpacing: 0.3 },
  inputLine:    { borderBottomWidth: 1, borderBottomColor: '#9E9E9E', fontSize: 16, color: '#212121', paddingVertical: 6, marginTop: 2, flex: 1 },
  inputLineError:{ borderBottomColor: '#E53935' },
  inputError:   { fontSize: 11, color: '#E53935', marginTop: 4 },
  btnClear:     { paddingBottom: 6 },
  btnOpcoes:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: 2 },
  checkboxRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  checkbox:     { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: '#9E9E9E', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxChecked:{ backgroundColor: '#1976D2', borderColor: '#1976D2' },
  checkboxLabel:{ fontSize: 13, fontWeight: '600', color: '#212121' },
  checkboxDesc: { fontSize: 11, color: '#9E9E9E', marginTop: 1 },
  btnOpcoesText:{ fontSize: 12, fontWeight: '600', color: '#1976D2' },
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
  notaBox:      { backgroundColor: '#FFF8E1', borderRadius: 6, padding: 10, gap: 8, borderLeftWidth: 3, borderLeftColor: '#FFA000' },
  notaText:     { fontSize: 11, color: '#795548', lineHeight: 16 },
  btnAtualizar: { alignSelf: 'flex-end', borderWidth: 1, borderColor: '#1976D2', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  btnAtualizarText: { fontSize: 13, fontWeight: '700', color: '#1976D2' },
  footer:       { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  btnAvancar:   { backgroundColor: '#1565C0', borderRadius: 6, padding: 16, alignItems: 'center' },
  btnDisabled:  { backgroundColor: '#BDBDBD' },
  btnAvancarText:{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
});
