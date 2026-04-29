/**
 * CobrancasListScreen.tsx
 * Lista de cobranças pendentes e histórico
 *
 * REFACTORED: Usa usePaginatedList + ExportService + usePermissionGuard
 * - Paginação cursor-based em memória
 * - Exportação CSV via ExportService
 * - Permission guards client-side
 *
 * Funcionalidades:
 * - Lista de cobranças por rota/cliente
 * - Filtros por status (pendente, pago, atrasado)
 * - Pull-to-refresh
 * - Navegação para confirmação de cobrança
 * - Resumo de valores
 * - Exportação CSV
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
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { CobrancasStackParamList } from '../navigation/CobrancasStack';
import { SafeAreaView } from 'react-native-safe-area-context';

// Hooks
import { usePermissionGuard } from '../hooks/usePermissionGuard';
import { usePaginatedList } from '../hooks/usePaginatedList';

// Services
import ExportService from '../services/ExportService';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useCobranca } from '../contexts/CobrancaContext';
import { useDashboard } from '../contexts/DashboardContext';

// Types
import { HistoricoCobranca, StatusPagamento } from '../types';
import { CobrancasStackNavigationProp } from '../navigation/CobrancasStack';

// Components
import { useCobrancaNavigate } from '../navigation/CobrancasStack';
import { COBRANCA_FILTROS } from '../navigation/CobrancasStack';

// Utils
import { formatarMoeda } from '../utils/currency';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CobrancasListScreen() {
  const navigation = useNavigation<CobrancasStackNavigationProp>();
  const navigateCobranca = useCobrancaNavigate();
  const route = useRoute<RouteProp<CobrancasStackParamList, 'CobrancasList'>>();
  const { user, hasPermission, canAccessRota } = useAuth();
  const { canDo } = usePermissionGuard();
  const { cobrancas, carregando, erro, carregarCobrancas, refresh, totalPendentes } = useCobranca();

  // Estado local
  const [filtroStatus, setFiltroStatus] = useState<StatusPagamento | 'todas'>('todas');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ==========================================================================
  // PAGINAÇÃO
  // ==========================================================================

  const filterFn = useCallback((c: any) => {
    // Filtro por status
    if (filtroStatus !== 'todas' && c.status !== filtroStatus) return false;
    return true;
  }, [filtroStatus]);

  const {
    data: paginatedCobrancas,
    allData: filteredCobrancas,
    total: totalFiltered,
    hasMore,
    loadMore,
    refresh: refreshPaginated,
  } = usePaginatedList<HistoricoCobranca>({
    fetchAll: async () => cobrancas,
    pageSize: 30,
    searchFields: ['clienteNome', 'produtoIdentificador'],
    filterFn,
    autoLoad: false,
  });

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      const params = route?.params;
      const filtros: any = {};
      if (params?.filtroCliente)  filtros.clienteId = params.filtroCliente;
      if (params?.filtroRota)     filtros.rotaId    = params.filtroRota;
      carregarCobrancas(Object.keys(filtros).length > 0 ? filtros : undefined);
      // Apply status filter from params
      if (params?.filtroStatus)   setFiltroStatus(params.filtroStatus);
    }, [carregarCobrancas, route?.params])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await refreshPaginated();
    setRefreshing(false);
  }, [refresh, refreshPaginated]);

  // ==========================================================================
  // FILTRAGEM — delegada ao usePaginatedList
  // ==========================================================================
  // A filtragem por filtroStatus é feita pelo usePaginatedList via filterFn.

  // ==========================================================================
  // EXPORTAÇÃO CSV
  // ==========================================================================

  const handleExportCSV = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await ExportService.exportCSV(
        filteredCobrancas,
        'cobrancas',
        ExportService.constructor.COBRANCA_COLUMNS || ExportService['COBRANCA_COLUMNS'] || [
          { key: 'clienteNome', header: 'Cliente' },
          { key: 'produtoIdentificador', header: 'Produto' },
          { key: 'dataInicio', header: 'Data Início' },
          { key: 'fichasRodadas', header: 'Fichas' },
          { key: 'totalClientePaga', header: 'Total', format: (v: number) => formatarMoeda(v) },
          { key: 'valorRecebido', header: 'Recebido', format: (v: number) => formatarMoeda(v) },
          { key: 'status', header: 'Status' },
        ],
        { title: 'Relatório de Cobranças' }
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar os dados');
    } finally {
      setExporting(false);
    }
  }, [filteredCobrancas, exporting]);

  // ==========================================================================
  // RENDERIZAÇÃO DE ITENS
  // ==========================================================================

  const renderCobranca = useCallback(({ item }: { item: HistoricoCobranca }) => {
    const statusConfig = {
      Pago: { color: '#16A34A', bg: '#F0FDF4', label: 'Pago' },
      Pendente: { color: '#EA580C', bg: '#FFFBEB', label: 'Pendente' },
      Parcial: { color: '#2563EB', bg: '#DBEAFE', label: 'Parcial' },
      Atrasado: { color: '#DC2626', bg: '#FEF2F2', label: 'Atrasado' },
    };

    const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.Pendente;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigateCobranca.toDetail(String(item.id), String(item.locacaoId ?? ''))}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.produtoInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.produtoIdentificador}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.clienteNome}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#64748B" />
            <Text style={styles.infoText}>
              {new Date(item.dataInicio).toLocaleDateString('pt-BR')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="timer-outline" size={16} color="#64748B" />
            <Text style={styles.infoText}>
              {item.fichasRodadas} fichas
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.footerLabel}>Total</Text>
            <Text style={styles.footerValue}>{formatarMoeda(item.totalClientePaga)}</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.footerLabel}>Recebido</Text>
            <Text style={[styles.footerValue, { color: '#16A34A' }]}>
              {formatarMoeda(item.valorRecebido)}
            </Text>
          </View>
          {item.saldoDevedorGerado > 0 && (
            <View style={styles.footerRight}>
              <Text style={styles.footerLabel}>Saldo</Text>
              <Text style={[styles.footerValue, { color: '#DC2626' }]}>
                {formatarMoeda(item.saldoDevedorGerado)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [navigateCobranca]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cash-outline" size={64} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhuma cobrança encontrada</Text>
      <Text style={styles.emptySubtitle}>
        {filtroStatus !== 'todas' ? 'Tente ajustar os filtros' : 'Não há cobranças registradas'}
      </Text>
    </View>
  ), [filtroStatus]);

  const renderHeader = useCallback(() => (
    <View style={styles.headerContent}>
      {/* Resumo */}
      <View style={styles.resumoContainer}>
        <View style={styles.resumoCard}>
          <Text style={styles.resumoLabel}>Pendentes</Text>
          <Text style={[styles.resumoValue, { color: '#EA580C' }]}>
            {totalPendentes}
          </Text>
        </View>
        <View style={styles.resumoCard}>
          <Text style={styles.resumoLabel}>Recebidas</Text>
          <Text style={[styles.resumoValue, { color: '#16A34A' }]}>
            {cobrancas.filter(c => c.status === 'Pago').length}
          </Text>
        </View>
      </View>

      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScroll}
      >
        {COBRANCA_FILTROS.STATUS.map((filtro) => (
          <TouchableOpacity
            key={filtro.value}
            style={[
              styles.filterChip,
              filtroStatus === filtro.value && styles.filterChipActive,
            ]}
            onPress={() => setFiltroStatus(filtro.value as any)}
          >
            <Text
              style={[
                styles.filterChipText,
                filtroStatus === filtro.value && styles.filterChipTextActive,
              ]}
            >
              {filtro.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  ), [totalPendentes, cobrancas, filtroStatus]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (carregando && cobrancas.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando cobranças...</Text>
      </View>
    );

  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Cobranças</Text>
            <Text style={styles.headerSubtitle}>
              {totalFiltered} cobrança(s)
            </Text>
          </View>
          {/* Export CSV button */}
          {canDo('cobrancasFaturas') && filteredCobrancas.length > 0 && (
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportCSV}
              disabled={exporting}
              activeOpacity={0.7}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#2563EB" />
              )}
              <Text style={styles.exportButtonText}>CSV</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista */}
      <FlatList
        data={paginatedCobrancas}
        renderItem={renderCobranca}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          paginatedCobrancas.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        onEndReached={() => hasMore && loadMore()}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      {/* Botão Nova Cobrança (com permissão) */}
      {canDo('cobrancasFaturas', 'create') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigateCobranca.toRotas()}
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

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
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
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Header Content
  headerContent: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },

  // Resumo
  resumoContainer: {
    flexDirection: 'row',
    gap: 12,
  },  resumoCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resumoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  resumoValue: {
    fontSize: 24,
    fontWeight: '700',
  },

  // Filters
  filtersScroll: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // List
  listContent: {
    padding: 16,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },

  // Card
  card: {    backgroundColor: '#FFFFFF',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  produtoInfo: {
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
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },  infoText: {
    fontSize: 13,
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  footerRight: {
    alignItems: 'flex-end',
  },

  // Empty State
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

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,    width: 56,
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

  // Error
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