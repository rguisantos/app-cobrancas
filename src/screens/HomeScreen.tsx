/**
 * HomeScreen.tsx
 * Tela inicial do aplicativo mobile - Dashboard
 * 
 * Funcionalidades:
 * - Saudação personalizada (Bom dia, Boa tarde, Boa noite)
 * - Métricas rápidas (Clientes, Cobranças Pendentes, Produtos)
 * - Acesso rápido às principais funções
 * - Status de sincronização
 * - Atalhos para módulos (Clientes, Produtos, Cobranças)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useDashboard } from '../contexts/DashboardContext';
import { useSync } from '../contexts/SyncContext';

// Types
import { AppTabsNavigationProp } from '../navigation/AppNavigator';

// Components
import MetricCard from '../components/MetricCard';
import QuickAction from '../components/QuickAction';
import SyncIndicator from '../components/SyncIndicator';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface QuickActionItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: keyof AppTabsNavigationProp;
  color: string;
  permission?: boolean;}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function HomeScreen() {
  const navigation = useNavigation<AppTabsNavigationProp>();
  
  // Contexts
  const { user, logout, isAdmin, hasPermission } = useAuth();
  const { mobile, metricas, carregando, erro, refresh } = useDashboard();
  const { 
    status: syncStatus, 
    isSyncing, 
    lastSyncAt, 
    mudancasPendentes,
    sincronizar 
  } = useSync();

  // Estado local
  const [refreshing, setRefreshing] = useState(false);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  /**
   * Atualiza dashboard com pull-to-refresh
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  /**
   * Navega para módulo específico
   */
  const navigateToModule = useCallback((module: keyof AppTabsNavigationProp) => {
    navigation.navigate(module);
  }, [navigation]);

  /**
   * Força sincronização manual
   */
  const handleSync = useCallback(async () => {
    await sincronizar(true);
  }, [sincronizar]);
  // ==========================================================================
  // DADOS COMPUTADOS
  // ==========================================================================

  /**
   * Ações rápidas baseadas em permissões
   */
  const quickActions: QuickActionItem[] = [
    {
      id: 'clientes',
      title: 'Clientes',
      icon: 'people',
      screen: 'Clientes',
      color: '#2563EB',
      permission: isAdmin() || hasPermission('todosCadastros', 'mobile'),
    },
    {
      id: 'produtos',
      title: 'Produtos',
      icon: 'cube',
      screen: 'Produtos',
      color: '#16A34A',
      permission: isAdmin() || hasPermission('todosCadastros', 'mobile'),
    },
    {
      id: 'cobrancas',
      title: 'Cobranças',
      icon: 'cash',
      screen: 'Cobrancas',
      color: '#DC2626',
      permission: isAdmin() || hasPermission('cobrancasFaturas', 'mobile'),
    },
    {
      id: 'locacoes',
      title: 'Locações',
      icon: 'swap-horizontal',
      screen: 'Clientes', // Navega para Clientes > Locações
      color: '#9333EA',
      permission: isAdmin() || hasPermission('locacaoRelocacaoEstoque', 'mobile'),
    },
  ].filter(action => action.permission !== false);

  /**
   * Formata saudação baseada no horário
   */
  const getSaudacao = (): string => {
    return mobile?.saudacao || 'Olá';
  };

  /**   * Formata data da última sincronização
   */
  const formatarSyncTime = (): string => {
    if (!lastSyncAt) return 'Nunca';
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} h atrás`;
    return `${Math.floor(diffMinutes / 1440)} d atrás`;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (carregando && !mobile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      >
        {/* ========================================================================== */}
        {/* HEADER - SAUDAÇÃO E PERFIL */}
        {/* ========================================================================== */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>{getSaudacao()}</Text>
              <Text style={styles.userName}>{user?.nome || 'Usuário'}</Text>
              <Text style={styles.userRole}>{user?.tipoPermissao || 'Administrador'}</Text>            </View>
            
            <TouchableOpacity 
              style={styles.syncButton}
              onPress={handleSync}
              disabled={isSyncing}
            >
              <SyncIndicator 
                status={syncStatus}
                isSyncing={isSyncing}
                size="small"
              />
            </TouchableOpacity>
          </View>

          {/* Status de sincronização */}
          <View style={styles.syncStatus}>
            <Ionicons 
              name={syncStatus === 'synced' ? 'checkmark-circle' : 'cloud-outline'} 
              size={16} 
              color={syncStatus === 'synced' ? '#16A34A' : '#64748B'} 
            />
            <Text style={styles.syncStatusText}>
              {isSyncing ? 'Sincronizando...' : `Sync: ${formatarSyncTime()}`}
            </Text>
            {mudancasPendentes > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{mudancasPendentes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ========================================================================== */}
        {/* MÉTRICAS PRINCIPAIS */}
        {/* ========================================================================== */}
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Visão Geral</Text>
          
          <View style={styles.metricsGrid}>
            {/* Clientes */}
            <MetricCard
              title="Clientes"
              value={metricas?.totalClientes || 0}
              icon="people"
              color="#2563EB"
              onPress={() => navigateToModule('Clientes')}
            />

            {/* Cobranças Pendentes */}            <MetricCard
              title="Cobranças Pendentes"
              value={metricas?.cobrancasPendentes || 0}
              icon="alert-circle"
              color="#DC2626"
              onPress={() => navigateToModule('Cobrancas')}
              badge={metricas?.cobrancasPendentes || 0}
            />

            {/* Produtos */}
            <MetricCard
              title="Produtos"
              value={metricas?.totalProdutos || 0}
              icon="cube"
              color="#16A34A"
              onPress={() => navigateToModule('Produtos')}
            />

            {/* Produtos Locados */}
            <MetricCard
              title="Produtos Locados"
              value={metricas?.produtosLocados || 0}
              icon="swap-horizontal"
              color="#9333EA"
              onPress={() => navigateToModule('Clientes')}
            />
          </View>
        </View>

        {/* ========================================================================== */}
        {/* AÇÕES RÁPIDAS */}
        {/* ========================================================================== */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <QuickAction
                key={action.id}
                title={action.title}
                icon={action.icon}
                color={action.color}
                onPress={() => navigateToModule(action.screen)}
              />
            ))}
          </View>
        </View>

        {/* ========================================================================== */}
        {/* ALERTAS E NOTIFICAÇÕES */}        {/* ========================================================================== */}
        {erro && (
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={20} color="#DC2626" />
            <Text style={styles.errorText}>{erro}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Espaço extra no final */}
        <View style={styles.footer} />
      </ScrollView>

      {/* ========================================================================== */}
      {/* BOTÃO DE LOGOUT (opcional, pode estar no menu Mais) */}
      {/* ========================================================================== */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="#64748B" />
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },  scrollContent: {
    padding: 16,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  greeting: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  userRole: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 4,
    backgroundColor: '#DBEAFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  syncButton: {
    padding: 8,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncStatusText: {
    fontSize: 12,    color: '#64748B',
  },
  pendingBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Sections
  metricsSection: {
    marginBottom: 24,
  },
  actionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Error Card
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
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

  // Footer
  footer: {
    height: 40,
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  logoutText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});