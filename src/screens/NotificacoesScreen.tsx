/**
 * NotificacoesScreen.tsx
 * Tela de notificações do usuário
 * - Lista de notificações com filtro (Todas / Não lidas / Lidas)
 * - Marcar como lida ao tocar
 * - Ícones e cores por tipo de notificação
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { apiService } from '../services/ApiService';
import { formatarDataHora } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
}

type FiltroNotificacao = 'todas' | 'naoLidas' | 'lidas';

// ============================================================================
// MAPEAMENTO DE ÍCONES POR TIPO
// ============================================================================

const TIPO_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  cobranca_vencida:   { icon: 'alert-circle',     color: '#DC2626', bg: '#FEF2F2' },
  saldo_devedor:      { icon: 'cash-outline',     color: '#D97706', bg: '#FFFBEB' },
  conflito_sync:      { icon: 'sync-outline',     color: '#EA580C', bg: '#FFF7ED' },
  cobranca_gerada:    { icon: 'receipt-outline',  color: '#2563EB', bg: '#EFF6FF' },
  manutencao_agendada:{ icon: 'construct-outline', color: '#16A34A', bg: '#F0FDF4' },
  meta_atingida:      { icon: 'trophy-outline',   color: '#7C3AED', bg: '#F5F3FF' },
  email_falhou:       { icon: 'mail-outline',     color: '#DC2626', bg: '#FEF2F2' },
  info:               { icon: 'information-circle', color: '#2563EB', bg: '#EFF6FF' },
};

const DEFAULT_TIPO = { icon: 'notifications-outline' as keyof typeof Ionicons.glyphMap, color: '#64748B', bg: '#F1F5F9' };

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function NotificacoesScreen() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroNotificacao>('todas');

  // ─── carregar notificações ────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const response = await apiService.getNotificacoes();
      if (response.success && response.data) {
        setNotificacoes(response.data);
      } else {
        setErro(response.error || 'Erro ao carregar notificações');
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  // Carregar na montagem
  React.useEffect(() => { carregar(); }, [carregar]);

  // ─── marcar como lida ─────────────────────────────────────────────────────
  const marcarLida = useCallback(async (id: string) => {
    // Otimista: atualizar UI imediatamente
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));

    try {
      await apiService.marcarNotificacaoLida(id);
    } catch {
      // Reverter em caso de erro
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: false } : n));
    }
  }, []);

  // ─── refresh ──────────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregar();
  }, [carregar]);

  // ─── filtrar ──────────────────────────────────────────────────────────────
  const notificacoesFiltradas = notificacoes.filter(n => {
    if (filtro === 'naoLidas') return !n.lida;
    if (filtro === 'lidas') return n.lida;
    return true;
  });

  const totalNaoLidas = notificacoes.filter(n => !n.lida).length;

  // ─── loading ──────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando notificações...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Filtros */}
      <View style={s.filtrosContainer}>
        <FiltroChip
          label="Todas"
          active={filtro === 'todas'}
          onPress={() => setFiltro('todas')}
        />
        <FiltroChip
          label={`Não lidas${totalNaoLidas > 0 ? ` (${totalNaoLidas})` : ''}`}
          active={filtro === 'naoLidas'}
          onPress={() => setFiltro('naoLidas')}
          badge={totalNaoLidas > 0 ? totalNaoLidas : undefined}
        />
        <FiltroChip
          label="Lidas"
          active={filtro === 'lidas'}
          onPress={() => setFiltro('lidas')}
        />
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
        data={notificacoesFiltradas}
        keyExtractor={item => item.id}
        contentContainerStyle={[s.list, notificacoesFiltradas.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} tintColor="#2563EB" />
        }
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={56} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Nenhuma notificação</Text>
            <Text style={s.emptyText}>
              {filtro === 'naoLidas' ? 'Todas as notificações foram lidas' :
               filtro === 'lidas' ? 'Nenhuma notificação lida' :
               'Você não tem notificações no momento'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <NotificacaoCard notificacao={item} onMarcarLida={marcarLida} />
        )}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// SUBCOMPONENTES
// ============================================================================

function FiltroChip({ label, active, onPress, badge }: {
  label: string; active: boolean; onPress: () => void; badge?: number;
}) {
  return (
    <TouchableOpacity
      style={[s.filtroChip, active && s.filtroChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.filtroLabel, active && s.filtroLabelActive]}>{label}</Text>
      {badge != null && badge > 0 && (
        <View style={s.filtroBadge}>
          <Text style={s.filtroBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function NotificacaoCard({ notificacao, onMarcarLida }: {
  notificacao: Notificacao;
  onMarcarLida: (id: string) => void;
}) {
  const cfg = TIPO_CONFIG[notificacao.tipo] || DEFAULT_TIPO;

  const handlePress = () => {
    if (!notificacao.lida) {
      onMarcarLida(notificacao.id);
    }
  };

  return (
    <TouchableOpacity
      style={[s.card, !notificacao.lida && s.cardUnread]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      {/* Indicador de não lida — borda azul à esquerda */}
      {!notificacao.lida && <View style={s.unreadBorder} />}

      <View style={s.cardContent}>
        {/* Ícone do tipo */}
        <View style={[s.tipoIcon, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        </View>

        {/* Texto */}
        <View style={s.cardText}>
          <View style={s.cardHeader}>
            <Text style={[s.cardTitulo, !notificacao.lida && s.cardTituloUnread]}>
              {notificacao.titulo}
            </Text>
            {!notificacao.lida && <View style={s.unreadDot} />}
          </View>
          <Text style={s.cardMensagem} numberOfLines={2}>{notificacao.mensagem}</Text>
          <Text style={s.cardData}>{formatarDataHora(notificacao.createdAt)}</Text>
        </View>
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

  // Filtros
  filtrosContainer:{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filtroChip:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  filtroChipActive:{ backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filtroLabel:    { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filtroLabelActive:{ color: '#FFFFFF' },
  filtroBadge:    { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  filtroBadgeText:{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // Erro
  erroCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  erroText:       { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:      { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  // Lista
  list:           { padding: 16, paddingBottom: 32 },
  listEmpty:      { flexGrow: 1 },

  // Card
  card:           { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  cardUnread:     { borderColor: '#BFDBFE', backgroundColor: '#FAFCFF' },
  unreadBorder:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#2563EB', borderRadius: 2 },
  cardContent:    { flexDirection: 'row', gap: 12 },
  tipoIcon:       { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardText:       { flex: 1, gap: 4 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitulo:     { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  cardTituloUnread:{ fontWeight: '700', color: '#1E293B' },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
  cardMensagem:   { fontSize: 13, color: '#64748B', lineHeight: 18 },
  cardData:       { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // Empty
  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle:     { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:      { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
