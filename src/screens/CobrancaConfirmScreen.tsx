/**
 * CobrancaConfirmScreen.tsx
 * ✅ Corrigido: usa dados reais da locação + atualiza ultimaLeituraRelogio após salvar
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView }  from 'react-native-safe-area-context';

import { useLocacao }    from '../contexts/LocacaoContext';
import { useCobranca }   from '../contexts/CobrancaContext';
import { cobrancaService } from '../services/CobrancaService';
import { formatarMoeda, formatarNumero } from '../utils/currency';
import { masks }         from '../utils/masks';
import { CobrancasStackParamList } from '../navigation/CobrancasStack';

type CobrancaConfirmRouteProp = RouteProp<CobrancasStackParamList, 'CobrancaConfirm'>;

export default function CobrancaConfirmScreen() {
  const route      = useRoute<CobrancaConfirmRouteProp>();
  const navigation = useNavigation();

  const { locacaoSelecionada, selecionarLocacao, atualizarLocacao } = useLocacao();
  const { registrarCobranca, carregando } = useCobranca();

  const { locacaoId, cobrancaId, modo } = route.params;

  const [relogioAnterior, setRelogioAnterior] = useState(0);
  const [relogioAtual,    setRelogioAtual]    = useState('');
  const [descontoPartidas,setDescontoPartidas]= useState('');
  const [descontoDinheiro,setDescontoDinheiro]= useState('');
  const [valorRecebido,   setValorRecebido]   = useState('');
  const [observacao,      setObservacao]      = useState('');
  const [calculo,         setCalculo]         = useState<any>(null);
  const [validacao,       setValidacao]       = useState<any>(null);

  useEffect(() => {
    if (locacaoId) selecionarLocacao(locacaoId);
  }, [locacaoId, selecionarLocacao]);

  useEffect(() => {
    if (locacaoSelecionada) {
      setRelogioAnterior(
        parseInt(locacaoSelecionada.ultimaLeituraRelogio?.toString() || locacaoSelecionada.numeroRelogio || '0', 10)
      );
    }
  }, [locacaoSelecionada]);

  useEffect(() => {
    if (!relogioAtual) { setCalculo(null); setValidacao(null); return; }
    const atual = parseInt(relogioAtual.replace(/\D/g, ''), 10);
    if (isNaN(atual)) { setCalculo(null); return; }
    const descontoPartidasNum = parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0;
    const descontoDinheiroNum = parseFloat(descontoDinheiro.replace(',', '.')) || 0;
    const valorFicha      = locacaoSelecionada?.precoFicha      || 3.00;
    const percentualEmpresa = locacaoSelecionada?.percentualEmpresa || 50;
    const input = {
      relogioAnterior, relogioAtual: atual, valorFicha, percentualEmpresa,
      descontoPartidasQtd: descontoPartidasNum, descontoDinheiro: descontoDinheiroNum,
      formaPagamento: (locacaoSelecionada?.formaPagamento || 'PercentualReceber') as any,
    };
    setCalculo(cobrancaService.calcularCobranca(input));
    setValidacao(cobrancaService.validarCobranca(input));
  }, [relogioAtual, relogioAnterior, descontoPartidas, descontoDinheiro, locacaoSelecionada]);

  const valorRecebidoNum = parseFloat(valorRecebido.replace(',', '.')) || 0;
  const saldoDevedor = calculo ? Math.max(0, calculo.totalClientePaga - valorRecebidoNum) : 0;
  const troco        = calculo ? Math.max(0, valorRecebidoNum - calculo.totalClientePaga) : 0;

  const handleConfirmar = useCallback(async () => {
    if (!calculo || !validacao?.valida) {
      Alert.alert('Dados inválidos', validacao?.erros?.join('\n') || 'Verifique os dados');
      return;
    }
    if (!locacaoSelecionada) { Alert.alert('Erro', 'Locação não encontrada'); return; }
    if (valorRecebidoNum < 0) { Alert.alert('Erro', 'Valor recebido não pode ser negativo'); return; }

    try {
      const relogioAtualNum = parseInt(relogioAtual.replace(/\D/g, ''), 10);
      const dadosCobranca = {
        locacaoId:             String(locacaoSelecionada.id),
        clienteId:             String(locacaoSelecionada.clienteId),
        clienteNome:           locacaoSelecionada.clienteNome || '',
        produtoIdentificador:  locacaoSelecionada.produtoIdentificador || '',
        dataInicio:            locacaoSelecionada.dataUltimaCobranca || locacaoSelecionada.dataLocacao || new Date().toISOString(),
        dataFim:               new Date().toISOString(),
        relogioAnterior,       relogioAtual: relogioAtualNum,
        fichasRodadas:         calculo.fichasRodadas,
        valorFicha:            locacaoSelecionada.precoFicha || 3.00,
        totalBruto:            calculo.totalBruto,
        descontoPartidasQtd:   parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0,
        descontoPartidasValor: calculo.descontoPartidasValor,
        descontoDinheiro:      calculo.descontoDinheiroValor,
        percentualEmpresa:     locacaoSelecionada.percentualEmpresa || 50,
        subtotalAposDescontos: calculo.subtotalAposDescontoDinheiro,
        valorPercentual:       calculo.valorPercentual,
        totalClientePaga:      calculo.totalClientePaga,
        valorRecebido:         valorRecebidoNum,
        observacao,
      };

      const cobranca = await registrarCobranca(dadosCobranca);
      if (cobranca) {
        // ✅ Atualizar leitura do relógio para próxima cobrança
        await atualizarLocacao({
          id:                   String(locacaoSelecionada.id),
          ultimaLeituraRelogio: relogioAtualNum,
          dataUltimaCobranca:   new Date().toISOString(),
        });

        const msg = [
          `Total: ${formatarMoeda(calculo.totalClientePaga)}`,
          `Recebido: ${formatarMoeda(valorRecebidoNum)}`,
          saldoDevedor > 0 ? `Saldo devedor: ${formatarMoeda(saldoDevedor)}` : null,
          troco        > 0 ? `Troco: ${formatarMoeda(troco)}` : null,
        ].filter(Boolean).join('\n');

        Alert.alert('Cobrança Registrada!', msg, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Erro', 'Não foi possível registrar a cobrança');
      }
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao registrar cobrança');
    }
  }, [calculo, validacao, valorRecebidoNum, locacaoSelecionada, relogioAnterior,
      relogioAtual, descontoPartidas, observacao, saldoDevedor, troco,
      registrarCobranca, atualizarLocacao, navigation]);

  if (!locacaoSelecionada && locacaoId) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator size="large" color="#2563EB" /><Text style={s.loadingText}>Carregando...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header info locação */}
          <View style={s.headerCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.clienteNome}>{locacaoSelecionada?.clienteNome || '—'}</Text>
              <Text style={s.produtoInfo}>
                Produto N° {locacaoSelecionada?.produtoIdentificador || '—'}
                {locacaoSelecionada?.produtoTipo ? ` · ${locacaoSelecionada.produtoTipo}` : ''}
              </Text>
              <Text style={s.pagamentoInfo}>
                {locacaoSelecionada?.percentualEmpresa}% empresa · R$ {(locacaoSelecionada?.precoFicha || 0).toFixed(2)}/ficha
              </Text>
            </View>
          </View>

          {/* Relógio */}
          <View style={s.section}><Text style={s.sectionTitle}>Leitura do Relógio</Text>
            <View style={s.sectionCard}>
              <View style={s.relogioRow}>
                <View style={s.relogioField}>
                  <Text style={s.relogioLabel}>Anterior</Text>
                  <View style={s.relogioDisplay}><Text style={s.relogioValue}>{formatarNumero(relogioAnterior)}</Text></View>
                </View>
                <View style={{ paddingTop: 20 }}><Ionicons name="arrow-forward" size={20} color="#94A3B8" /></View>
                <View style={s.relogioField}>
                  <Text style={s.relogioLabel}>Atual *</Text>
                  <TextInput
                    style={[s.relogioInput, validacao && !validacao.valida && s.inputError]}
                    placeholder="0" placeholderTextColor="#CBD5E1"
                    value={relogioAtual}
                    onChangeText={v => setRelogioAtual(masks.relogio(v))}
                    keyboardType="numeric" maxLength={10}
                  />
                </View>
              </View>
              {calculo && (
                <View style={s.fichasRow}>
                  <Text style={s.fichasLabel}>Fichas rodadas</Text>
                  <Text style={s.fichasValue}>{formatarNumero(calculo.fichasRodadas)}</Text>
                </View>
              )}
              {validacao?.erros?.map((e: string, i: number) => (
                <View key={i} style={s.erroRow}><Ionicons name="close-circle" size={16} color="#DC2626" /><Text style={s.erroText}>{e}</Text></View>
              ))}
              {validacao?.avisos?.map((a: string, i: number) => (
                <View key={i} style={s.avisoRow}><Ionicons name="information-circle" size={16} color="#EA580C" /><Text style={s.avisoText}>{a}</Text></View>
              ))}
            </View>
          </View>

          {/* Descontos */}
          <View style={s.section}><Text style={s.sectionTitle}>Descontos</Text>
            <View style={s.sectionCard}>
              <View style={s.descontosRow}>
                <View style={s.descontoField}>
                  <Text style={s.inputLabel}>Partidas grátis (qtd)</Text>
                  <TextInput style={s.descontoInput} placeholder="0" placeholderTextColor="#CBD5E1"
                    value={descontoPartidas} onChangeText={v => setDescontoPartidas(masks.number(v))} keyboardType="numeric" />
                  {calculo && calculo.descontoPartidasValor > 0 && (
                    <Text style={s.descontoValorText}>= {formatarMoeda(calculo.descontoPartidasValor)}</Text>
                  )}
                </View>
                <View style={s.descontoField}>
                  <Text style={s.inputLabel}>Desconto em R$</Text>
                  <TextInput style={s.descontoInput} placeholder="0,00" placeholderTextColor="#CBD5E1"
                    value={descontoDinheiro} onChangeText={setDescontoDinheiro} keyboardType="numeric" />
                </View>
              </View>
            </View>
          </View>

          {/* Resumo */}
          {calculo && (
            <View style={s.section}><Text style={s.sectionTitle}>Resumo de Valores</Text>
              <View style={s.sectionCard}>
                <View style={s.resumoLinha}><Text style={s.resumoLabel}>Total Bruto</Text><Text style={s.resumoValor}>{formatarMoeda(calculo.totalBruto)}</Text></View>
                {calculo.descontoPartidasValor > 0 && (
                  <View style={s.resumoLinha}><Text style={s.resumoLabel}>– Desc. Partidas</Text><Text style={[s.resumoValor, { color: '#DC2626' }]}>– {formatarMoeda(calculo.descontoPartidasValor)}</Text></View>
                )}
                {calculo.descontoDinheiroValor > 0 && (
                  <View style={s.resumoLinha}><Text style={s.resumoLabel}>– Desc. Dinheiro</Text><Text style={[s.resumoValor, { color: '#DC2626' }]}>– {formatarMoeda(calculo.descontoDinheiroValor)}</Text></View>
                )}
                <View style={s.resumoLinha}><Text style={s.resumoLabel}>Empresa ({locacaoSelecionada?.percentualEmpresa || 50}%)</Text><Text style={s.resumoValor}>{formatarMoeda(calculo.valorPercentual)}</Text></View>
                <View style={s.divider} />
                <View style={[s.resumoLinha, s.resumoTotal]}>
                  <Text style={s.resumoTotalLabel}>Total a Pagar</Text>
                  <Text style={s.resumoTotalValor}>{formatarMoeda(calculo.totalClientePaga)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Pagamento */}
          <View style={s.section}><Text style={s.sectionTitle}>Pagamento</Text>
            <View style={s.sectionCard}>
              <Text style={s.inputLabel}>Valor Recebido *</Text>
              <TextInput style={s.valorInput} placeholder="0,00" placeholderTextColor="#CBD5E1"
                value={valorRecebido} onChangeText={setValorRecebido} keyboardType="numeric" />
              {calculo && valorRecebido !== '' && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  {troco > 0 && (
                    <View style={s.trocoRow}><Ionicons name="return-down-back" size={18} color="#16A34A" /><Text style={s.trocoText}>Troco: {formatarMoeda(troco)}</Text></View>
                  )}
                  {saldoDevedor > 0 && (
                    <View style={s.saldoDevedorRow}><Ionicons name="alert-circle" size={18} color="#DC2626" /><Text style={s.saldoDevedorText}>Saldo devedor: {formatarMoeda(saldoDevedor)}</Text></View>
                  )}
                  {saldoDevedor === 0 && troco === 0 && (
                    <View style={s.pagoExatoRow}><Ionicons name="checkmark-circle" size={18} color="#16A34A" /><Text style={s.pagoExatoText}>Valor exato — sem troco</Text></View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Observação */}
          <View style={s.section}><Text style={s.sectionTitle}>Observação</Text>
            <View style={s.sectionCard}>
              <TextInput style={s.observacaoInput} placeholder="Observação (opcional)..."
                placeholderTextColor="#CBD5E1" value={observacao} onChangeText={setObservacao}
                multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.confirmButton, (!calculo || !validacao?.valida || carregando) && s.confirmButtonDisabled]}
            onPress={handleConfirmar} disabled={!calculo || !validacao?.valida || carregando} activeOpacity={0.85}
          >
            {carregando ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={s.confirmButtonText}>
                  {calculo ? `Confirmar · ${formatarMoeda(calculo.totalClientePaga)}` : 'Confirmar Cobrança'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText:     { color: '#64748B', fontSize: 15 },
  scroll:          { flex: 1 },
  scrollContent:   { padding: 16, paddingBottom: 110 },
  headerCard:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 20 },
  clienteNome:     { fontSize: 17, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  produtoInfo:     { fontSize: 13, color: '#94A3B8', marginBottom: 2 },
  pagamentoInfo:   { fontSize: 12, color: '#64748B' },
  section:         { marginBottom: 16 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  sectionCard:     { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  relogioRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  relogioField:    { flex: 1 },
  relogioLabel:    { fontSize: 11, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  relogioDisplay:  { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, alignItems: 'center' },
  relogioValue:    { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  relogioInput:    { fontSize: 22, fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, textAlign: 'center', borderWidth: 2, borderColor: '#BFDBFE' },
  inputError:      { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626' },
  fichasRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12 },
  fichasLabel:     { fontSize: 13, color: '#64748B', fontWeight: '500' },
  fichasValue:     { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  erroRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8 },
  erroText:        { flex: 1, fontSize: 12, color: '#DC2626' },
  avisoRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 8 },
  avisoText:       { flex: 1, fontSize: 12, color: '#EA580C' },
  descontosRow:    { flexDirection: 'row', gap: 12 },
  descontoField:   { flex: 1 },
  inputLabel:      { fontSize: 11, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  descontoInput:   { fontSize: 18, fontWeight: '700', color: '#1E293B', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', paddingBottom: 8, paddingTop: 4 },
  descontoValorText:{ fontSize: 11, color: '#64748B', marginTop: 4 },
  resumoLinha:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  resumoLabel:     { fontSize: 14, color: '#64748B' },
  resumoValor:     { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  divider:         { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  resumoTotal:     { paddingTop: 12 },
  resumoTotalLabel:{ fontSize: 16, fontWeight: '700', color: '#1E293B' },
  resumoTotalValor:{ fontSize: 22, fontWeight: '800', color: '#2563EB' },
  valorInput:      { fontSize: 28, fontWeight: '800', color: '#1E293B', borderBottomWidth: 2, borderBottomColor: '#2563EB', paddingBottom: 8, paddingTop: 4 },
  trocoRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F0FDF4', borderRadius: 10 },
  trocoText:       { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  saldoDevedorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10 },
  saldoDevedorText:{ fontSize: 14, fontWeight: '600', color: '#DC2626' },
  pagoExatoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F0FDF4', borderRadius: 10 },
  pagoExatoText:   { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  observacaoInput: { fontSize: 15, color: '#1E293B', minHeight: 72 },
  bottomBar:       { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  confirmButton:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', padding: 16, borderRadius: 14, gap: 10 },
  confirmButtonDisabled: { backgroundColor: '#BFDBFE' },
  confirmButtonText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
