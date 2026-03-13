/**
 * CobrancasListScreen.tsx
 * Lista de cobranças pendentes e histórico
 * 
 * Funcionalidades:
 * - Lista de cobranças por rota/cliente
 * - Filtros por status (pendente, pago, atrasado)
 * - Pull-to-refresh
 * - Navegação para confirmação de cobrança
 * - Resumo de valores
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const navigateCobranca = useCobrancaNavigate();  const { user, hasPermission, canAccessRota } = useAuth();
  const { cobrancas, carregando, erro, carregarCobrancas, refresh, totalPendentes } = useCobranca();

  // Estado local
  const [filtroStatus, setFiltroStatus] = useState<StatusPagamento | 'todas'>('todas');
  const [refreshing, setRefreshing] = useState(false);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      carregarCobrancas();
    }, [carregarCobrancas])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ==========================================================================
  // FILTRAGEM
  // ==========================================================================

  const cobrancasFiltradas = useCallback(() => {
    let filtradas = cobrancas;

    // Filtro por status
    if (filtroStatus !== 'todas') {
      filtradas = filtradas.filter(c => c.status === filtroStatus);
  
  }

    // Filtro por permissão de rota (se não for admin)
    if (user?.tipoPermissao !== 'Administrador') {
      // Implementar filtro por rota permitida
  
  }

    return filtradas;
  }, [cobrancas, filtroStatus, user]);

  // ==========================================================================
  // RENDERIZAÇÃO DE ITENS
  // ==========================================================================

  const renderCobranca = useCallback(({ item }: { item: HistoricoCobranca }) => {
    const statusConfig = {
      Pago: { color: '#16A34A', bg: '#F0FDF4', label: 'Pago' },      Pendente: { color: '#EA580C', bg: '#FFFBEB', label: 'Pendente' },
      Parcial: { color: '#2563EB', bg: '#DBEAFE', label: 'Parcial' },
      Atrasado: { color: '#DC2626', bg: '#FEF2F2', label: 'Atrasado' },
    };

    const config = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.Pendente;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigateCobranca.toDetail(item.id)}
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
          </View>          <View style={styles.footerRight}>
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
        horizontal        showsHorizontalScrollIndicator={false}
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
        <Text style={styles.headerTitle}>Cobranças</Text>
        <Text style={styles.headerSubtitle}>
          {cobrancasFiltradas().length} cobrança(s)
        </Text>
      </View>

      {/* Lista */}      <FlatList
        data={cobrancasFiltradas()}
        renderItem={renderCobranca}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          cobrancasFiltradas().length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
      
  }
        showsVerticalScrollIndicator={false}
      />

      {/* Botão Nova Cobrança (com permissão) */}
      {(user?.tipoPermissao === 'Administrador' || hasPermission('cobrancasFaturas', 'mobile')) && (
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