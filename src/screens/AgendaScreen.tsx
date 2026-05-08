/**
 * AgendaScreen.tsx
 * Tela de agenda mostrando cobranças do dia
 * - Navegação por data (anterior / hoje / próximo)
 * - Eventos agrupados por tipo (Vencimentos, Recebimentos, Manutenções)
 * - Toque navega para CobrancaDetail / LocacaoDetail
 * - Modo offline com dados em cache
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import { databaseService } from '../services/DatabaseService';
import { formatarMoeda, formatarData } from '../utils/currency';
import { StatusPagamento } from '../types';

// ============================================================================
// TIPOS
// ============================================================================

type AgendaTipo = 'vencimento' | 'recebimento' | 'manutencao';

interface AgendaEntry {
  id: string;
  tipo: AgendaTipo;
  clienteNome: string;
  produtoIdentificador: string;
  valor?: number;
  status?: StatusPagamento;
  dataVencimento?: string;
  locacaoId?: string;
  cobrancaId?: string;
  manutencaoId?: string;
  descricao?: string;
}

interface AgendaData {
  data: string;
  cobrancas: AgendaEntry[];
  manutencoes?: AgendaEntry[];
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  Pago:     { bg: '#F0FDF4', text: '#16A34A', icon: 'checkmark-circle', label: 'Pago' },
  Parcial:  { bg: '#DBEAFE', text: '#2563EB', icon: 'time',             label: 'Parcial' },
  Pendente: { bg: '#FFFBEB', text: '#EA580C', icon: 'hourglass',        label: 'Pendente' },
  Atrasado: { bg: '#FEF2F2', text: '#DC2626', icon: 'alert-circle',     label: 'Atrasado' },
};

const TIPO_GRUPO_CONFIG: Record<AgendaTipo, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  label: string;
}> = {
  vencimento:  { icon: 'alert-circle',    color: '#DC2626', bg: '#FEF2F2', label: 'Vencimentos' },
  recebimento: { icon: 'checkmark-circle', color: '#16A34A', bg: '#F0FDF4', label: 'Recebimentos' },
  manutencao:  { icon: 'construct',        color: '#D97706', bg: '#FFFBEB', label: 'Manutenções' },
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
  const [offline, setOffline] = useState(false);

  // ─── carregar agenda ──────────────────────────────────────────────────────
  const carregar = useCallback(async (date?: Date) => {
    const targetDate = date || selectedDate;
    try {
      setErro(null);
      setOffline(false);
      const dataParam = formatDateParam(targetDate);
      const response = await apiService.getAgenda(dataParam);
      if (response.success && response.data) {
        // Suporta resposta como array direto ou objeto com cobrancas
        const raw = response.data as any;
        const entries: AgendaEntry[] = [];

        // Processar cobranças
        const cobrancas = Array.isArray(raw) ? raw : raw.cobrancas || [];
        for (const c of cobrancas) {
          const statusStr = c.status || 'Pendente';
          const isVencimento = statusStr === 'Pendente' || statusStr === 'Atrasado';
          entries.push({
            id: c.id,
            tipo: isVencimento ? 'vencimento' : 'recebimento',
            clienteNome: c.clienteNome || '',
            produtoIdentificador: c.produtoIdentificador || '',
            valor: c.valor,
            status: statusStr,
            dataVencimento: c.dataVencimento,
            locacaoId: c.locacaoId,
            cobrancaId: c.id,
          });
        }

        // Processar manutenções
        const manutencoes = raw.manutencoes || [];
        for (const m of manutencoes) {
          entries.push({
            id: m.id,
            tipo: 'manutencao',
            clienteNome: m.clienteNome || '',
            produtoIdentificador: m.produtoIdentificador || '',
            descricao: m.descricao || m.tipo || 'Manutenção',
            manutencaoId: m.id,
          });
        }

        setAgendaData(entries);
      } else {
        // Tentar carregar do cache local (offline)
        await carregarOffline(targetDate, response.error);
      }
    } catch (err) {
      // Tentar carregar do cache local (offline)
      await carregarOffline(targetDate, err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  // ─── carregar offline ─────────────────────────────────────────────────────
  const carregarOffline = useCallback(async (targetDate: Date, errorMsg?: string) => {
    try {
      setOffline(true);
      const dataParam = formatDateParam(targetDate);

      // Buscar cobranças do banco local
      const cobrancas = await databaseService.getAllAsync<any>(
        `SELECT c.* FROM cobrancas c
         WHERE c.deletedAt IS NULL
         AND (date(c.dataVencimento) = ? OR date(c.dataInicio) = ?)
         ORDER BY c.clienteNome ASC`,
        [dataParam, dataParam]
      );

      const entries: AgendaEntry[] = cobrancas.map(c => {
        const statusStr = c.status || 'Pendente';
        const isVencimento = statusStr === 'Pendente' || statusStr === 'Atrasado';
        return {
          id: c.id,
          tipo: isVencimento ? 'vencimento' : 'recebimento' as AgendaTipo,
          clienteNome: c.clienteNome || '',
          produtoIdentificador: c.produtoIdentificador || '',
          valor: c.totalClientePaga,
          status: statusStr,
          dataVencimento: c.dataVencimento,
          locacaoId: c.locacaoId,
          cobrancaId: c.id,
        };
      });

      // Buscar manutenções do banco local
      try {
        const manutencoes = await databaseService.getAllAsync<any>(
          `SELECT m.*, p.identificador as produtoIdentificador
           FROM manutencoes m
           LEFT JOIN produtos p ON p.id = m.produtoId
           WHERE m.deletedAt IS NULL
           AND date(m.dataAgendada) = ?
           ORDER BY m.dataAgendada ASC`,
          [dataParam]
        );

        for (const m of manutencoes) {
          entries.push({
            id: m.id,
            tipo: 'manutencao',
            clienteNome: '',
            produtoIdentificador: m.produtoIdentificador || '',
            descricao: m.descricao || m.tipo || 'Manutenção',
            manutencaoId: m.id,
          });
        }
      } catch {
        // Manutenções podem não existir localmente
      }

      if (entries.length > 0) {
        setAgendaData(entries);
        setErro(null);
      } else {
        setAgendaData([]);
        setErro(errorMsg || 'Sem conexão — nenhum dado local disponível');
      }
    } catch {
      setAgendaData([]);
      setErro(errorMsg || 'Sem conexão — nenhum dado local disponível');
    }
  }, []);

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
  const handleItemPress = useCallback((item: AgendaEntry) => {
    if (item.tipo === 'manutencao') {
      (navigation as any).navigate('ManutencoesList', {});
    } else if (item.cobrancaId) {
      (navigation as any).navigate('CobrancaDetail', { cobrancaId: item.cobrancaId });
    } else if (item.locacaoId) {
      (navigation as any).navigate('LocacaoDetail', { locacaoId: item.locacaoId });
    }
  }, [navigation]);

  // ─── agrupar por tipo ─────────────────────────────────────────────────────
  const grupos = useMemo(() => {
    const gruposMap: Record<AgendaTipo, AgendaEntry[]> = {
      vencimento: [],
      recebimento: [],
      manutencao: [],
    };

    for (const entry of agendaData) {
      gruposMap[entry.tipo].push(entry);
    }

    const ordem: AgendaTipo[] = ['vencimento', 'recebimento', 'manutencao'];
    return ordem
      .filter(tipo => gruposMap[tipo].length > 0)
      .map(tipo => ({
        tipo,
        config: TIPO_GRUPO_CONFIG[tipo],
        data: gruposMap[tipo],
      }));
  }, [agendaData]);

  // ─── FlatList data: grupos com headers intercalados ───────────────────────
  const flatData = useMemo(() => {
    const items: (AgendaEntry | { _header: AgendaTipo; _count: number })[] = [];
    for (const grupo of grupos) {
      items.push({ _header: grupo.tipo, _count: grupo.data.length });
      for (const r of grupo.data) {
        items.push(r);
      }
    }
    return items;
  }, [grupos]);

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

      {/* Offline indicator */}
      {offline && (
        <View style={s.offlineBanner}>
          <Ionicons name="cloud-offline" size={14} color="#D97706" />
          <Text style={s.offlineText}>Modo offline — dados locais</Text>
        </View>
      )}

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
            <Text style={s.resumoLabel}>Itens</Text>
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

      {/* Lista agrupada */}
      {flatData.length > 0 ? (
        <FlatList
          data={flatData as any[]}
          keyExtractor={(item, index) =>
            (item as any)._header ? `header_${(item as any)._header}` : (item as AgendaEntry).id
          }
          renderItem={({ item }) => {
            if ((item as any)._header) {
              const tipo = (item as any)._header as AgendaTipo;
              const count = (item as any)._count;
              const cfg = TIPO_GRUPO_CONFIG[tipo];
              return (
                <View style={s.grupoHeader} key={`header_${tipo}`}>
                  <View style={[s.grupoIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                  </View>
                  <Text style={s.grupoLabel}>{cfg.label}</Text>
                  <View style={[s.grupoBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.grupoBadgeText, { color: cfg.color }]}>{count}</Text>
                  </View>
                </View>
              );
            }
            const entry = item as AgendaEntry;
            return <AgendaCard entry={entry} onPress={handleItemPress} />;
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} tintColor="#2563EB" />
          }
        />
      ) : (
        <View style={s.empty}>
          <Ionicons name="calendar-outline" size={56} color="#CBD5E1" />
          <Text style={s.emptyTitle}>Nenhuma cobrança para esta data</Text>
          <Text style={s.emptyText}>Selecione outra data ou verifique mais tarde</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// SUBCOMPONENTES
// ============================================================================

function AgendaCard({ entry, onPress }: { entry: AgendaEntry; onPress: (item: AgendaEntry) => void }) {
  const tipoCfg = TIPO_GRUPO_CONFIG[entry.tipo];
  const statusCfg = entry.status ? STATUS_CONFIG[entry.status] || STATUS_CONFIG.Pendente : null;

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => onPress(entry)}
      activeOpacity={0.75}
    >
      <View style={s.cardHeader}>
        <View style={s.cardLeft}>
          <Text style={s.clienteNome}>{entry.clienteNome || entry.descricao || 'Evento'}</Text>
          <View style={s.produtoRow}>
            <Ionicons name="cube-outline" size={14} color="#2563EB" />
            <Text style={s.produtoText}>N° {entry.produtoIdentificador}</Text>
          </View>
        </View>
        {statusCfg ? (
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon as any} size={14} color={statusCfg.text} />
            <Text style={[s.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
          </View>
        ) : (
          <View style={[s.statusBadge, { backgroundColor: tipoCfg.bg }]}>
            <Ionicons name={tipoCfg.icon} size={14} color={tipoCfg.color} />
            <Text style={[s.statusText, { color: tipoCfg.color }]}>{tipoCfg.label}</Text>
          </View>
        )}
      </View>

      <View style={s.cardFooter}>
        {entry.valor != null ? (
          <Text style={s.valorText}>{formatarMoeda(entry.valor)}</Text>
        ) : (
          <Text style={s.descText}>{entry.descricao || ''}</Text>
        )}
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

  // Offline
  offlineBanner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFBEB', paddingVertical: 8, paddingHorizontal: 16 },
  offlineText:    { fontSize: 12, color: '#D97706', fontWeight: '600' },

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

  // Grupo header
  grupoHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 10, backgroundColor: '#F8FAFC' },
  grupoIcon:      { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  grupoLabel:     { fontSize: 13, fontWeight: '700', color: '#1E293B', flex: 1 },
  grupoBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  grupoBadgeText: { fontSize: 11, fontWeight: '700' },

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
  descText:       { fontSize: 13, color: '#64748B', flex: 1 },
  vencimentoText: { fontSize: 12, color: '#94A3B8' },
  cardArrow:      { position: 'absolute', right: 14, top: 14 },

  // Empty
  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle:     { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:      { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
