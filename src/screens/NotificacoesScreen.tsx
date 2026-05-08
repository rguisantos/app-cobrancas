/**
 * NotificacoesScreen.tsx
 * Tela de notificações do usuário
 * - Usa NotificacaoContext para gerenciamento de estado
 * - Lista de notificações com filtro (Todas / Não lidas / Lidas)
 * - Marcar como lida ao tocar
 * - Marcar todas como lidas
 * - Ícones e cores por tipo de notificação
 * - Navegação por tipo de notificação
 */

import React, { useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useNotificacao, Notificacao } from '../contexts/NotificacaoContext';
import { formatarDataHora } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

type FiltroNotificacao = 'todas' | 'naoLidas' | 'lidas';

// ============================================================================
// MAPEAMENTO DE ÍCONES POR TIPO
// ============================================================================

const TIPO_CONFIG: Record<string, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  tela?: string;
  params?: (notificacao: Notificacao) => Record<string, string>;
}> = {
  cobranca_vencida:   { icon: 'alert-circle',     color: '#DC2626', bg: '#FEF2F2', tela: 'CobrancaDetail', params: (n) => ({ cobrancaId: n.id }) },
  saldo_devedor:      { icon: 'cash-outline',     color: '#D97706', bg: '#FFFBEB', tela: 'CobrancaDetail', params: (n) => ({ cobrancaId: n.id }) },
  conflito_sync:      { icon: 'sync-outline',     color: '#EA580C', bg: '#FFF7ED', tela: 'SyncStatus' },
  cobranca_gerada:    { icon: 'receipt-outline',  color: '#2563EB', bg: '#EFF6FF', tela: 'CobrancaDetail', params: (n) => ({ cobrancaId: n.id }) },
  manutencao_agendada:{ icon: 'construct-outline', color: '#16A34A', bg: '#F0FDF4', tela: 'ManutencoesList' },
  meta_atingida:      { icon: 'trophy-outline',   color: '#7C3AED', bg: '#F5F3FF', tela: 'MetasList' },
  email_falhou:       { icon: 'mail-outline',     color: '#DC2626', bg: '#FEF2F2' },
  info:               { icon: 'information-circle', color: '#2563EB', bg: '#EFF6FF' },
};

const DEFAULT_TIPO = {
  icon: 'notifications-outline' as keyof typeof Ionicons.glyphMap,
  color: '#64748B',
  bg: '#F1F5F9',
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function NotificacoesScreen() {
  const {
    notificacoes,
    unreadCount,
    carregando,
    erro,
    totalNotificacoes,
    isOperacao,
    carregar,
    marcarComoLida,
    marcarTodasComoLidas,
    refresh,
  } = useNotificacao();

  const navigation = useNavigation<any>();

  const [filtro, setFiltro] = React.useState<FiltroNotificacao>('todas');
  const [refreshing, setRefreshing] = React.useState(false);

  // ─── carregar na montagem ─────────────────────────────────────────────────
  useEffect(() => { carregar(); }, [carregar]);

  // ─── refresh ──────────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ─── marcar todas como lidas ──────────────────────────────────────────────
  const handleMarcarTodasLidas = useCallback(async () => {
    await marcarTodasComoLidas();
  }, [marcarTodasComoLidas]);

  // ─── navegar por tipo ─────────────────────────────────────────────────────
  const handleNotificacaoPress = useCallback(async (notificacao: Notificacao) => {
    // Marcar como lida
    if (!notificacao.lida) {
      marcarComoLida(notificacao.id);
    }

    // Navegar se o tipo tiver tela associada
    const cfg = TIPO_CONFIG[notificacao.tipo];
    if (cfg?.tela) {
      const params = cfg.params ? cfg.params(notificacao) : undefined;
      navigation.navigate(cfg.tela, params);
    }
  }, [marcarComoLida, navigation]);

  // ─── filtrar ──────────────────────────────────────────────────────────────
  const notificacoesFiltradas = notificacoes.filter(n => {
    if (filtro === 'naoLidas') return !n.lida;
    if (filtro === 'lidas') return n.lida;
    return true;
  });

  // ─── loading ──────────────────────────────────────────────────────────────
  if (carregando && notificacoes.length === 0) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando notificações...</Text>
      </View>
    );
  }

  const marcandoTodas = isOperacao('marcarTodasLidas');

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Filtros + ações */}
      <View style={s.headerRow}>
        <View style={s.filtrosContainer}>
          <FiltroChip
            label="Todas"
            active={filtro === 'todas'}
            onPress={() => setFiltro('todas')}
          />
          <FiltroChip
            label={`Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            active={filtro === 'naoLidas'}
            onPress={() => setFiltro('naoLidas')}
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
          <FiltroChip
            label="Lidas"
            active={filtro === 'lidas'}
            onPress={() => setFiltro('lidas')}
          />
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={[s.marcarTodasBtn, marcandoTodas && s.btnDisabled]}
            onPress={handleMarcarTodasLidas}
            disabled={marcandoTodas}
            activeOpacity={0.7}
          >
            {marcandoTodas ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Ionicons name="checkmark-done" size={16} color="#2563EB" />
            )}
            <Text style={s.marcarTodasText}>
              {marcandoTodas ? 'Marcando...' : 'Marcar todas'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
      {notificacoes.length > 0 && (
        <View style={s.resumoRow}>
          <Text style={s.resumoText}>
            {totalNotificacoes} notificação{totalNotificacoes !== 1 ? 'ões' : ''}
            {unreadCount > 0 ? ` • ${unreadCount} não lida${unreadCount !== 1 ? 's' : ''}` : ''}
          </Text>
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
          <NotificacaoCard
            notificacao={item}
            onMarcarLida={handleNotificacaoPress}
          />
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
  onMarcarLida: (n: Notificacao) => void;
}) {
  const cfg = TIPO_CONFIG[notificacao.tipo] || DEFAULT_TIPO;
  const hasNavigation = TIPO_CONFIG[notificacao.tipo]?.tela;

  return (
    <TouchableOpacity
      style={[s.card, !notificacao.lida && s.cardUnread]}
      onPress={() => onMarcarLida(notificacao)}
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
          <View style={s.cardFooter}>
            <Text style={s.cardData}>{formatarDataHora(notificacao.createdAt)}</Text>
            {hasNavigation && (
              <View style={s.navHint}>
                <Text style={s.navHintText}>Ver detalhes</Text>
                <Ionicons name="chevron-forward" size={12} color="#2563EB" />
              </View>
            )}
          </View>
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

  // Header
  headerRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filtrosContainer:{ flexDirection: 'row', gap: 8, flex: 1 },

  // Filtros
  filtroChip:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  filtroChipActive:{ backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filtroLabel:    { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filtroLabelActive:{ color: '#FFFFFF' },
  filtroBadge:    { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  filtroBadgeText:{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  // Marcar todas
  marcarTodasBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#EFF6FF' },
  marcarTodasText:{ fontSize: 12, fontWeight: '600', color: '#2563EB' },

  // Resumo
  resumoRow:      { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  resumoText:     { fontSize: 12, color: '#94A3B8' },

  // Erro
  erroCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  erroText:       { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:      { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  // Disabled
  btnDisabled:    { opacity: 0.5 },

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
  cardFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  cardData:       { fontSize: 11, color: '#94A3B8' },
  navHint:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navHintText:    { fontSize: 11, color: '#2563EB', fontWeight: '600' },

  // Empty
  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle:     { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:      { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
