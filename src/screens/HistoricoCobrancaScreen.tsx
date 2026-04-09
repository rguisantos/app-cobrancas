/**
 * HistoricoCobrancaScreen.tsx
 * ✅ Corrigido: usa CobrancaContext real, sem mock
 */

import React, { useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';

import { useCobranca }   from '../contexts/CobrancaContext';
import { CobrancasStackParamList } from '../navigation/CobrancasStack';
import { HistoricoCobranca, StatusPagamento, formatarMoeda } from '../types';
import { formatarData }  from '../utils/currency';

type HistoricoRouteProp = RouteProp<CobrancasStackParamList, 'HistoricoCobranca'>;

const STATUS_COLORS: Record<StatusPagamento, { text: string; bg: string }> = {
  Pago:     { text: '#16A34A', bg: '#F0FDF4' },
  Parcial:  { text: '#2563EB', bg: '#DBEAFE' },
  Pendente: { text: '#EA580C', bg: '#FFFBEB' },
  Atrasado: { text: '#DC2626', bg: '#FEF2F2' },
};

export default function HistoricoCobrancaScreen() {
  const route      = useRoute<HistoricoRouteProp>();
  const navigation = useNavigation();
  const { clienteId, produtoId } = route.params;

  const { cobrancas, carregando, carregarCobrancas } = useCobranca();

  const carregarHistorico = useCallback(async () => {
    // Filtrar por locacaoId no repositório quando disponível,
    // evitando carregar todas as cobranças do cliente só para filtrar localmente
    if (produtoId) {
      // produtoId aqui é na verdade o produtoIdentificador — buscar por locação específica
      await carregarCobrancas({ clienteId, produtoIdentificador: produtoId });
    } else {
      await carregarCobrancas({ clienteId });
    }
  }, [clienteId, produtoId, carregarCobrancas]);

  useFocusEffect(useCallback(() => { carregarHistorico(); }, [carregarHistorico]));

  // Com filtro já aplicado no repositório, usar cobrancas diretamente
  const cobrancasFiltradas = cobrancas;

  // Calcular totais
  const totalRecebido = cobrancasFiltradas.reduce((a, c) => a + c.valorRecebido, 0);
  const pagas         = cobrancasFiltradas.filter(c => c.status === 'Pago').length;
  
  // Total devedor: agrupar por locação e pegar apenas a última cobrança de cada
  const cobrancasPorLocacao: Record<string, HistoricoCobranca[]> = {};
  cobrancasFiltradas.forEach(c => {
    const locId = String(c.locacaoId);
    if (!cobrancasPorLocacao[locId]) cobrancasPorLocacao[locId] = [];
    cobrancasPorLocacao[locId].push(c);
  });
  
  // Para cada locação, pegar a cobrança mais recente e somar o saldoDevedorGerado
  const totalDevedor = Object.values(cobrancasPorLocacao).reduce((total, lista) => {
    if (lista.length === 0) return total;
    // Ordenar por data de criação (mais recente primeiro)
    const sorted = lista.sort((a, b) => 
      new Date(b.createdAt || b.dataInicio).getTime() - new Date(a.createdAt || a.dataInicio).getTime()
    );
    const latest = sorted[0];
    // Se a última está paga, não há saldo
    if (latest.status === 'Pago') return total;
    return total + (latest.saldoDevedorGerado || 0);
  }, 0);

  if (carregando && cobrancas.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <FlatList
        data={cobrancasFiltradas}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[s.list, cobrancas.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={carregando} onRefresh={carregarHistorico} colors={['#2563EB']} tintColor="#2563EB" />
        }
        ListHeaderComponent={() => (
          <View style={s.resumoContainer}>
            <View style={s.resumoCard}><Text style={s.resumoNum}>{cobrancas.length}</Text><Text style={s.resumoLabel}>Total</Text></View>
            <View style={s.resumoCard}><Text style={[s.resumoNum, { color: '#16A34A' }]}>{pagas}</Text><Text style={s.resumoLabel}>Pagas</Text></View>
            <View style={s.resumoCard}><Text style={[s.resumoNum, { fontSize: 14, color: '#16A34A' }]}>{formatarMoeda(totalRecebido)}</Text><Text style={s.resumoLabel}>Recebido</Text></View>
            {totalDevedor > 0 && (
              <View style={s.resumoCard}><Text style={[s.resumoNum, { fontSize: 14, color: '#DC2626' }]}>{formatarMoeda(totalDevedor)}</Text><Text style={s.resumoLabel}>Devedor</Text></View>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Nenhuma cobrança</Text>
            <Text style={s.emptyText}>Sem histórico de cobranças</Text>
          </View>
        )}
        renderItem={({ item }: { item: HistoricoCobranca }) => {
          const cfg = STATUS_COLORS[item.status] || STATUS_COLORS.Pendente;
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => (navigation as any).navigate('CobrancaDetail', { cobrancaId: item.id })}
              activeOpacity={0.75}
            >
              <View style={s.cardHeader}>
                <View style={s.cardLeft}>
                  <View style={s.produtoBadge}>
                    <Ionicons name="cube-outline" size={14} color="#2563EB" />
                    <Text style={s.produtoText}>N° {item.produtoIdentificador}</Text>
                  </View>
                  <Text style={s.periodoText}>{formatarData(item.dataInicio)} → {formatarData(item.dataFim)}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusText, { color: cfg.text }]}>{item.status}</Text>
                </View>
              </View>

              <View style={s.cardBody}>
                <View style={s.metrica}><Text style={s.metricaLabel}>Fichas</Text><Text style={s.metricaValue}>{item.fichasRodadas.toLocaleString('pt-BR')}</Text></View>
                <View style={s.metricaDiv} />
                <View style={s.metrica}><Text style={s.metricaLabel}>Total</Text><Text style={s.metricaValue}>{formatarMoeda(item.totalClientePaga)}</Text></View>
                <View style={s.metricaDiv} />
                <View style={s.metrica}><Text style={s.metricaLabel}>Recebido</Text><Text style={[s.metricaValue, { color: '#16A34A' }]}>{formatarMoeda(item.valorRecebido)}</Text></View>
              </View>

              {item.saldoDevedorGerado > 0 && (
                <View style={s.saldoRow}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={s.saldoText}>Saldo devedor: {formatarMoeda(item.saldoDevedorGerado)}</Text>
                </View>
              )}

              <View style={s.cardFooter}>
                <Text style={s.footerDate}>Registrado em {formatarData(item.createdAt)}</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8FAFC' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 15 },
  list:        { padding: 16, paddingBottom: 32 },
  listEmpty:   { flexGrow: 1 },
  resumoContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  resumoCard:  { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, alignItems: 'center', gap: 2 },
  resumoNum:   { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  resumoLabel: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  card:        { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardLeft:    { flex: 1, gap: 4 },
  produtoBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  produtoText: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  periodoText: { fontSize: 12, color: '#94A3B8' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  cardBody:    { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 8 },
  metrica:     { flex: 1, alignItems: 'center' },
  metricaLabel:{ fontSize: 10, color: '#94A3B8', marginBottom: 2 },
  metricaValue:{ fontSize: 14, fontWeight: '700', color: '#1E293B' },
  metricaDiv:  { width: 1, backgroundColor: '#E2E8F0' },
  saldoRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  saldoText:   { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerDate:  { fontSize: 11, color: '#CBD5E1' },
  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle:  { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:   { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
