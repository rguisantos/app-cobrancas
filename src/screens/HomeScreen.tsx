/**
 * HomeScreen.tsx
 * Dashboard principal do aplicativo
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth }      from '../contexts/AuthContext';
import { useDashboard } from '../contexts/DashboardContext';
import { useSync }      from '../contexts/SyncContext';
import { AppTabsParamList } from '../navigation/AppNavigator';
import MetricCard  from '../components/MetricCard';
import QuickAction from '../components/QuickAction';
import SyncIndicator from '../components/SyncIndicator';

// ─── helper: saudação ───────────────────────────────────────────────────────
function getSaudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatSyncTime(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Nunca';
  const diff = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 60000);
  if (diff < 1)    return 'Agora mesmo';
  if (diff < 60)   return `${diff} min atrás`;
  if (diff < 1440) return `${Math.floor(diff / 60)} h atrás`;
  return `${Math.floor(diff / 1440)} d atrás`;
}

// ─── componente ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();
  const { user, isAdmin, hasPermission } = useAuth();
  const { metricas, carregando, erro, refresh } = useDashboard();
  const { status: syncStatus, isSyncing, lastSyncAt, mudancasPendentes, sincronizar } = useSync();

  const [refreshing, setRefreshing] = useState(false);

  // Recarrega ao focar a tab
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const nav = useCallback((tab: keyof AppTabsParamList) => {
    navigation.navigate(tab as any);
  }, [navigation]);

  const navModal = useCallback((screen: string, params?: any) => {
    const parent = navigation.getParent();
    if (parent) (parent as any).navigate(screen, params);
  }, [navigation]);

  // ─── ações rápidas baseadas em permissões ───────────────────────────────
  const podeCadastrar  = isAdmin() || hasPermission('todosCadastros', 'mobile');
  const podeLocar      = isAdmin() || hasPermission('locacaoRelocacaoEstoque', 'mobile');
  const podeCobrar     = isAdmin() || hasPermission('cobrancasFaturas', 'mobile');
  const podeRelogio    = isAdmin() || hasPermission('alteracaoRelogio', 'mobile');

  if (carregando && !metricas) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} tintColor="#2563EB" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.saudacao}>{getSaudacao()},</Text>
            <Text style={s.nomeUsuario}>{user?.nome || 'Usuário'}</Text>
            <View style={s.permTag}>
              <Text style={s.permTagText}>{user?.tipoPermissao || 'Administrador'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.syncBtn}
            onPress={() => sincronizar(true)}
            disabled={isSyncing}
          >
            <SyncIndicator status={syncStatus} isSyncing={isSyncing} size="small" />
          </TouchableOpacity>
        </View>

        {/* status sync */}
        <View style={s.syncRow}>
          <Ionicons
            name={syncStatus === 'synced' ? 'checkmark-circle' : isSyncing ? 'sync' : 'cloud-outline'}
            size={14}
            color={syncStatus === 'synced' ? '#16A34A' : '#64748B'}
          />
          <Text style={s.syncText}>
            {isSyncing ? 'Sincronizando...' : `Última sync: ${formatSyncTime(lastSyncAt)}`}
          </Text>
          {mudancasPendentes > 0 && (
            <View style={s.pendBadge}><Text style={s.pendBadgeText}>{mudancasPendentes}</Text></View>
          )}
        </View>

        {/* ── MÉTRICAS ──────────────────────────────────────────────── */}
        <Text style={s.secTitle}>Visão Geral</Text>
        <View style={s.metricsGrid}>
          <MetricCard
            title="Clientes Ativos"
            value={metricas?.totalClientes || 0}
            icon="people"
            color="#2563EB"
            onPress={() => nav('Clientes')}
          />
          <MetricCard
            title="Cobranças Pendentes"
            value={metricas?.cobrancasPendentes || 0}
            icon="alert-circle"
            color="#DC2626"
            badge={metricas?.cobrancasPendentes || 0}
            onPress={() => nav('Cobrancas')}
          />
          <MetricCard
            title="Total Produtos"
            value={metricas?.totalProdutos || 0}
            icon="cube"
            color="#16A34A"
            onPress={() => nav('Produtos')}
          />
          <MetricCard
            title="Produtos Locados"
            value={metricas?.produtosLocados || 0}
            icon="swap-horizontal"
            color="#9333EA"
            onPress={() => nav('Produtos')}
          />
        </View>

        {/* ── AÇÕES RÁPIDAS ───────────────────────────────────────────── */}
        <Text style={s.secTitle}>Ações Rápidas</Text>
        <View style={s.actionsGrid}>
          {podeCadastrar && (
            <QuickAction
              title="Novo Cliente"
              icon="person-add"
              color="#2563EB"
              onPress={() => navModal('ClienteForm', { modo: 'criar' })}
            />
          )}
          {podeLocar && (
            <QuickAction
              title="Nova Locação"
              icon="add-circle"
              color="#9333EA"
              onPress={() => nav('Clientes')}
            />
          )}
          {podeCobrar && (
            <QuickAction
              title="Realizar Cobrança"
              icon="cash"
              color="#16A34A"
              onPress={() => nav('Cobrancas')}
            />
          )}
          {podeCadastrar && (
            <QuickAction
              title="Novo Produto"
              icon="cube"
              color="#EA580C"
              onPress={() => navModal('ProdutoForm', { modo: 'criar' })}
            />
          )}
          {podeRelogio && (
            <QuickAction
              title="Alterar Relógio"
              icon="timer"
              color="#0891B2"
              onPress={() => nav('Produtos')}
            />
          )}
          {isAdmin() && (
            <QuickAction
              title="Configurações"
              icon="settings"
              color="#64748B"
              onPress={() => navModal('Settings')}
            />
          )}
        </View>

        {/* ── ERRO ──────────────────────────────────────────────────── */}
        {erro && (
          <View style={s.errorCard}>
            <Ionicons name="warning" size={18} color="#DC2626" />
            <Text style={s.errorText}>{erro}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── estilos ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText:     { marginTop: 16, color: '#64748B', fontSize: 16 },
  scroll:          { padding: 16 },

  // header
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  headerLeft:      { flex: 1 },
  saudacao:        { fontSize: 14, color: '#64748B', fontWeight: '500' },
  nomeUsuario:     { fontSize: 26, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  permTag:         { alignSelf: 'flex-start', backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
  permTagText:     { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  syncBtn:         { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 10, marginTop: 4 },

  // sync row
  syncRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  syncText:        { fontSize: 12, color: '#64748B' },
  pendBadge:       { backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  pendBadgeText:   { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  // sections
  secTitle:        { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 14 },

  // grids
  metricsGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: -4, marginBottom: 28 },
  actionsGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: -4, marginBottom: 16 },

  // error
  errorCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', padding: 14, borderRadius: 12, marginBottom: 16 },
  errorText:       { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:       { color: '#2563EB', fontSize: 14, fontWeight: '600' },
});
