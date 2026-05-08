/**
 * RelatorioEstoqueScreen.tsx
 * Relatório de estoque — produtos disponíveis em estoque
 * Conectado ao backend: GET /api/relatorios/estoque
 * Recursos: KPIs, filtros tipo/conservacao, tabela detalhada, exportação
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, TextInput, ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import exportService from '../services/ExportService';
import { formatarMoeda, formatarPorcentagem } from '../utils/currency';
import { useAtributos } from '../contexts/AtributosContext';

// ============================================================================
// TIPOS
// ============================================================================

interface KPIs {
  totalEstoque: number;
  totalLocados: number;
  totalManutencao: number;
  taxaOcupacao: number;
  produtosDisponiveis: number;
}

interface ItemEstoque {
  id: string;
  identificador: string;
  tipoNome: string;
  descricaoNome: string;
  tamanhoNome: string;
  conservacao: string;
  estabelecimento: string;
  statusProduto: string;
}

interface OcupacaoTipo {
  tipoNome: string;
  total: number;
  locados: number;
  percentual: number;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioEstoqueScreen() {
  const { tipos } = useAtributos();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [items, setItems] = useState<ItemEstoque[]>([]);
  const [ocupacaoTipo, setOcupacaoTipo] = useState<OcupacaoTipo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | undefined>();
  const [filtroConservacao, setFiltroConservacao] = useState<string | undefined>();
  const [busca, setBusca] = useState('');
  const [activeTab, setActiveTab] = useState<'lista' | 'ocupacao'>('lista');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const CONSERVACAO_OPTIONS = ['Novo', 'Bom', 'Regular', 'Ruim'];

  // ─── carregar dados ──────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const filters: Record<string, any> = {};
      if (filtroTipo) filters.tipoId = filtroTipo;
      if (filtroConservacao) filters.conservacao = filtroConservacao;

      const response = await apiService.getRelatorioEstoque(Object.keys(filters).length > 0 ? filters : undefined);
      if (response?.success && response.data) {
        const data = response.data;
        setKpis(data.kpis || null);
        setItems(data.tabela || []);
        setOcupacaoTipo(data.charts?.ocupacaoPorTipo || []);
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
  }, [filtroTipo, filtroConservacao]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregar();
  }, [carregar]);

  // ─── busca ───────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    if (!busca.trim()) return items;
    const lower = busca.toLowerCase();
    return items.filter(i =>
      i.identificador.toLowerCase().includes(lower) ||
      i.tipoNome.toLowerCase().includes(lower) ||
      i.descricaoNome.toLowerCase().includes(lower)
    );
  }, [items, busca]);

  // ─── filter labels ──────────────────────────────────────────────────────
  const tipoLabel = useMemo(() => {
    if (!filtroTipo) return 'Tipo';
    const found = tipos.find(t => String(t.id) === String(filtroTipo));
    return found?.nome || 'Tipo';
  }, [filtroTipo, tipos]);

  const conservacaoLabel = useMemo(() => filtroConservacao || 'Conserv.', [filtroConservacao]);

  // ─── exportação ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportModal(false);
    setExportando(true);
    try {
      if (formato === 'csv') {
        await exportService.exportCSV(filtrados, 'estoque', [
          { key: 'identificador', header: 'Identificador' },
          { key: 'tipoNome', header: 'Tipo' },
          { key: 'descricaoNome', header: 'Descrição' },
          { key: 'tamanhoNome', header: 'Tamanho' },
          { key: 'conservacao', header: 'Conservação' },
          { key: 'estabelecimento', header: 'Estabelecimento' },
          { key: 'statusProduto', header: 'Status' },
        ], { title: 'Relatório de Estoque' });
      } else {
        const params: Record<string, string> = { formato };
        if (filtroTipo) params.tipoId = filtroTipo;
        if (filtroConservacao) params.conservacao = filtroConservacao;
        const result = await apiService.exportarRelatorio('estoque', formato, params as any);
        if (result.success && result.data) {
          const blob = result.data;
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
            const { default: FileSystem } = await import('expo-file-system/legacy');
            const { default: Sharing } = await import('expo-sharing');
            const filePath = `${FileSystem.cacheDirectory}estoque.${ext}`;
            await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filePath, { dialogTitle: `Relatório Estoque (${ext.toUpperCase()})` });
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
  }, [filtrados, filtroTipo, filtroConservacao]);

  // ─── loading ─────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={s.loadingText}>Carregando relatório...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* KPIs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiScroll} contentContainerStyle={s.kpiScrollContent}>
        {kpis && (
          <>
            <View style={[s.kpiCard, { borderLeftColor: '#059669' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="cube-outline" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Em Estoque</Text>
                <Text style={[s.kpiValue, { color: '#059669' }]}>{kpis.totalEstoque}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#2563EB' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="key" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Locados</Text>
                <Text style={[s.kpiValue, { color: '#2563EB' }]}>{kpis.totalLocados}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#EA580C' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="construct" size={20} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Em Manutenção</Text>
                <Text style={[s.kpiValue, { color: '#EA580C' }]}>{kpis.totalManutencao}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#0891B2' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="pie-chart" size={20} color="#0891B2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Taxa Ocupação</Text>
                <Text style={[s.kpiValue, { color: '#0891B2' }]}>{formatarPorcentagem(kpis.taxaOcupacao)}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

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

      {/* Filtros + Busca */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.filterChip} onPress={() => setShowFilterModal(true)}>
          <Ionicons name="funnel-outline" size={14} color={filtroTipo || filtroConservacao ? '#059669' : '#64748B'} />
          <Text style={[s.filterChipText, (filtroTipo || filtroConservacao) && s.filterChipTextActive]} numberOfLines={1}>
            {(filtroTipo || filtroConservacao) ? `${tipoLabel} • ${conservacaoLabel}` : 'Filtros'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar identificador, tipo..."
          placeholderTextColor="#94A3B8"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs + Export */}
      <View style={s.tabBar}>
        <View style={s.tabs}>
          {([
            { key: 'lista', label: 'Produtos', icon: 'list' as const },
            { key: 'ocupacao', label: 'Ocupação', icon: 'pie-chart' as const },
          ]).map(tab => (
            <TouchableOpacity key={tab.key} style={[s.tab, activeTab === tab.key && s.tabActive]} onPress={() => setActiveTab(tab.key as any)}>
              <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? '#059669' : '#94A3B8'} />
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
          data={filtrados}
          keyExtractor={item => item.id}
          contentContainerStyle={[s.list, filtrados.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} tintColor="#059669" />
          }
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Estoque vazio</Text>
              <Text style={s.emptyText}>Nenhum produto disponível em estoque</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardIdentificador}>{item.identificador}</Text>
                <View style={s.statusBadge}>
                  <Text style={s.statusText}>{item.statusProduto}</Text>
                </View>
              </View>
              <View style={s.cardDetails}>
                {item.tipoNome ? <Text style={s.cardDetail}>Tipo: {item.tipoNome}</Text> : null}
                {item.descricaoNome ? <Text style={s.cardDetail}>Desc: {item.descricaoNome}</Text> : null}
                {item.tamanhoNome ? <Text style={s.cardDetail}>Tam: {item.tamanhoNome}</Text> : null}
                {item.conservacao ? (
                  <View style={[s.conservBadge, item.conservacao === 'Novo' && s.conservNovo, item.conservacao === 'Bom' && s.conservBom, item.conservacao === 'Regular' && s.conservRegular, item.conservacao === 'Ruim' && s.conservRuim]}>
                    <Text style={s.conservText}>{item.conservacao}</Text>
                  </View>
                ) : null}
                {item.estabelecimento ? <Text style={s.cardDetail}>Local: {item.estabelecimento}</Text> : null}
              </View>
            </View>
          )}
        />
      )}

      {activeTab === 'ocupacao' && (
        <FlatList
          data={ocupacaoTipo}
          keyExtractor={item => item.tipoNome}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} tintColor="#059669" />}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="pie-chart-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Sem dados de ocupação</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={s.ocupCard}>
              <View style={s.ocupHeader}>
                <Text style={s.ocupTipo}>{item.tipoNome}</Text>
                <Text style={s.ocupPerc}>{formatarPorcentagem(item.percentual)} ocupado</Text>
              </View>
              <View style={s.ocupRow}>
                <Text style={s.ocupDetail}>Total: {item.total}</Text>
                <Text style={s.ocupDetail}>Locados: {item.locados}</Text>
                <Text style={s.ocupDetail}>Estoque: {item.total - item.locados}</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${Math.min(100, item.percentual)}%` as any, backgroundColor: item.percentual > 80 ? '#DC2626' : item.percentual > 50 ? '#D97706' : '#059669' }]} />
              </View>
            </View>
          )}
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Filtros de Estoque</Text>

            {/* Tipo filter */}
            <Text style={s.filterSectionTitle}>Tipo de Produto</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterScrollContent}>
              <TouchableOpacity
                style={[s.filterOption, !filtroTipo && s.filterOptionActive]}
                onPress={() => setFiltroTipo(undefined)}
              >
                <Text style={[s.filterOptionText, !filtroTipo && s.filterOptionTextActive]}>Todos</Text>
              </TouchableOpacity>
              {tipos.map(t => (
                <TouchableOpacity
                  key={String(t.id)}
                  style={[s.filterOption, String(filtroTipo) === String(t.id) && s.filterOptionActive]}
                  onPress={() => setFiltroTipo(String(filtroTipo) === String(t.id) ? undefined : String(t.id))}
                >
                  <Text style={[s.filterOptionText, String(filtroTipo) === String(t.id) && s.filterOptionTextActive]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Conservação filter */}
            <Text style={s.filterSectionTitle}>Conservação</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterScrollContent}>
              <TouchableOpacity
                style={[s.filterOption, !filtroConservacao && s.filterOptionActive]}
                onPress={() => setFiltroConservacao(undefined)}
              >
                <Text style={[s.filterOptionText, !filtroConservacao && s.filterOptionTextActive]}>Todas</Text>
              </TouchableOpacity>
              {CONSERVACAO_OPTIONS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.filterOption, filtroConservacao === c && s.filterOptionActive]}
                  onPress={() => setFiltroConservacao(filtroConservacao === c ? undefined : c)}
                >
                  <Text style={[s.filterOptionText, filtroConservacao === c && s.filterOptionTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.filterActions}>
              <TouchableOpacity style={s.filterClearBtn} onPress={() => { setFiltroTipo(undefined); setFiltroConservacao(undefined); }}>
                <Text style={s.filterClearText}>Limpar filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.filterApplyBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={s.filterApplyText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
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
              <View style={{ flex: 1 }}><Text style={s.modalBtnLabel}>CSV</Text><Text style={s.modalBtnSub}>Planilha compatível com Excel</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, { borderLeftColor: '#2563EB' }]} onPress={() => handleExport('xlsx')}>
              <Ionicons name="document-text-outline" size={22} color="#2563EB" />
              <View style={{ flex: 1 }}><Text style={s.modalBtnLabel}>XLSX</Text><Text style={s.modalBtnSub}>Formato Excel nativo</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, { borderLeftColor: '#DC2626' }]} onPress={() => handleExport('pdf')}>
              <Ionicons name="document-outline" size={22} color="#DC2626" />
              <View style={{ flex: 1 }}><Text style={s.modalBtnLabel}>PDF</Text><Text style={s.modalBtnSub}>Documento para impressão</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancel} onPress={() => setShowExportModal(false)}>
              <Text style={s.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {exportando && (
        <View style={s.exportOverlay}>
          <View style={s.exportOverlayCard}>
            <ActivityIndicator size="large" color="#059669" />
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
  kpiScroll:      { maxHeight: 90, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  kpiScrollContent:{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  kpiCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 10, borderLeftWidth: 4, minWidth: 160, borderWidth: 1, borderColor: '#F1F5F9' },
  kpiIcon:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  kpiLabel:   { fontSize: 11, color: '#64748B', fontWeight: '500' },
  kpiValue:   { fontSize: 18, fontWeight: '800' },

  // Erro
  erroCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12 },
  erroText:   { flex: 1, color: '#DC2626', fontSize: 14 },
  retryText:  { color: '#2563EB', fontSize: 14, fontWeight: '600' },

  // Filter row
  filterRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filterChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9' },
  filterChipText:{ fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterChipTextActive: { color: '#059669' },

  // Busca
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginVertical: 6, padding: 12, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:{ flex: 1, fontSize: 15, color: '#1E293B' },

  // Tab bar
  tabBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabs:       { flex: 1, flexDirection: 'row' },
  tab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  tabActive:  { borderBottomWidth: 3, borderBottomColor: '#059669' },
  tabText:    { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#059669' },
  exportBtn:  { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginRight: 12 },

  // Lista
  list:       { padding: 16, paddingBottom: 32 },
  listEmpty:  { flexGrow: 1 },

  // Card
  card:          { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardIdentificador: { fontSize: 15, fontWeight: '600', color: '#1E293B', flex: 1 },
  statusBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#ECFDF5' },
  statusText:    { fontSize: 11, fontWeight: '700', color: '#059669' },
  cardDetails:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, alignItems: 'center' },
  cardDetail:    { fontSize: 12, color: '#64748B' },

  // Conservação badge
  conservBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#F1F5F9' },
  conservNovo:  { backgroundColor: '#ECFDF5' },
  conservBom:   { backgroundColor: '#F0FDF4' },
  conservRegular: { backgroundColor: '#FEF3C7' },
  conservRuim:  { backgroundColor: '#FEF2F2' },
  conservText:  { fontSize: 11, fontWeight: '600', color: '#64748B' },

  // Ocupação
  ocupCard:   { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  ocupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  ocupTipo:   { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  ocupPerc:   { fontSize: 14, fontWeight: '700', color: '#059669' },
  ocupRow:    { flexDirection: 'row', gap: 12, marginBottom: 8 },
  ocupDetail: { fontSize: 12, color: '#64748B' },
  barBg:      { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  barFill:    { height: '100%', borderRadius: 3 },

  // Empty
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  // Filter modal
  filterSectionTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 12, marginBottom: 6 },
  filterScroll: { maxHeight: 44 },
  filterScrollContent: { gap: 8, flexDirection: 'row', paddingVertical: 4 },
  filterOption: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filterOptionActive: { backgroundColor: '#059669' },
  filterOptionText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterOptionTextActive: { color: '#FFF' },
  filterActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  filterClearBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  filterClearText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  filterApplyBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#059669' },
  filterApplyText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

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

  exportOverlay:     { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  exportOverlayCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 },
  exportOverlayText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
});
