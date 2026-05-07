/**
 * RelatorioInadimplenciaScreen.tsx
 * Relatório de inadimplência — clientes com cobranças em atraso
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { apiService } from '../services/ApiService';
import { formatarData, formatarMoeda } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

interface ItemInadimplencia {
  id: string;
  clienteNome: string;
  cobrancaId: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioInadimplenciaScreen() {
  const [items, setItems] = useState<ItemInadimplencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ─── carregar dados ──────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const response = await apiService.getRelatorioInadimplencia?.();
      if (response?.success && response.data) {
        setItems(response.data);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregar();
  }, [carregar]);

  // ─── loading ─────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={s.loadingText}>Carregando relatório...</Text>
      </View>
    );
  }

  const totalInadimplencia = items.reduce((acc, i) => acc + i.valor, 0);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Resumo */}
      <View style={s.resumoCard}>
        <View style={s.resumoIcon}>
          <Ionicons name="alert-circle" size={24} color="#DC2626" />
        </View>
        <View style={s.resumoText}>
          <Text style={s.resumoLabel}>Total em Inadimplência</Text>
          <Text style={s.resumoValor}>{formatarMoeda(totalInadimplencia)}</Text>
          <Text style={s.resumoSub}>{items.length} cobrança(ões) em atraso</Text>
        </View>
      </View>

      {/* Erro */}
      {erro && (
        <View style={s.erroCard}>
          <Ionicons name="warning" size={18} color="#DC2626" />
          <Text style={s.erroText}>{erro}</Text>
          <TouchableOpacity onPress={carregar}>
            <Text style={s.retryText}>Tentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={[s.list, items.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} tintColor="#DC2626" />
        }
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="checkmark-circle-outline" size={56} color="#16A34A" />
            <Text style={s.emptyTitle}>Nenhuma inadimplência</Text>
            <Text style={s.emptyText}>Todos os pagamentos estão em dia</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardCliente}>{item.clienteNome}</Text>
              <View style={[s.diasBadge, item.diasAtraso > 30 && s.diasBadgeCritico]}>
                <Text style={s.diasText}>{item.diasAtraso}d</Text>
              </View>
            </View>
            <Text style={s.cardValor}>{formatarMoeda(item.valor)}</Text>
            <Text style={s.cardVencimento}>Vencimento: {formatarData(item.vencimento)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:{ color: '#64748B', fontSize: 15 },

  // Resumo
  resumoCard:  { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16, backgroundColor: '#FEF2F2', borderRadius: 16, gap: 14 },
  resumoIcon:  { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  resumoText:  { flex: 1 },
  resumoLabel: { fontSize: 13, color: '#991B1B', fontWeight: '500' },
  resumoValor: { fontSize: 22, fontWeight: '800', color: '#DC2626' },
  resumoSub:   { fontSize: 12, color: '#B91C1C', marginTop: 2 },

  // Erro
  erroCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  erroText:   { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:  { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  // Lista
  list:       { padding: 16, paddingBottom: 32 },
  listEmpty:  { flexGrow: 1 },

  // Card
  card:        { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardCliente: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  diasBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#FEF3C7' },
  diasBadgeCritico: { backgroundColor: '#FEE2E2' },
  diasText:    { fontSize: 12, fontWeight: '700', color: '#D97706' },
  cardValor:   { fontSize: 17, fontWeight: '700', color: '#DC2626' },
  cardVencimento:{ fontSize: 12, color: '#94A3B8', marginTop: 4 },

  // Empty
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
