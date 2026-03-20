/**
 * RelatorioManutencaoScreen.tsx
 * Relatório de trocas de pano e manutenções realizadas
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { manutencaoRepository, RegistroManutencao } from '../repositories/ManutencaoRepository';
import { formatarMoeda } from '../utils/currency';

const TIPO_LABEL: Record<string, string> = {
  trocaPano:  'Troca de Pano',
  manutencao: 'Manutenção',
};

const TIPO_COLOR: Record<string, string> = {
  trocaPano:  '#2563EB',
  manutencao: '#EA580C',
};

function formatData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function RelatorioManutencaoScreen() {
  const [registros,    setRegistros]    = useState<RegistroManutencao[]>([]);
  const [filtrados,    setFiltrados]    = useState<RegistroManutencao[]>([]);
  const [carregando,   setCarregando]   = useState(true);
  const [busca,        setBusca]        = useState('');
  const [filtroTipo,   setFiltroTipo]   = useState<'todos' | 'trocaPano' | 'manutencao'>('todos');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await manutencaoRepository.getAll();
      setRegistros(lista);
      applyFilters(lista, busca, filtroTipo);
    } catch {
      setRegistros([]);
    } finally {
      setCarregando(false);
    }
  }, [busca, filtroTipo]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const applyFilters = (lista: RegistroManutencao[], q: string, tipo: string) => {
    let result = lista;
    if (tipo !== 'todos') result = result.filter(r => r.tipo === tipo);
    if (q.trim()) {
      const lower = q.toLowerCase();
      result = result.filter(r =>
        r.produtoIdentificador?.toLowerCase().includes(lower) ||
        r.produtoTipo?.toLowerCase().includes(lower) ||
        r.clienteNome?.toLowerCase().includes(lower)
      );
    }
    setFiltrados(result);
  };

  const handleBusca = (v: string) => {
    setBusca(v);
    applyFilters(registros, v, filtroTipo);
  };

  const handleFiltroTipo = (tipo: 'todos' | 'trocaPano' | 'manutencao') => {
    setFiltroTipo(tipo);
    applyFilters(registros, busca, tipo);
  };

  const totalTrocas = registros.filter(r => r.tipo === 'trocaPano').length;

  const renderItem = ({ item }: { item: RegistroManutencao }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.tipoBadge, { backgroundColor: `${TIPO_COLOR[item.tipo]}15` }]}>
          <Ionicons
            name={item.tipo === 'trocaPano' ? 'color-wand' : 'construct'}
            size={14}
            color={TIPO_COLOR[item.tipo]}
          />
          <Text style={[s.tipoBadgeText, { color: TIPO_COLOR[item.tipo] }]}>
            {TIPO_LABEL[item.tipo] ?? item.tipo}
          </Text>
        </View>
        <Text style={s.dataText}>{formatData(item.data)}</Text>
      </View>

      <View style={s.cardBody}>
        <View style={s.produtoRow}>
          <Ionicons name="cube" size={16} color="#2563EB" />
          <Text style={s.produtoText}>
            {item.produtoTipo} N° {item.produtoIdentificador}
          </Text>
        </View>

        {item.clienteNome && (
          <View style={s.infoRow}>
            <Ionicons name="person-outline" size={14} color="#94A3B8" />
            <Text style={s.infoText}>{item.clienteNome}</Text>
          </View>
        )}

        {item.descricao && (
          <Text style={s.descricao}>{item.descricao}</Text>
        )}

        {item.cobrancaId && (
          <View style={s.infoRow}>
            <Ionicons name="cash-outline" size={14} color="#94A3B8" />
            <Text style={s.infoText}>Durante cobrança</Text>
          </View>
        )}
        {item.locacaoId && !item.cobrancaId && (
          <View style={s.infoRow}>
            <Ionicons name="key-outline" size={14} color="#94A3B8" />
            <Text style={s.infoText}>Na criação da locação</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* stats header */}
      <View style={s.statsBar}>
        <View style={s.statBox}>
          <Text style={s.statNum}>{registros.length}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: '#2563EB' }]}>{totalTrocas}</Text>
          <Text style={s.statLabel}>Trocas de Pano</Text>
        </View>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: '#EA580C' }]}>{registros.length - totalTrocas}</Text>
          <Text style={s.statLabel}>Manutenções</Text>
        </View>
      </View>

      {/* busca */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={s.searchInput}
          placeholder="Produto, cliente..."
          placeholderTextColor="#94A3B8"
          value={busca}
          onChangeText={handleBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => handleBusca('')}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      </View>

      {/* filtro tipo */}
      <View style={s.filtroRow}>
        {(['todos', 'trocaPano', 'manutencao'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.filtroChip, filtroTipo === t && s.filtroChipActive]}
            onPress={() => handleFiltroTipo(t)}
          >
            <Text style={[s.filtroChipText, filtroTipo === t && s.filtroChipTextActive]}>
              {t === 'todos' ? 'Todos' : TIPO_LABEL[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando ? (
        <View style={s.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, filtrados.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#2563EB']} />
          }
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="construct-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Nenhuma manutenção registrada</Text>
              <Text style={s.emptyText}>
                Marque "Troca de pano" ao criar locações ou durante cobranças
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  statsBar:   { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  statBox:    { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNum:    { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  statLabel:  { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:{ flex: 1, fontSize: 15, color: '#1E293B' },

  filtroRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filtroChipActive: { backgroundColor: '#2563EB' },
  filtroChipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filtroChipTextActive: { color: '#FFFFFF' },

  list:       { padding: 12, paddingBottom: 24 },
  listEmpty:  { flexGrow: 1 },

  card:       { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tipoBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tipoBadgeText: { fontSize: 12, fontWeight: '700' },
  dataText:   { fontSize: 12, color: '#94A3B8' },

  cardBody:   { gap: 5 },
  produtoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  produtoText:{ fontSize: 15, fontWeight: '700', color: '#1E293B' },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:   { fontSize: 13, color: '#64748B' },
  descricao:  { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 2 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155' },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 280 },
});
