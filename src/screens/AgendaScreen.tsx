/**
 * AgendaScreen.tsx
 * Tela de agenda mostrando cobranças do dia
 * - Navegação por data (anterior / hoje / próximo)
 * - Lista de cobranças com status badges
 * - Toque navega para CobrancaDetail
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import { formatarMoeda, formatarData } from '../utils/currency';
import { StatusPagamento } from '../types';

// ============================================================================
// TIPOS
// ============================================================================

interface AgendaEntry {
  id: string;
  clienteNome: string;
  produtoIdentificador: string;
  valor: number;
  status: StatusPagamento;
  dataVencimento?: string;
  locacaoId?: string;
}

interface AgendaData {
  data: string;
  cobrancas: AgendaEntry[];
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<StatusPagamento, { bg: string; text: string; icon: string; label: string }> = {
  Pago:     { bg: '#F0FDF4', text: '#16A34A', icon: 'checkmark-circle', label: 'Pago' },
  Parcial:  { bg: '#DBEAFE', text: '#2563EB', icon: 'time',             label: 'Parcial' },
  Pendente: { bg: '#FFFBEB', text: '#EA580C', icon: 'hourglass',        label: 'Pendente' },
  Atrasado: { bg: '#FEF2F2', text: '#DC2626', icon: 'alert-circle',     label: 'Atrasado' },
};

// ============================================================================
// HELPERS DE DATA
// ============================================================================

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AgendaScreen() {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agendaData, setAgendaData] = useState<AgendaEntry[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ─── carregar agenda ──────────────────────────────────────────────────────
  const carregar = useCallback(async (date?: Date) => {
    const targetDate = date || selectedDate;
    try {
      setErro(null);
      const dataParam = formatDateParam(targetDate);
      const response = await apiService.getAgenda(dataParam);
      if (response.success && response.data) {
        // Suporta resposta como array direto ou objeto com cobrancas
        const entries = Array.isArray(response.data)
          ? response.data
          : response.data.cobrancas || [];
        setAgendaData(entries);
      } else {
        setErro(response.error || 'Erro ao carregar agenda');
        setAgendaData([]);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
      setAgendaData([]);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  // Carregar quando a data mudar
  useEffect(() => { carregar(); }, [selectedDate]);

  // ─── navegação de data ────────────────────────────────────────────────────
  const goToPreviousDay = useCallback(() => {
    setSelectedDate(prev => addDays(prev, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate(prev => addDays(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  // ─── refresh ──────────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregar();
  }, [carregar]);

  // ─── navegar para detalhe ─────────────────────────────────────────────────
  const handleCobrancaPress = useCallback((cobrancaId: string) => {
    (navigation as any).navigate('CobrancaDetail', { cobrancaId });
  }, [navigation]);

  // ─── resumo ───────────────────────────────────────────────────────────────
  const totalValor = agendaData.reduce((acc, c) => acc + (c.valor || 0), 0);
  const pagas = agendaData.filter(c => c.status === 'Pago').length;
  const pendentes = agendaData.filter(c => c.status === 'Pendente' || c.status === 'Atrasado').length;

  // ─── loading ──────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando agenda...</Text>
      </View>
    );
  }

  const today = isToday(selectedDate);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Navegação de data */}
      <View style={s.dateNav}>
        <TouchableOpacity style={s.dateNavBtn} onPress={goToPreviousDay} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#2563EB" />
        </TouchableOpacity>

        <TouchableOpacity style={s.dateNavCenter} onPress={goToToday} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={18} color={today ? '#2563EB' : '#64748B'} />
          <Text style={[s.dateNavText, today && s.dateNavTextToday]}>
            {today ? 'Hoje' : formatDisplayDate(selectedDate)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.dateNavBtn} onPress={goToNextDay} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Data formatada completa */}
      <Text style={s.dateLabel}>
        {formatDisplayDate(selectedDate)}
      </Text>

      {/* Erro */}
      {erro && (
        <View style={s.erroCard}>
          <Ionicons name="warning" size={18} color="#DC2626" />
          <Text style={s.erroText}>{erro}</Text>
          <TouchableOpacity onPress={() => carregar()}>
            <Text style={s.retryText}>Tentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resumo */}
      {agendaData.length > 0 && (
        <View style={s.resumoRow}>
          <View style={s.resumoCard}>
            <Text style={s.resumoNum}>{agendaData.length}</Text>
            <Text style={s.resumoLabel}>Cobranças</Text>
          </View>
          <View style={s.resumoCard}>
            <Text style={[s.resumoNum, { color: '#16A34A' }]}>{pagas}</Text>
            <Text style={s.resumoLabel}>Pagas</Text>
          </View>
          <View style={s.resumoCard}>
            <Text style={[s.resumoNum, { color: '#DC2626' }]}>{pendentes}</Text>
            <Text style={s.resumoLabel}>Pendentes</Text>
          </View>
          <View style={s.resumoCard}>
            <Text style={[s.resumoNum, { fontSize: 14 }]}>{formatarMoeda(totalValor)}</Text>
            <Text style={s.resumoLabel}>Total</Text>
          </View>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={agendaData}
        keyExtractor={item => item.id}
        contentContainerStyle={[s.list, agendaData.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} tintColor="#2563EB" />
        }
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={56} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Nenhuma cobrança para esta data</Text>
            <Text style={s.emptyText}>Selecione outra data ou verifique mais tarde</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <AgendaCard entry={item} onPress={handleCobrancaPress} />
        )}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// SUBCOMPONENTES
// ============================================================================

function AgendaCard({ entry, onPress }: { entry: AgendaEntry; onPress: (id: string) => void }) {
  const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.Pendente;

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => onPress(entry.id)}
      activeOpacity={0.75}
    >
      <View style={s.cardHeader}>
        <View style={s.cardLeft}>
          <Text style={s.clienteNome}>{entry.clienteNome}</Text>
          <View style={s.produtoRow}>
            <Ionicons name="cube-outline" size={14} color="#2563EB" />
            <Text style={s.produtoText}>N° {entry.produtoIdentificador}</Text>
          </View>
        </View>
        <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={14} color={cfg.text} />
          <Text style={[s.statusText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={s.cardFooter}>
        <Text style={s.valorText}>{formatarMoeda(entry.valor)}</Text>
        {entry.dataVencimento && (
          <Text style={s.vencimentoText}>Vence: {formatarData(entry.dataVencimento)}</Text>
        )}
      </View>

      <View style={s.cardArrow}>
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F8FAFC' },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:    { color: '#64748B', fontSize: 15 },

  // Navegação de data
  dateNav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dateNavBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  dateNavCenter:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateNavText:    { fontSize: 16, fontWeight: '600', color: '#64748B', textTransform: 'capitalize' },
  dateNavTextToday:{ color: '#2563EB', fontWeight: '700' },
  dateLabel:      { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 6, textTransform: 'capitalize' },

  // Erro
  erroCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  erroText:       { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:      { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  // Resumo
  resumoRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  resumoCard:     { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  resumoNum:      { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  resumoLabel:    { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Lista
  list:           { padding: 16, paddingBottom: 32 },
  listEmpty:      { flexGrow: 1 },

  // Card
  card:           { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', position: 'relative' },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardLeft:       { flex: 1, gap: 4 },
  clienteNome:    { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  produtoRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  produtoText:    { fontSize: 13, color: '#64748B' },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:     { fontSize: 11, fontWeight: '700' },
  cardFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valorText:      { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  vencimentoText: { fontSize: 12, color: '#94A3B8' },
  cardArrow:      { position: 'absolute', right: 14, top: 14 },

  // Empty
  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle:     { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:      { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
