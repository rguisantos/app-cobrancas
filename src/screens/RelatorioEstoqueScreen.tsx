/**
 * RelatorioEstoqueScreen.tsx
 * Relatório de estoque — produtos disponíveis em estoque
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { apiService } from '../services/ApiService';

// ============================================================================
// TIPOS
// ============================================================================

interface ItemEstoque {
  id: string;
  produtoDescricao: string;
  tipo: string;
  tamanho: string;
  numeroRelogio: string;
  status: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioEstoqueScreen() {
  const [items, setItems] = useState<ItemEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ─── carregar dados ──────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const response = await apiService.getRelatorioEstoque?.();
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
        <ActivityIndicator size="large" color="#059669" />
        <Text style={s.loadingText}>Carregando relatório...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Resumo */}
      <View style={s.resumoCard}>
        <View style={s.resumoIcon}>
          <Ionicons name="cube-outline" size={24} color="#059669" />
        </View>
        <View style={s.resumoText}>
          <Text style={s.resumoLabel}>Produtos em Estoque</Text>
          <Text style={s.resumoValor}>{items.length}</Text>
          <Text style={s.resumoSub}>itens disponíveis</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} tintColor="#059669" />
        }
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="cube-outline" size={56} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Estoque vazio</Text>
            <Text style={s.emptyText}>Nenhum produto disponível em estoque</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardDescricao}>{item.produtoDescricao}</Text>
              <View style={s.statusBadge}>
                <Text style={s.statusText}>{item.status}</Text>
              </View>
            </View>
            <View style={s.cardDetails}>
              {item.tipo ? <Text style={s.cardDetail}>Tipo: {item.tipo}</Text> : null}
              {item.tamanho ? <Text style={s.cardDetail}>Tam: {item.tamanho}</Text> : null}
              {item.numeroRelogio ? <Text style={s.cardDetail}>Relógio: {item.numeroRelogio}</Text> : null}
            </View>
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
  resumoCard:    { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16, backgroundColor: '#ECFDF5', borderRadius: 16, gap: 14 },
  resumoIcon:    { width: 48, height: 48, borderRadius: 14, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center' },
  resumoText:    { flex: 1 },
  resumoLabel:   { fontSize: 13, color: '#065F46', fontWeight: '500' },
  resumoValor:   { fontSize: 28, fontWeight: '800', color: '#059669' },
  resumoSub:     { fontSize: 12, color: '#047857', marginTop: 2 },

  // Erro
  erroCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  erroText:   { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:  { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  // Lista
  list:       { padding: 16, paddingBottom: 32 },
  listEmpty:  { flexGrow: 1 },

  // Card
  card:          { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardDescricao: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  statusBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#ECFDF5' },
  statusText:    { fontSize: 11, fontWeight: '700', color: '#059669' },
  cardDetails:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  cardDetail:    { fontSize: 12, color: '#64748B' },

  // Empty
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
