/**
 * ManutencoesListScreen.tsx
 * Lista de manutenções com busca e filtros
 *
 * Funcionalidades:
 * - Busca por produto, cliente, descrição
 * - Filtro por tipo (trocaPano / manutencao)
 * - Pull-to-refresh
 * - Paginação com load more
 * - Navegação para formulário de nova manutenção
 * - Botão de nova manutenção (com permissão)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useManutencao } from '../contexts/ManutencaoContext';

// Hooks
import { usePaginatedList } from '../hooks/usePaginatedList';
import { usePermissionGuard } from '../hooks/usePermissionGuard';

// Types
import { Manutencao } from '../types';

// Navigation
import { ModalStackNavigationProp } from '../navigation/AppNavigator';

// ============================================================================
// HELPERS
// ============================================================================

const TIPO_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap }> = {
  trocaPano: {
    label: 'Troca de Pano',
    color: '#D97706',
    bgColor: '#FFFBEB',
    icon: 'swap-horizontal',
  },
  manutencao: {
    label: 'Manutenção',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    icon: 'build',
  },
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ManutencoesListScreen() {
  const navigation = useNavigation<ModalStackNavigationProp>();
  const { manutencoes, carregando, erro, carregar, refresh } = useManutencao();
  const { canDo } = usePermissionGuard();

  // Estado local
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'trocaPano' | 'manutencao'>('todos');

  // ==========================================================================
  // PAGINAÇÃO
  // ==========================================================================

  const {
    data: paginatedManutencoes,
    hasMore,
    loadMore,
    refresh: paginatedRefresh,
    isRefreshing,
    total,
  } = usePaginatedList<Manutencao>({
    fetchAll: async () => {
      await carregar();
      return manutencoes;
    },
    pageSize: 25,
    searchFields: ['produtoIdentificador', 'clienteNome', 'descricao'],
    searchTerm,
    filterFn: filtroTipo !== 'todos'
      ? (m: Manutencao) => m.tipo === filtroTipo
      : undefined,
    autoLoad: false,
  });

  // Recarregar dados quando a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      paginatedRefresh();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    await paginatedRefresh();
  }, [paginatedRefresh]);

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  const renderManutencao = useCallback(({ item }: { item: Manutencao }) => {
    const tipoInfo = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.manutencao;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name={tipoInfo.icon} size={20} color={tipoInfo.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.produtoIdentificador || `Produto ${item.produtoId.slice(0, 8)}`}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.clienteNome || 'Sem cliente vinculado'}
            </Text>
          </View>
          <View style={[styles.tipoBadge, { backgroundColor: tipoInfo.bgColor }]}>
            <View style={[styles.tipoDot, { backgroundColor: tipoInfo.color }]} />
            <Text style={[styles.tipoText, { color: tipoInfo.color }]}>{tipoInfo.label}</Text>
          </View>
        </View>

        {item.descricao ? (
          <Text style={styles.cardDescricao} numberOfLines={2}>
            {item.descricao}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.cardInfo}>
            <Ionicons name="calendar-outline" size={14} color="#64748B" />
            <Text style={styles.cardInfoText}>
              {formatDate(item.data)}
            </Text>
          </View>
          {item.produtoTipo ? (
            <View style={styles.cardInfo}>
              <Ionicons name="cube-outline" size={14} color="#64748B" />
              <Text style={styles.cardInfoText} numberOfLines={1}>
                {item.produtoTipo}
              </Text>
            </View>
          ) : null}
          {item.syncStatus && item.syncStatus !== 'synced' ? (
            <View style={styles.cardInfo}>
              <Ionicons
                name={item.syncStatus === 'error' ? 'alert-circle' : 'sync-outline'}
                size={14}
                color={item.syncStatus === 'error' ? '#DC2626' : '#D97706'}
              />
              <Text style={[styles.cardInfoText, { color: item.syncStatus === 'error' ? '#DC2626' : '#D97706' }]}>
                {item.syncStatus === 'pending' ? 'Pendente' : item.syncStatus === 'error' ? 'Erro' : 'Sincronizando'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }, []);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="build-outline" size={64} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhuma manutenção encontrada</Text>
      <Text style={styles.emptySubtitle}>
        {searchTerm ? 'Tente buscar por outro termo' : 'Registre a primeira manutenção'}
      </Text>
    </View>
  ), [searchTerm]);

  const renderFooter = useCallback(() => {
    if (hasMore) {
      return (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadMoreText}>Carregando mais...</Text>
        </View>
      );
    }
    return null;
  }, [hasMore]);

  const renderHeader = useCallback(() => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar produto, cliente, descrição..."
          placeholderTextColor="#94A3B8"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons name="close-circle" size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersRow}>
        {([
          { key: 'todos', label: 'Todos', icon: 'list' as keyof typeof Ionicons.glyphMap },
          { key: 'trocaPano', label: 'Troca de Pano', icon: 'swap-horizontal' as keyof typeof Ionicons.glyphMap },
          { key: 'manutencao', label: 'Manutenção', icon: 'build' as keyof typeof Ionicons.glyphMap },
        ] as const).map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              filtroTipo === filter.key && styles.filterChipActive,
            ]}
            onPress={() => setFiltroTipo(filter.key)}
          >
            <Ionicons
              name={filter.icon}
              size={16}
              color={filtroTipo === filter.key ? '#FFFFFF' : '#2563EB'}
            />
            <Text style={[
              styles.filterChipText,
              filtroTipo === filter.key && styles.filterChipTextActive,
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ), [searchTerm, filtroTipo]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (carregando && manutencoes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando manutenções...</Text>
      </View>
    );
  }

  // Permission guard
  if (!canDo('manutencoes')) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.forbiddenContainer}>
          <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
          <Text style={styles.forbiddenTitle}>Acesso restrito</Text>
          <Text style={styles.forbiddenSubtitle}>
            Você não tem permissão para visualizar manutenções
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manutenções</Text>
        <Text style={styles.headerSubtitle}>
          {total} registro(s)
        </Text>
      </View>

      {/* Lista com paginação */}
      <FlatList
        data={paginatedManutencoes}
        renderItem={renderManutencao}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[
          styles.listContent,
          paginatedManutencoes.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Botão Nova Manutenção (com permissão) */}
      {canDo('manutencoes', 'create') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('ManutencaoForm', { modo: 'criar' })}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#64748B',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tipoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDescricao: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 18,
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
  forbiddenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  forbiddenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
  },
  forbiddenSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
});
