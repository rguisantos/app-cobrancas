/**
 * MetasListScreen.tsx
 * Lista de metas com filtros por tipo e status
 *
 * Funcionalidades:
 * - Filtro por tipo (receita, cobrancas, adimplencia)
 * - Filtro por status (ativa, atingida, expirada)
 * - Card com progresso visual (valorAtual/valorMeta)
 * - Pull-to-refresh
 * - Navegação para formulário de criação/edição
 * - Permission guard: relatorios
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useMeta } from '../contexts/MetaContext';

// Hooks
import { usePermissionGuard } from '../hooks/usePermissionGuard';

// Types
import { Meta, TipoMeta, StatusMeta } from '../types';

// Utils
import { formatarMoeda } from '../utils/currency';
import { dateISOtoBR } from '../utils/database';

// Components
import FilterChip from '../components/FilterChip';

// ============================================================================
// TIPOS
// ============================================================================

type FiltroTipo = TipoMeta | 'todos';
type FiltroStatus = StatusMeta | 'todos';

// ============================================================================
// HELPERS
// ============================================================================

const TIPO_LABELS: Record<TipoMeta, string> = {
  receita: 'Receita',
  cobrancas: 'Cobranças',
  adimplencia: 'Adimplência',
};

const TIPO_ICONS: Record<TipoMeta, keyof typeof Ionicons.glyphMap> = {
  receita: 'trending-up',
  cobrancas: 'cash-outline',
  adimplencia: 'checkmark-done',
};

const STATUS_COLORS: Record<StatusMeta, string> = {
  ativa: '#16A34A',
  atingida: '#2563EB',
  expirada: '#64748B',
};

const STATUS_LABELS: Record<StatusMeta, string> = {
  ativa: 'Ativa',
  atingida: 'Atingida',
  expirada: 'Expirada',
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MetasListScreen() {
  const navigation = useNavigation<any>();
  const { metas, carregando, erro, carregar, refresh } = useMeta();
  const { canDo } = usePermissionGuard();

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');

  // Permissão
  const podeVer = canDo('relatorios');
  const podeCriar = canDo('relatorios', 'create');

  // ==========================================================================
  // FILTRAGEM
  // ==========================================================================

  const metasFiltradas = metas.filter((meta) => {
    if (filtroTipo !== 'todos' && meta.tipo !== filtroTipo) return false;
    if (filtroStatus !== 'todos' && meta.status !== filtroStatus) return false;
    return true;
  });

  // ==========================================================================
  // FOCUS EFFECT
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  const renderMeta = useCallback(({ item }: { item: Meta }) => {
    const progresso = item.valorMeta > 0
      ? Math.min((item.valorAtual / item.valorMeta) * 100, 100)
      : 0;
    const progressoCor = progresso >= 100 ? '#16A34A' : progresso >= 70 ? '#F59E0B' : '#2563EB';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('MetaForm', {
          modo: 'editar',
          metaId: item.id,
        })}
        activeOpacity={0.7}
      >
        {/* Header do Card */}
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.tipoBadge, { backgroundColor: `${STATUS_COLORS[item.status]}15` }]}>
              <Ionicons
                name={TIPO_ICONS[item.tipo]}
                size={14}
                color={STATUS_COLORS[item.status]}
              />
              <Text style={[styles.tipoBadgeText, { color: STATUS_COLORS[item.status] }]}>
                {TIPO_LABELS[item.tipo]}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}15` }]}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
          </View>
          <Text style={styles.cardNome} numberOfLines={1}>
            {item.nome}
          </Text>
        </View>

        {/* Progresso */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progresso</Text>
            <Text style={styles.progressPercent}>
              {progresso.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progresso}%`, backgroundColor: progressoCor },
              ]}
            />
          </View>
          <View style={styles.progressValues}>
            <Text style={styles.progressValueText}>
              {formatarMoeda(item.valorAtual)}
            </Text>
            <Text style={styles.progressMetaText}>
              de {formatarMoeda(item.valorMeta)}
            </Text>
          </View>
        </View>

        {/* Período */}
        <View style={styles.cardFooter}>
          <View style={styles.cardInfo}>
            <Ionicons name="calendar-outline" size={14} color="#64748B" />
            <Text style={styles.cardInfoText}>
              {dateISOtoBR(item.dataInicio)} — {dateISOtoBR(item.dataFim)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="flag-outline" size={64} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhuma meta encontrada</Text>
      <Text style={styles.emptySubtitle}>
        {filtroTipo !== 'todos' || filtroStatus !== 'todos'
          ? 'Tente alterar os filtros'
          : 'Crie sua primeira meta'}
      </Text>
    </View>
  ), [filtroTipo, filtroStatus]);

  const renderHeader = useCallback(() => (
    <View style={styles.filtersContainer}>
      {/* Filtro Tipo */}
      <Text style={styles.filterLabel}>Tipo</Text>
      <View style={styles.filterRow}>
        <FilterChip
          label="Todos"
          selected={filtroTipo === 'todos'}
          onPress={() => setFiltroTipo('todos')}
        />
        {(['receita', 'cobrancas', 'adimplencia'] as TipoMeta[]).map((tipo) => (
          <FilterChip
            key={tipo}
            label={TIPO_LABELS[tipo]}
            selected={filtroTipo === tipo}
            onPress={() => setFiltroTipo(tipo)}
            icon={TIPO_ICONS[tipo]}
          />
        ))}
      </View>

      {/* Filtro Status */}
      <Text style={styles.filterLabel}>Status</Text>
      <View style={styles.filterRow}>
        <FilterChip
          label="Todos"
          selected={filtroStatus === 'todos'}
          onPress={() => setFiltroStatus('todos')}
        />
        {(['ativa', 'atingida', 'expirada'] as StatusMeta[]).map((status) => (
          <FilterChip
            key={status}
            label={STATUS_LABELS[status]}
            selected={filtroStatus === status}
            onPress={() => setFiltroStatus(status)}
          />
        ))}
      </View>
    </View>
  ), [filtroTipo, filtroStatus]);

  // ==========================================================================
  // LOADING
  // ==========================================================================

  if (carregando && metas.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando metas...</Text>
      </View>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Metas</Text>
        <Text style={styles.headerSubtitle}>
          {metasFiltradas.length} meta(s)
        </Text>
      </View>

      {/* Lista */}
      <FlatList
        data={metasFiltradas}
        renderItem={renderMeta}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          metasFiltradas.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={carregando}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB Novo */}
      {podeCriar && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('MetaForm', { modo: 'criar' })}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Erro */}
      {erro && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={24} color="#DC2626" />
          <Text style={styles.errorText}>{erro}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
  },
  progressValueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressMetaText: {
    fontSize: 13,
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cardInfoText: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  errorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FEF2F2',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 14,
  },
  retryText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
});
