/**
 * HomeScreen.tsx
 * Dashboard principal do aplicativo com cards dinâmicos e layout otimizado
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
  Dimensions, FlatList,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth }      from '../contexts/AuthContext';
import { useDashboard } from '../contexts/DashboardContext';
import { useSync }      from '../contexts/SyncContext';
import { AppTabsParamList } from '../navigation/AppNavigator';
import SyncIndicator from '../components/SyncIndicator';
import { formatarMoeda } from '../utils/currency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;

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

// ─── Card do Carrossel ───────────────────────────────────────────────────────
interface DashboardCard {
  id: string;
  title: string;
  value: number | string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  onPress?: () => void;
  isMoney?: boolean;
}

function CarouselCard({ card }: { card: DashboardCard }) {
  const displayValue = card.isMoney && typeof card.value === 'number'
    ? formatarMoeda(card.value)
    : typeof card.value === 'number' ? card.value.toLocaleString('pt-BR') : card.value;

  return (
    <TouchableOpacity 
      style={[s.carouselCard, { backgroundColor: card.bg }]}
      onPress={card.onPress}
      activeOpacity={0.85}
    >
      <View style={s.carouselCardTop}>
        <View style={[s.cardIconWrap, { backgroundColor: card.color + '25' }]}>
          <Ionicons name={card.icon} size={24} color={card.color} />
        </View>
        <Text style={s.cardTitle}>{card.title}</Text>
      </View>
      <View style={s.carouselCardBottom}>
        <Text style={[s.cardValue, { color: card.color }]}>
          {displayValue}
        </Text>
        {card.subtitle && <Text style={s.cardSubtitle}>{card.subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Mini Card para métricas secundárias ─────────────────────────────────────
interface MiniMetric {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

function MiniCard({ metric }: { metric: MiniMetric }) {
  return (
    <View style={s.miniCard}>
      <View style={[s.miniIconWrap, { backgroundColor: metric.color + '15' }]}>
        <Ionicons name={metric.icon} size={16} color={metric.color} />
      </View>
      <View style={s.miniContent}>
        <Text style={s.miniValue}>{metric.value}</Text>
        <Text style={s.miniLabel}>{metric.label}</Text>
      </View>
    </View>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();
  const { user, isAdmin, hasPermission } = useAuth();
  const { metricas, carregando, erro, refresh } = useDashboard();
  const { status: syncStatus, isSyncing, lastSyncAt, mudancasPendentes, sincronizar } = useSync();

  const [refreshing, setRefreshing] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ─── permissões ───────────────────────────────────────────────────────────
  const podeCadastrarCliente = isAdmin() || hasPermission('clientes', 'mobile');
  const podeCadastrarProduto = isAdmin() || hasPermission('produtos', 'mobile');
  const podeLocar      = isAdmin() || hasPermission('locacaoRelocacaoEstoque', 'mobile');
  const podeCobrar     = isAdmin() || hasPermission('cobrancasFaturas', 'mobile');
  const podeRelogio    = isAdmin() || hasPermission('alteracaoRelogio', 'mobile');

  // ─── cards principais do carrossel ─────────────────────────────────────────
  const dashboardCards: DashboardCard[] = [
    {
      id: 'recebidoHoje',
      title: 'Recebido Hoje',
      value: metricas?.totalRecebidoHoje || 0,
      subtitle: `${metricas?.cobrancasHoje || 0} cobranças`,
      icon: 'cash',
      color: '#16A34A',
      bg: '#F0FDF4',
      onPress: () => navModal('RelatorioCobrancas'),
      isMoney: true,
    },
    {
      id: 'recebidoMes',
      title: 'Recebido no Mês',
      value: metricas?.totalRecebidoMes || 0,
      subtitle: 'Total do mês atual',
      icon: 'trending-up',
      color: '#2563EB',
      bg: '#EFF6FF',
      onPress: () => navModal('RelatorioCobrancas'),
      isMoney: true,
    },
    {
      id: 'saldoDevedor',
      title: 'Saldo Devedor',
      value: metricas?.saldoDevedor || 0,
      subtitle: 'Valores pendentes',
      icon: 'alert-circle',
      color: '#DC2626',
      bg: '#FEF2F2',
      onPress: () => navModal('RelatorioSaldoDevedor'),
      isMoney: true,
    },
    {
      id: 'produtosLocados',
      title: 'Produtos Locados',
      value: metricas?.produtosLocados || 0,
      subtitle: `${metricas?.produtosEstoque || 0} em estoque`,
      icon: 'cube',
      color: '#9333EA',
      bg: '#FAF5FF',
      onPress: () => nav('Produtos'),
    },
  ];

  // ─── métricas secundárias ─────────────────────────────────────────────────
  const miniMetrics: MiniMetric[] = [
    { label: 'Clientes', value: metricas?.totalClientes || 0, icon: 'people', color: '#2563EB' },
    { label: 'Pendentes', value: metricas?.cobrancasPendentes || 0, icon: 'time', color: '#DC2626' },
    { label: 'Produtos', value: metricas?.totalProdutos || 0, icon: 'cube', color: '#9333EA' },
  ];

  // Auto-scroll dos cards
  useEffect(() => {
    autoScrollRef.current = setInterval(() => {
      if (dashboardCards.length > 1) {
        const nextIndex = (activeCard + 1) % dashboardCards.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setActiveCard(nextIndex);
      }
    }, 5000);

    return () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
      }
    };
  }, [activeCard, dashboardCards.length]);

  // ─── ações rápidas ───────────────────────────────────────────────────────
  const quickActions = [
    { key: 'cliente', label: 'Novo Cliente', icon: 'person-add' as const, color: '#2563EB', visible: podeCadastrarCliente, onPress: () => navModal('ClienteForm', { modo: 'criar' }) },
    { key: 'locacao', label: 'Nova Locação', icon: 'add-circle' as const, color: '#9333EA', visible: podeLocar, onPress: () => nav('Clientes') },
    { key: 'cobranca', label: 'Cobrança', icon: 'cash' as const, color: '#16A34A', visible: podeCobrar, onPress: () => nav('Cobrancas') },
    { key: 'produto', label: 'Novo Produto', icon: 'cube' as const, color: '#EA580C', visible: podeCadastrarProduto, onPress: () => navModal('ProdutoForm', { modo: 'criar' }) },
    { key: 'relogio', label: 'Alterar Relógio', icon: 'timer' as const, color: '#0891B2', visible: podeRelogio, onPress: () => nav('Produtos') },
    { key: 'config', label: 'Configurações', icon: 'settings' as const, color: '#64748B', visible: isAdmin(), onPress: () => navModal('Settings') },
  ].filter(a => a.visible);

  // ─── indicadores de página ───────────────────────────────────────────────
  const renderDots = () => (
    <View style={s.dotsContainer}>
      {dashboardCards.map((_, idx) => (
        <TouchableOpacity
          key={idx}
          onPress={() => {
            flatListRef.current?.scrollToIndex({ index: idx, animated: true });
            setActiveCard(idx);
          }}
        >
          <View style={[s.dot, activeCard === idx && s.dotActive]} />
        </TouchableOpacity>
      ))}
    </View>
  );

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
          </View>

          <TouchableOpacity
            style={s.syncBtn}
            onPress={() => sincronizar(true)}
            disabled={isSyncing}
          >
            <SyncIndicator status={syncStatus} isSyncing={isSyncing} size="small" />
          </TouchableOpacity>
        </View>

        {/* ── INFO BAR: permissão + sync ───────────────────────────────── */}
        <View style={s.infoBar}>
          <View style={s.permTag}>
            <Ionicons name="shield-checkmark" size={12} color="#1E40AF" />
            <Text style={s.permTagText}>{user?.tipoPermissao || 'Administrador'}</Text>
          </View>
          <View style={s.syncInfo}>
            <Ionicons
              name={syncStatus === 'synced' ? 'checkmark-circle' : isSyncing ? 'sync' : 'cloud-outline'}
              size={14}
              color={syncStatus === 'synced' ? '#16A34A' : '#64748B'}
            />
            <Text style={s.syncText}>
              {isSyncing ? 'Sincronizando...' : formatSyncTime(lastSyncAt)}
            </Text>
            {mudancasPendentes > 0 && (
              <View style={s.pendBadge}>
                <Text style={s.pendBadgeText}>{mudancasPendentes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── CARDS CARROSSEL ──────────────────────────────────────────── */}
        <View style={s.carouselSection}>
          <FlatList
            ref={flatListRef}
            data={dashboardCards}
            keyExtractor={item => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
              setActiveCard(index);
            }}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 100));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
              });
            }}
            renderItem={({ item }) => <CarouselCard card={item} />}
            contentContainerStyle={s.carouselContent}
            snapToInterval={CARD_WIDTH}
            decelerationRate="fast"
          />
          {renderDots()}
        </View>

        {/* ── MÉTRICAS RÁPIDAS ─────────────────────────────────────────── */}
        <View style={s.metricsRow}>
          {miniMetrics.map((metric, idx) => (
            <MiniCard key={idx} metric={metric} />
          ))}
        </View>

        {/* ── AÇÕES RÁPIDAS ───────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.secTitle}>Ações Rápidas</Text>
          <Text style={s.secSubtitle}>Toque para acessar</Text>
        </View>
        
        {/* Grid 2 linhas x 3 colunas */}
        <View style={s.actionsGrid}>
          {/* Linha 1 */}
          <View style={s.actionsRow}>
            {quickActions.slice(0, 3).map(action => (
              <TouchableOpacity
                key={action.key}
                style={s.actionBtn}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={[s.actionIconWrap, { backgroundColor: action.color + '18' }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={s.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Linha 2 */}
          <View style={s.actionsRow}>
            {quickActions.slice(3, 6).map(action => (
              <TouchableOpacity
                key={action.key}
                style={s.actionBtn}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={[s.actionIconWrap, { backgroundColor: action.color + '18' }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={s.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── ERRO ──────────────────────────────────────────────────── */}
        {erro && (
          <View style={s.errorCard}>
            <Ionicons name="warning" size={18} color="#DC2626" />
            <Text style={s.errorText}>{erro}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={s.retryText}>Tentar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── estilos ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F1F5F9' },
  loadingContainer:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  loadingText:     { marginTop: 16, color: '#64748B', fontSize: 16 },
  scroll:          { padding: 16, paddingTop: 8 },

  // header
  header:          { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 12 
  },
  headerLeft:      { flex: 1 },
  saudacao:        { fontSize: 14, color: '#64748B', fontWeight: '500' },
  nomeUsuario:     { fontSize: 24, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  syncBtn:         { 
    padding: 10, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  // info bar
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  permTag:         { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DBEAFE', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 20 
  },
  permTagText:     { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  syncInfo:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncText:        { fontSize: 12, color: '#64748B' },
  pendBadge:       { backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  pendBadgeText:   { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  // carousel
  carouselSection:  { 
    marginBottom: 16,
  },
  carouselContent:  { paddingHorizontal: 0 },
  carouselCard:      {
    width: CARD_WIDTH,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  carouselCardTop:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardIconWrap:     { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardTitle:        { fontSize: 15, fontWeight: '600', color: '#475569' },
  carouselCardBottom: { },
  cardValue:        { fontSize: 36, fontWeight: '800' },
  cardSubtitle:     { fontSize: 13, color: '#94A3B8', marginTop: 4 },

  // dots
  dotsContainer:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 },
  dot:              { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  dotActive:        { backgroundColor: '#2563EB', width: 24, borderRadius: 4 },

  // mini metrics row
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  miniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  miniIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniContent: {
    flex: 1,
  },
  miniValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  miniLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },

  // sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  secTitle:        { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  secSubtitle:     { fontSize: 12, color: '#94A3B8' },

  // actions grid - 2 linhas x 3 colunas
  actionsGrid:     { 
    gap: 10, 
    marginBottom: 16 
  },
  actionsRow:      {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionBtn:       { 
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center', 
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIconWrap:  { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionLabel:     { fontSize: 12, fontWeight: '600', color: '#475569', textAlign: 'center' },

  // error
  errorCard:       { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    backgroundColor: '#FEF2F2', 
    padding: 14, 
    borderRadius: 12, 
    marginBottom: 16 
  },
  errorText:       { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:       { color: '#2563EB', fontSize: 14, fontWeight: '600' },
});
