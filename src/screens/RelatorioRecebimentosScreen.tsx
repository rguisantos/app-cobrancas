/**
 * RelatorioRecebimentosScreen.tsx
 * Relatório de recebimentos — cobranças pagas em um período
 * Mostra resumo total, lista de cobranças pagas, agrupamento por dia/semana/mês
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { cobrancaRepository } from '../repositories/CobrancaRepository';
import { formatarMoeda, formatarData, formatarDataHora } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

interface CobrancaRecebida {
  id: string;
  clienteNome: string;
  clienteId: string;
  produtoIdentificador: string;
  dataPagamento: string;
  valorRecebido: number;
  totalClientePaga: number;
  status: string;
}

type Agrupamento = 'dia' | 'semana' | 'mes';

interface GrupoRecebimento {
  chave: string;
  label: string;
  cobrancas: CobrancaRecebida[];
  total: number;
}

// ============================================================================
// HELPERS
// ============================================================================

const hoje = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function getDateRange(periodo: string): { inicio: string; fim: string } {
  const now = new Date();
  switch (periodo) {
    case 'hoje':
      return { inicio: fmtDate(now), fim: fmtDate(now) };
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { inicio: fmtDate(d), fim: fmtDate(now) };
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { inicio: fmtDate(d), fim: fmtDate(now) };
    }
    case 'mes':
      return { inicio: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, fim: fmtDate(now) };
    case 'ano':
      return { inicio: `${now.getFullYear()}-01-01`, fim: fmtDate(now) };
    default:
      return { inicio: fmtDate(now), fim: fmtDate(now) };
  }
}

function getChaveAgrupamento(dataStr: string, agrup: Agrupamento): string {
  try {
    const d = new Date(dataStr);
    switch (agrup) {
      case 'dia':
        return fmtDate(d);
      case 'semana': {
        const dayOfWeek = d.getDay();
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - dayOfWeek);
        return `sem_${fmtDate(startOfWeek)}`;
      }
      case 'mes':
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      default:
        return fmtDate(d);
    }
  } catch {
    return 'desconhecido';
  }
}

function getLabelAgrupamento(chave: string, agrup: Agrupamento): string {
  if (agrup === 'dia') {
    try { return formatarData(chave); } catch { return chave; }
  }
  if (agrup === 'mes') {
    try {
      const [y, m] = chave.split('-');
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${meses[parseInt(m, 10) - 1]} ${y}`;
    } catch { return chave; }
  }
  if (agrup === 'semana') {
    try {
      const datePart = chave.replace('sem_', '');
      return `Semana de ${formatarData(datePart)}`;
    } catch { return chave; }
  }
  return chave;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioRecebimentosScreen() {
  const navigation = useNavigation<any>();

  const [cobrancas, setCobrancas] = useState<CobrancaRecebida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('dia');
  const [busca, setBusca] = useState('');

  const PERIODOS = [
    { label: 'Hoje',   key: 'hoje' },
    { label: '7 dias',  key: '7d'   },
    { label: '30 dias', key: '30d'  },
    { label: 'Mês',     key: 'mes'  },
    { label: 'Ano',     key: 'ano'  },
  ];

  // ==========================================================================
  // CARREGAR DADOS
  // ==========================================================================

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { inicio, fim } = getDateRange(periodo);

      // Buscar cobranças pagas e parciais
      const [pagas, parciais] = await Promise.all([
        cobrancaRepository.getAll({ status: 'Pago', dataInicio: inicio, dataFim: fim }),
        cobrancaRepository.getAll({ status: 'Parcial', dataInicio: inicio, dataFim: fim }),
      ]);

      // Combinar e mapear
      const todas = [...pagas, ...parciais]
        .filter(c => c.dataPagamento) // Apenas com data de pagamento
        .map(c => ({
          id: c.id,
          clienteNome: c.clienteNome || '',
          clienteId: String(c.clienteId),
          produtoIdentificador: c.produtoIdentificador || '',
          dataPagamento: c.dataPagamento || '',
          valorRecebido: c.valorRecebido || 0,
          totalClientePaga: c.totalClientePaga || 0,
          status: c.status,
        }))
        .sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento));

      setCobrancas(todas);
    } catch (e) {
      console.error('[RelatorioRecebimentos] Erro ao carregar:', e);
      setCobrancas([]);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // ==========================================================================
  // MÉTRICAS
  // ==========================================================================

  const filtrados = useMemo(() => {
    if (!busca.trim()) return cobrancas;
    const lower = busca.toLowerCase();
    return cobrancas.filter(c =>
      c.clienteNome.toLowerCase().includes(lower) ||
      c.produtoIdentificador.toLowerCase().includes(lower)
    );
  }, [cobrancas, busca]);

  const totalRecebido = useMemo(
    () => filtrados.reduce((s, c) => s + c.valorRecebido, 0),
    [filtrados]
  );

  const mediaPorCobranca = useMemo(
    () => filtrados.length > 0 ? totalRecebido / filtrados.length : 0,
    [totalRecebido, filtrados.length]
  );

  // ==========================================================================
  // AGRUPAMENTO
  // ==========================================================================

  const grupos = useMemo(() => {
    const mapa: Record<string, CobrancaRecebida[]> = {};
    for (const c of filtrados) {
      const chave = getChaveAgrupamento(c.dataPagamento, agrupamento);
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(c);
    }

    return Object.entries(mapa)
      .map(([chave, items]) => ({
        chave,
        label: getLabelAgrupamento(chave, agrupamento),
        cobrancas: items.sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento)),
        total: items.reduce((s, c) => s + c.valorRecebido, 0),
      }))
      .sort((a, b) => b.chave.localeCompare(a.chave));
  }, [filtrados, agrupamento]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const renderGrupo = ({ item: grupo }: { item: GrupoRecebimento }) => (
    <View style={st.grupoCard}>
      <View style={st.grupoHeader}>
        <View style={{ flex: 1 }}>
          <Text style={st.grupoLabel}>{grupo.label}</Text>
          <Text style={st.grupoQtd}>{grupo.cobrancas.length} cobrança{grupo.cobrancas.length !== 1 ? 's' : ''}</Text>
        </View>
        <Text style={st.grupoTotal}>{formatarMoeda(grupo.total)}</Text>
      </View>
      {grupo.cobrancas.map(c => (
        <TouchableOpacity
          key={c.id}
          style={st.cobrancaRow}
          onPress={() => navigation.navigate('CobrancaDetail', { cobrancaId: c.id })}
          activeOpacity={0.7}
        >
          <View style={[st.statusDot, { backgroundColor: c.status === 'Pago' ? '#16A34A' : '#EA580C' }]} />
          <View style={{ flex: 1 }}>
            <Text style={st.cobrancaCliente}>{c.clienteNome}</Text>
            <Text style={st.cobrancaProduto}>{c.produtoIdentificador} • {formatarDataHora(c.dataPagamento)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.cobrancaValor, { color: '#16A34A' }]}>{formatarMoeda(c.valorRecebido)}</Text>
            {c.status === 'Parcial' && (
              <Text style={st.cobrancaParcial}>parcial</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* Filtro de Período */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.filtroScroll}
        contentContainerStyle={st.filtroContent}
      >
        {PERIODOS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[st.chip, periodo === p.key && st.chipActive]}
            onPress={() => setPeriodo(p.key)}
          >
            <Text style={[st.chipText, periodo === p.key && st.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Header com totais */}
      <View style={st.totalBar}>
        <View style={st.totalItem}>
          <Text style={st.totalLabel}>Total Recebido</Text>
          <Text style={[st.totalValue, { color: '#16A34A' }]}>{formatarMoeda(totalRecebido)}</Text>
        </View>
        <View style={st.totalSep} />
        <View style={st.totalItem}>
          <Text style={st.totalLabel}>Cobranças</Text>
          <Text style={st.totalValue}>{filtrados.length}</Text>
        </View>
        <View style={st.totalSep} />
        <View style={st.totalItem}>
          <Text style={st.totalLabel}>Média</Text>
          <Text style={[st.totalValue, { color: '#2563EB' }]}>{formatarMoeda(mediaPorCobranca)}</Text>
        </View>
      </View>

      {/* Busca */}
      <View style={st.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar cliente ou produto..."
          placeholderTextColor="#94A3B8"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      </View>

      {/* Agrupamento */}
      <View style={st.agrupRow}>
        <Text style={st.agrupLabel}>Agrupar:</Text>
        {([
          { key: 'dia' as Agrupamento, label: 'Dia', icon: 'today' as const },
          { key: 'semana' as Agrupamento, label: 'Semana', icon: 'calendar' as const },
          { key: 'mes' as Agrupamento, label: 'Mês', icon: 'calendar-outline' as const },
        ]).map(a => (
          <TouchableOpacity
            key={a.key}
            style={[st.agrupBtn, agrupamento === a.key && st.agrupBtnActive]}
            onPress={() => setAgrupamento(a.key)}
          >
            <Ionicons name={a.icon} size={12} color={agrupamento === a.key ? '#FFF' : '#64748B'} />
            <Text style={[st.agrupBtnText, agrupamento === a.key && st.agrupBtnTextActive]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {carregando ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={g => g.chave}
          renderItem={renderGrupo}
          contentContainerStyle={[st.list, grupos.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#2563EB']} />}
          ListEmptyComponent={() => (
            <View style={st.empty}>
              <Ionicons name="cash-outline" size={56} color="#CBD5E1" />
              <Text style={st.emptyTitle}>Nenhum recebimento</Text>
              <Text style={st.emptySub}>Altere o período para ver recebimentos</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const st = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Filtro período
  filtroScroll: { maxHeight: 48, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filtroContent:{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#2563EB' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },

  // Header totais
  totalBar:   { flexDirection: 'row', backgroundColor: '#1E293B', padding: 16, alignItems: 'center' },
  totalItem:  { flex: 1, alignItems: 'center' },
  totalSep:   { width: 1, height: 32, backgroundColor: '#334155' },
  totalLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 2 },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  // Busca
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, padding: 12,
                backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:{ flex: 1, fontSize: 15, color: '#1E293B' },

  // Agrupamento
  agrupRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF' },
  agrupLabel:  { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  agrupBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F1F5F9' },
  agrupBtnActive: { backgroundColor: '#2563EB' },
  agrupBtnText:    { fontSize: 12, fontWeight: '600', color: '#64748B' },
  agrupBtnTextActive: { color: '#FFF' },

  // Lista
  list:       { padding: 12, paddingBottom: 24 },

  // Grupo
  grupoCard:  { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  grupoHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  grupoLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  grupoQtd:   { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  grupoTotal: { fontSize: 16, fontWeight: '800', color: '#16A34A' },

  // Cobrança row
  cobrancaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  cobrancaCliente: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  cobrancaProduto: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  cobrancaValor: { fontSize: 15, fontWeight: '700' },
  cobrancaParcial: { fontSize: 10, color: '#EA580C', fontWeight: '600', marginTop: 1 },

  // Empty
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155' },
  emptySub:   { fontSize: 14, color: '#94A3B8' },
});
