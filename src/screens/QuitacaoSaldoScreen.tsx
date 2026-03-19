/**
 * QuitacaoSaldoScreen.tsx
 * Tela de quitação de saldo devedor de produtos já retirados (locação finalizada)
 *
 * Aparece como tab em CobrancaClienteScreen quando o cliente tem
 * cobrancasList em aberto de produtos que não estão mais locados.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

import { cobrancaRepository } from '../repositories/CobrancaRepository';
import { useCobranca }        from '../contexts/CobrancaContext';
import { formatarMoeda, formatarData } from '../utils/currency';
import { HistoricoCobranca }  from '../types';
import { CobrancasStackParamList, CobrancasStackNavigationProp } from '../navigation/CobrancasStack';

type RouteType = RouteProp<CobrancasStackParamList, 'QuitacaoSaldo'>;

export default function QuitacaoSaldoScreen() {
  const route      = useRoute<RouteType>();
  const navigation = useNavigation<CobrancasStackNavigationProp>();
  const { locacaoId, clienteId, clienteNome, produtoIdentificador } = route.params;

  const { atualizarCobranca } = useCobranca();

  const [cobrancasList,    setCobrancasList]    = useState<HistoricoCobranca[]>([]);
  const [carregando,   setCarregando]   = useState(true);
  const [valorPago,    setValorPago]    = useState('');
  const [observacao,   setObservacao]   = useState('');
  const [salvando,     setSalvando]     = useState(false);

  const saldoTotal = cobrancasList.reduce((s, c) => s + c.saldoDevedorGerado, 0);

  useEffect(() => {
    cobrancaRepository.getByLocacao(locacaoId)
      .then(lista => {
        const pendentes = lista.filter(
          c => (c.status === 'Parcial' || c.status === 'Pendente' || c.status === 'Atrasado')
            && c.saldoDevedorGerado > 0
        );
        setCobrancasList(pendentes);
      })
      .catch(() => setCobrancasList([]))
      .finally(() => setCarregando(false));
  }, [locacaoId]);

  const handleQuitar = useCallback(async () => {
    const valor = parseFloat(valorPago.replace(',', '.')) || 0;
    if (valor <= 0) { Alert.alert('Atenção', 'Informe o valor recebido'); return; }
    if (valor > saldoTotal) {
      Alert.alert('Atenção', `O valor não pode ser maior que o saldo (${formatarMoeda(saldoTotal)})`);
      return;
    }

    setSalvando(true);
    try {
      // Distribuir o pagamento pelas cobrancasList mais antigas primeiro (FIFO)
      let restante = valor;
      const ordenadas = [...cobrancasList].sort(
        (a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime()
      );

      for (const c of ordenadas) {
        if (restante <= 0) break;
        const pagamento = Math.min(restante, c.saldoDevedorGerado);
        const novoRecebido = c.valorRecebido + pagamento;
        const novoSaldo = c.totalClientePaga - novoRecebido;
        const novoStatus = novoSaldo <= 0
          ? 'Pago'
          : novoRecebido > 0 ? 'Parcial' : 'Pendente';

        await atualizarCobranca({
          id: String(c.id),
          valorRecebido:     novoRecebido,
          saldoDevedorGerado: Math.max(0, novoSaldo),
          status:            novoStatus,
          dataPagamento:     novoStatus === 'Pago' ? new Date().toISOString() : undefined,
          observacao:        observacao || `Quitação parcial: ${formatarMoeda(pagamento)}`,
        });

        restante -= pagamento;
      }

      const saldoRestante = saldoTotal - valor;
      Alert.alert(
        saldoRestante <= 0 ? 'Saldo Quitado!' : 'Pagamento Registrado',
        saldoRestante <= 0
          ? `Todo o saldo de ${formatarMoeda(saldoTotal)} foi quitado.`
          : `Recebido: ${formatarMoeda(valor)}\nSaldo restante: ${formatarMoeda(saldoRestante)}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o pagamento');
    } finally {
      setSalvando(false);
    }
  }, [valorPago, saldoTotal, cobrancasList, observacao, atualizarCobranca, navigation]);

  if (carregando) {
    return <View style={s.center}><ActivityIndicator size="large" color="#E53935" /></View>;
  }

  if (cobrancasList.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
        <Text style={s.emptyTitle}>Sem saldo devedor</Text>
        <Text style={s.emptyText}>Todas as cobrancasList deste produto estão quitadas.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* cabeçalho */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="archive" size={24} color="#E53935" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerProduto}>Produto N° {produtoIdentificador}</Text>
            <Text style={s.headerCliente}>{clienteNome}</Text>
            <Text style={s.headerInfo}>Produto retirado — saldo devedor em aberto</Text>
          </View>
        </View>

        {/* saldo total */}
        <View style={s.saldoCard}>
          <Text style={s.saldoLabel}>Saldo Total Pendente</Text>
          <Text style={s.saldoValor}>{formatarMoeda(saldoTotal)}</Text>
        </View>

        {/* cobrancasList pendentes */}
        <Text style={s.secTitle}>Cobranças em aberto</Text>
        {cobrancasList.map(c => (
          <View key={String(c.id)} style={s.cobrancaCard}>
            <View style={s.cobrancaRow}>
              <Text style={s.cobrancaLabel}>Período</Text>
              <Text style={s.cobrancaValue}>
                {formatarData(c.dataInicio)} → {formatarData(c.dataFim)}
              </Text>
            </View>
            <View style={s.cobrancaRow}>
              <Text style={s.cobrancaLabel}>Total cobrado</Text>
              <Text style={s.cobrancaValue}>{formatarMoeda(c.totalClientePaga)}</Text>
            </View>
            <View style={s.cobrancaRow}>
              <Text style={s.cobrancaLabel}>Já recebido</Text>
              <Text style={[s.cobrancaValue, { color: '#16A34A' }]}>{formatarMoeda(c.valorRecebido)}</Text>
            </View>
            <View style={[s.cobrancaRow, s.cobrancaRowSaldo]}>
              <Text style={s.cobrancaLabelSaldo}>Saldo devedor</Text>
              <Text style={s.cobrancaValueSaldo}>{formatarMoeda(c.saldoDevedorGerado)}</Text>
            </View>
          </View>
        ))}

        {/* pagamento */}
        <Text style={s.secTitle}>Registrar Pagamento</Text>
        <View style={s.pagCard}>
          <Text style={s.pagLabel}>Valor Recebido *</Text>
          <TextInput
            style={s.pagInput}
            placeholder="0,00"
            placeholderTextColor="#BDBDBD"
            value={valorPago}
            onChangeText={setValorPago}
            keyboardType="numeric"
          />
          <Text style={s.pagLabel}>Observação</Text>
          <TextInput
            style={[s.pagInput, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Observação opcional..."
            placeholderTextColor="#BDBDBD"
            value={observacao}
            onChangeText={setObservacao}
            multiline
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* botão confirmar */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btnConfirm, salvando && s.btnDisabled]}
          onPress={handleQuitar}
          disabled={salvando}
          activeOpacity={0.85}
        >
          {salvando
            ? <ActivityIndicator color="#FFF" />
            : <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={s.btnConfirmText}>Confirmar Pagamento</Text>
              </>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  emptyText:  { fontSize: 14, color: '#64748B', textAlign: 'center' },
  scroll:     { padding: 16 },

  header:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#E53935' },
  headerIcon:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  headerProduto:{ fontSize: 15, fontWeight: '700', color: '#1E293B' },
  headerCliente:{ fontSize: 13, color: '#64748B', marginTop: 2 },
  headerInfo:   { fontSize: 11, color: '#E53935', marginTop: 4, fontWeight: '600' },

  saldoCard:    { alignItems: 'center', backgroundColor: '#E53935', borderRadius: 14, padding: 20, marginBottom: 20, gap: 4 },
  saldoLabel:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 },
  saldoValor:   { fontSize: 36, fontWeight: '800', color: '#FFFFFF' },

  secTitle:     { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 },

  cobrancaCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#FEE2E2' },
  cobrancaRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  cobrancaRowSaldo: { backgroundColor: '#FEF2F2', marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 6, borderBottomWidth: 0 },
  cobrancaLabel:    { fontSize: 13, color: '#64748B' },
  cobrancaValue:    { fontSize: 13, fontWeight: '500', color: '#1E293B' },
  cobrancaLabelSaldo: { fontSize: 13, fontWeight: '700', color: '#E53935' },
  cobrancaValueSaldo: { fontSize: 14, fontWeight: '800', color: '#E53935' },

  pagCard:    { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  pagLabel:   { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  pagInput:   { borderBottomWidth: 1.5, borderBottomColor: '#E53935', fontSize: 18, fontWeight: '700', color: '#1E293B', paddingVertical: 6 },

  footer:       { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  btnConfirm:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#E53935', padding: 16, borderRadius: 14 },
  btnDisabled:  { backgroundColor: '#FECACA' },
  btnConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
