/**
 * RelatorioInadimplenciaScreen.tsx
 * Relatório de inadimplência — clientes com cobranças em atraso
 * Conectado ao backend: GET /api/relatorios/inadimplencia
 * Recursos: KPIs, filtro por rota/período, lista detalhada, exportação
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert, Modal, ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import exportService from '../services/ExportService';
import { formatarMoeda, formatarData, formatarPorcentagem } from '../utils/currency';
import { useRota } from '../contexts/RotaContext';

// ============================================================================
// TIPOS
// ============================================================================

interface KPIs {
  totalSaldoDevedor: number;
  locacoesComDebito: number;
  cobrancasAtrasadas: number;
  diasMediosAtraso: number;
  percentualInadimplencia: number;
}

interface ItemInadimplencia {
  id: string;
  clienteNome: string;
  produtoIdentificador: string;
  produtoTipo: string;
  saldoDevedorGerado: number;
  diasAtraso: number;
  rotaNome: string;
  status: string;
  dataVencimento: string;
  valorRecebido: number;
  totalBruto: number;
}

interface Distribuicao {
  faixa: string;
  count: number;
  total: number;
}

interface TopDevedor {
  clienteId: string;
  clienteNome: string;
  totalDevido: number;
  cobrancas: number;
}

// ============================================================================
// HELPERS
// ============================================================================

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function getDateRange(periodo: string): { inicio: string; fim: string } {
  const now = new Date();
  switch (periodo) {
    case 'hoje':
      return { inicio: fmtDate(now), fim: fmtDate(now) };
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { inicio: fmtDate(d), fim: fmtDate(now) };
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { inicio: fmtDate(d), fim: fmtDate(now) };
    }
    case 'mes':
      return { inicio: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, fim: fmtDate(now) };
    case 'ano':
      return { inicio: `${now.getFullYear()}-01-01`, fim: fmtDate(now) };
    default:
      return { inicio: fmtDate(now), fim: fmtDate(now) };
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioInadimplenciaScreen() {
  const navigation = useNavigation<any>();
  const { rotas } = useRota();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [items, setItems] = useState<ItemInadimplencia[]>([]);
  const [distribuicao, setDistribuicao] = useState<Distribuicao[]>([]);
  const [topDevedores, setTopDevedores] = useState<TopDevedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('mes');
  const [rotaId, setRotaId] = useState<string | undefined>();
  const [showRotaPicker, setShowRotaPicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [activeTab, setActiveTab] = useState<'lista' | 'distribuicao' | 'top'>('lista');

  const PERIODOS = [
    { label: '7 dias',  key: '7d'  },
    { label: '30 dias', key: '30d' },
    { label: 'Mês',     key: 'mes' },
    { label: 'Ano',     key: 'ano' },
  ];

  // ─── carregar dados ──────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const { inicio, fim } = getDateRange(periodo);
      const filters: { rotaId?: string; dataInicio?: string; dataFim?: string } = {};
      if (rotaId) filters.rotaId = rotaId;
      filters.dataInicio = inicio;
      filters.dataFim = fim;

      const response = await apiService.getRelatorioInadimplencia(filters);
      if (response?.success && response.data) {
        const data = response.data;
        setKpis(data.kpis || null);
        setItems(data.tabela || []);
        setDistribuicao(data.charts?.distribuicaoDiasAtraso || []);
        setTopDevedores(data.charts?.topDevedores || []);
      } else {
        setItems([]);
        setErro(response?.error || 'Erro ao carregar relatório');
      }
    } catch (e: any) {
      setItems([]);
      setErro(e?.message || 'Erro de conexão');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [periodo, rotaId]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregar();
  }, [carregar]);

  // ─── rota label ────────────────────────────────────────────────────────
  const rotaLabel = useMemo(() => {
    if (!rotaId) return 'Todas as rotas';
    const found = rotas.find(r => String(r.id) === String(rotaId));
    return found?.nome || 'Rota';
  }, [rotaId, rotas]);

  // ─── exportação ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportModal(false);
    setExportando(true);
    try {
      if (formato === 'csv') {
        await exportService.exportCSV(items, 'inadimplencia', [
          { key: 'clienteNome', header: 'Cliente' },
          { key: 'produtoIdentificador', header: 'Produto' },
          { key: 'produtoTipo', header: 'Tipo' },
          { key: 'saldoDevedorGerado', header: 'Saldo Devedor', format: (v: number) => formatarMoeda(v) },
          { key: 'diasAtraso', header: 'Dias Atraso' },
          { key: 'rotaNome', header: 'Rota' },
          { key: 'status', header: 'Status' },
          { key: 'dataVencimento', header: 'Vencimento' },
        ], { title: 'Relatório de Inadimplência' });
      } else {
        const { inicio, fim } = getDateRange(periodo);
        const params: Record<string, string> = { formato, dataInicio: inicio, dataFim: fim };
        if (rotaId) params.rotaId = rotaId;
        const result = await apiService.exportarRelatorio('inadimplencia', formato, params as any);
        if (result.success && result.data) {
          const blob = result.data;
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
            const { default: FileSystem } = await import('expo-file-system/legacy');
            const { default: Sharing } = await import('expo-sharing');
            const filePath = `${FileSystem.cacheDirectory}inadimplencia.${ext}`;
            await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filePath, { dialogTitle: `Relatório Inadimplência (${ext.toUpperCase()})` });
            }
          };
          reader.readAsDataURL(blob);
        } else {
          Alert.alert('Erro', result.error || 'Falha ao exportar');
        }
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha na exportação');
    } finally {
      setExportando(false);
    }
  }, [items, periodo, rotaId]);

  // ─── loading ─────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={s.loadingText}>Carregando relatório...</Text>
      </View>
    );
  }

  const totalInadimplencia = kpis?.totalSaldoDevedor ?? items.reduce((acc, i) => acc + i.saldoDevedorGerado, 0);

  // ─── render KPI card ────────────────────────────────────────────────────
  const renderKPI = (icon: string, color: string, bg: string, label: string, value: string, sub?: string) => (
    <View style={[s.kpiCard, { borderLeftColor: color }]}>
      <View style={[s.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.kpiLabel}>{label}</Text>
        <Text style={[s.kpiValue, { color }]}>{value}</Text>
        {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Resumo KPIs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiScroll} contentContainerStyle={s.kpiScrollContent}>
        {renderKPI('alert-circle', '#DC2626', '#FEF2F2', 'Total Inadimplência', formatarMoeda(totalInadimplencia), `${kpis?.cobrancasAtrasadas ?? items.length} cobrança(s)`)}
        {kpis && renderKPI('time', '#EA580C', '#FFF7ED', 'Dias Médios Atraso', String(kpis.diasMediosAtraso), 'em média')}
        {kpis && renderKPI('pie-chart', '#7C3AED', '#F5F3FF', '% Inadimplência', formatarPorcentagem(kpis.percentualInadimplencia), 'do total de cobranças')}
        {kpis && renderKPI('business', '#0891B2', '#F0F9FF', 'Locações c/ Débito', String(kpis.locacoesComDebito), 'com saldo devedor')}
      </ScrollView>

      {/* Filtros: Período + Rota */}
      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodoScroll} contentContainerStyle={s.periodoContent}>
          {PERIODOS.map(p => (
            <TouchableOpacity key={p.key} style={[s.chip, periodo === p.key && s.chipActive]} onPress={() => setPeriodo(p.key)}>
              <Text style={[s.chipText, periodo === p.key && s.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={s.rotaBtn} onPress={() => setShowRotaPicker(true)}>
          <Ionicons name="map-outline" size={14} color="#64748B" />
          <Text style={s.rotaBtnText} numberOfLines={1}>{rotaLabel}</Text>
          <Ionicons name="chevron-down" size={12} color="#94A3B8" />
        </TouchableOpacity>
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

      {/* Tabs + Export */}
      <View style={s.tabBar}>
        <View style={s.tabs}>
          {([
            { key: 'lista', label: 'Lista', icon: 'list' as const },
            { key: 'distribuicao', label: 'Faixas', icon: 'pie-chart' as const },
            { key: 'top', label: 'Top 10', icon: 'trophy' as const },
          ]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? '#DC2626' : '#94A3B8'} />
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.exportBtn} onPress={() => setShowExportModal(true)} disabled={exportando}>
          <Ionicons name="download-outline" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'lista' && (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={[s.list, items.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} tintColor="#DC2626" />
          }
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={56} color="#16A34A" />
              <Text style={s.emptyTitle}>Nenhuma inadimplência</Text>
              <Text style={s.emptyText}>Todos os pagamentos estão em dia</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('CobrancaDetail', { cobrancaId: item.id })}
              activeOpacity={0.7}
            >
              <View style={s.cardHeader}>
                <Text style={s.cardCliente}>{item.clienteNome}</Text>
                <View style={[s.diasBadge, item.diasAtraso > 30 && s.diasBadgeCritico, item.diasAtraso > 60 && s.diasBadgeGrave]}>
                  <Text style={[s.diasText, item.diasAtraso > 60 && s.diasTextGrave]}>{item.diasAtraso}d</Text>
                </View>
              </View>
              <View style={s.cardRow}>
                <Text style={s.cardValor}>{formatarMoeda(item.saldoDevedorGerado)}</Text>
                <Text style={s.cardStatus}>{item.status}</Text>
              </View>
              <View style={s.cardDetails}>
                {item.produtoIdentificador ? <Text style={s.cardDetail}>Prod: {item.produtoIdentificador}</Text> : null}
                {item.rotaNome ? <Text style={s.cardDetail}>Rota: {item.rotaNome}</Text> : null}
                {item.dataVencimento ? <Text style={s.cardDetail}>Venc: {formatarData(item.dataVencimento)}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {activeTab === 'distribuicao' && (
        <FlatList
          data={distribuicao}
          keyExtractor={item => item.faixa}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} tintColor="#DC2626" />}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="pie-chart-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Sem dados de distribuição</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const maxTotal = Math.max(...distribuicao.map(d => d.total), 1);
            const barPct = (item.total / maxTotal) * 100;
            return (
              <View style={s.distCard}>
                <View style={s.distRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.distFaixa}>{item.faixa} dias</Text>
                    <Text style={s.distCount}>{item.count} cobrança(s)</Text>
                  </View>
                  <Text style={s.distTotal}>{formatarMoeda(item.total)}</Text>
                </View>
                <View style={s.barBg}>
                  <View style={[s.barFill, { width: `${barPct}%` as any, backgroundColor: '#DC2626' }]} />
                </View>
              </View>
            );
          }}
        />
      )}

      {activeTab === 'top' && (
        <FlatList
          data={topDevedores}
          keyExtractor={item => item.clienteId}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} tintColor="#DC2626" />}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="trophy-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Sem dados de devedores</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <View style={s.topCard}>
              <View style={[s.topRank, index < 3 && s.topRankHighlight]}>
                <Text style={[s.topRankText, index < 3 && s.topRankTextHighlight]}>#{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.topNome}>{item.clienteNome}</Text>
                <Text style={s.topQtd}>{item.cobrancas} cobrança(s) em atraso</Text>
              </View>
              <Text style={s.topValor}>{formatarMoeda(item.totalDevido)}</Text>
            </View>
          )}
        />
      )}

      {/* Rota Picker Modal */}
      <Modal visible={showRotaPicker} transparent animationType="fade" onRequestClose={() => setShowRotaPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Filtrar por Rota</Text>
            <ScrollView style={s.rotaList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[s.rotaOption, !rotaId && s.rotaOptionActive]}
                onPress={() => { setRotaId(undefined); setShowRotaPicker(false); }}
              >
                <Ionicons name="grid" size={18} color={!rotaId ? '#DC2626' : '#64748B'} />
                <Text style={[s.rotaOptionText, !rotaId && s.rotaOptionTextActive]}>Todas as rotas</Text>
              </TouchableOpacity>
              {rotas.map(r => (
                <TouchableOpacity
                  key={String(r.id)}
                  style={[s.rotaOption, String(rotaId) === String(r.id) && s.rotaOptionActive]}
                  onPress={() => { setRotaId(String(r.id)); setShowRotaPicker(false); }}
                >
                  <View style={[s.rotaDot, { backgroundColor: r.cor || '#64748B' }]} />
                  <Text style={[s.rotaOptionText, String(rotaId) === String(r.id) && s.rotaOptionTextActive]}>{r.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.modalCancel} onPress={() => setShowRotaPicker(false)}>
              <Text style={s.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Exportar Relatório</Text>
            <Text style={s.modalSub}>Escolha o formato de exportação</Text>

            <TouchableOpacity style={[s.modalBtn, { borderLeftColor: '#16A34A' }]} onPress={() => handleExport('csv')}>
              <Ionicons name="grid-outline" size={22} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={s.modalBtnLabel}>CSV</Text>
                <Text style={s.modalBtnSub}>Planilha compatível com Excel</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={[s.modalBtn, { borderLeftColor: '#2563EB' }]} onPress={() => handleExport('xlsx')}>
              <Ionicons name="document-text-outline" size={22} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={s.modalBtnLabel}>XLSX</Text>
                <Text style={s.modalBtnSub}>Formato Excel nativo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={[s.modalBtn, { borderLeftColor: '#DC2626' }]} onPress={() => handleExport('pdf')}>
              <Ionicons name="document-outline" size={22} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={s.modalBtnLabel}>PDF</Text>
                <Text style={s.modalBtnSub}>Documento para impressão</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={s.modalCancel} onPress={() => setShowExportModal(false)}>
              <Text style={s.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export loading overlay */}
      {exportando && (
        <View style={s.exportOverlay}>
          <View style={s.exportOverlayCard}>
            <ActivityIndicator size="large" color="#DC2626" />
            <Text style={s.exportOverlayText}>Exportando...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:{ color: '#64748B', fontSize: 15 },

  // KPI scroll
  kpiScroll:      { maxHeight: 110, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  kpiScrollContent:{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  kpiCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 10, borderLeftWidth: 4, minWidth: 200, borderWidth: 1, borderColor: '#F1F5F9' },
  kpiIcon:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  kpiLabel:   { fontSize: 11, color: '#64748B', fontWeight: '500' },
  kpiValue:   { fontSize: 16, fontWeight: '800' },
  kpiSub:     { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  // Filter row
  filterRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  periodoScroll: { flex: 1, maxHeight: 44 },
  periodoContent:{ paddingHorizontal: 12, paddingVertical: 6, gap: 8, flexDirection: 'row' },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#DC2626' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  rotaBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', marginRight: 12, maxWidth: 140 },
  rotaBtnText:{ fontSize: 12, fontWeight: '600', color: '#64748B', flex: 1 },

  // Erro
  erroCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  erroText:   { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:  { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  // Tab bar
  tabBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabs:       { flex: 1, flexDirection: 'row' },
  tab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  tabActive:  { borderBottomWidth: 3, borderBottomColor: '#DC2626' },
  tabText:    { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#DC2626' },
  exportBtn:  { backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginRight: 12 },

  // Lista
  list:       { padding: 16, paddingBottom: 32 },
  listEmpty:  { flexGrow: 1 },

  // Card
  card:        { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardCliente: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  diasBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#FEF3C7' },
  diasBadgeCritico: { backgroundColor: '#FEE2E2' },
  diasBadgeGrave:   { backgroundColor: '#FCA5A5' },
  diasText:    { fontSize: 12, fontWeight: '700', color: '#D97706' },
  diasTextGrave: { color: '#7F1D1D' },
  cardRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardValor:   { fontSize: 17, fontWeight: '700', color: '#DC2626' },
  cardStatus:  { fontSize: 11, fontWeight: '600', color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  cardDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  cardDetail:  { fontSize: 12, color: '#64748B' },

  // Distribuição
  distCard:   { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  distRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  distFaixa:  { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  distCount:  { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  distTotal:  { fontSize: 17, fontWeight: '800', color: '#DC2626' },
  barBg:      { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 3 },

  // Top devedores
  topCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  topRank:        { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  topRankHighlight: { backgroundColor: '#FEF3C7' },
  topRankText:    { fontSize: 12, fontWeight: '700', color: '#64748B' },
  topRankTextHighlight: { color: '#D97706' },
  topNome:        { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  topQtd:         { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  topValor:       { fontSize: 16, fontWeight: '800', color: '#DC2626' },

  // Empty
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  // Rota picker
  rotaList:       { maxHeight: 300 },
  rotaOption:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rotaOptionActive: { backgroundColor: '#FEF2F2', marginHorizontal: -4, paddingHorizontal: 8, borderRadius: 8 },
  rotaOptionText: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  rotaOptionTextActive: { color: '#DC2626', fontWeight: '700' },
  rotaDot:        { width: 12, height: 12, borderRadius: 6 },

  // Modal
  modalOverlay:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent:  { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '85%', maxWidth: 360 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  modalSub:      { fontSize: 13, color: '#94A3B8', marginBottom: 20 },
  modalBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#F8FAFC', marginBottom: 10, borderLeftWidth: 4 },
  modalBtnLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  modalBtnSub:   { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  modalCancel:   { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#64748B' },

  // Export overlay
  exportOverlay:     { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  exportOverlayCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 },
  exportOverlayText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
});
