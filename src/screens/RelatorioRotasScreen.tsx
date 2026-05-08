/**
 * RelatorioRotasScreen.tsx
 * Relatório de desempenho de rotas
 * Conectado ao backend: GET /api/relatorios/rotas
 * Recursos: KPIs, comparação entre rotas, filtro período, exportação
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import exportService from '../services/ExportService';
import { formatarMoeda, formatarPorcentagem } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

interface KPIs {
  totalRotas: number;
  totalClientes: number;
  receitaTotal: number;
  inadimplenciaTotal: number;
  cobrancasTotal: number;
}

interface RotaItem {
  rotaNome: string;
  totalClientes: number;
  totalLocacoes: number;
  totalCobrancas: number;
  receitaTotal: number;
  saldoDevedor: number;
  percentualInadimplencia: number;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioRotasScreen() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [rotas, setRotas] = useState<RotaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [sortBy, setSortBy] = useState<'receita' | 'inadimplencia' | 'clientes'>('receita');

  const PERIODOS = [
    { label: 'Mês', key: 'mes' },
    { label: '90 dias', key: '90d' },
    { label: 'Ano', key: 'ano' },
  ];

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await apiService.getRelatorioRotas({ periodo });
      if (response.success && response.data) {
        const data = response.data;
        setKpis(data.kpis || null);
        setRotas(data.tabela || []);
      } else {
        setRotas([]);
      }
    } catch {
      setRotas([]);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // ─── sorted rotas ─────────────────────────────────────────────────────
  const sortedRotas = [...rotas].sort((a, b) => {
    switch (sortBy) {
      case 'receita': return b.receitaTotal - a.receitaTotal;
      case 'inadimplencia': return b.percentualInadimplencia - a.percentualInadimplencia;
      case 'clientes': return b.totalClientes - a.totalClientes;
      default: return 0;
    }
  });

  // ─── exportação ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportModal(false);
    setExportando(true);
    try {
      if (formato === 'csv') {
        await exportService.exportCSV(rotas, 'rotas', [
          { key: 'rotaNome', header: 'Rota' },
          { key: 'totalClientes', header: 'Clientes' },
          { key: 'totalLocacoes', header: 'Locações' },
          { key: 'totalCobrancas', header: 'Cobranças' },
          { key: 'receitaTotal', header: 'Receita', format: (v: number) => formatarMoeda(v) },
          { key: 'saldoDevedor', header: 'Saldo Devedor', format: (v: number) => formatarMoeda(v) },
          { key: 'percentualInadimplencia', header: '% Inadimplência', format: (v: number) => formatarPorcentagem(v) },
        ], { title: 'Relatório de Rotas' });
      } else {
        const result = await apiService.exportarRelatorio('rotas', formato, { periodo });
        if (result.success && result.data) {
          const blob = result.data;
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
            const { default: FileSystem } = await import('expo-file-system/legacy');
            const { default: Sharing } = await import('expo-sharing');
            const filePath = `${FileSystem.cacheDirectory}rotas.${ext}`;
            await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filePath, { dialogTitle: `Relatório Rotas (${ext.toUpperCase()})` });
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
  }, [rotas, periodo]);

  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={s.loadingText}>Carregando relatório...</Text>
      </View>
    );
  }

  const maxReceita = Math.max(...rotas.map(r => r.receitaTotal), 1);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* KPIs */}
      {kpis && (
        <View style={s.kpiBar}>
          <View style={s.kpiItem}>
            <Ionicons name="map" size={16} color="#7C3AED" />
            <Text style={s.kpiValue}>{kpis.totalRotas}</Text>
            <Text style={s.kpiLabel}>Rotas</Text>
          </View>
          <View style={s.kpiSep} />
          <View style={s.kpiItem}>
            <Ionicons name="people" size={16} color="#2563EB" />
            <Text style={s.kpiValue}>{kpis.totalClientes}</Text>
            <Text style={s.kpiLabel}>Clientes</Text>
          </View>
          <View style={s.kpiSep} />
          <View style={s.kpiItem}>
            <Ionicons name="receipt" size={16} color="#0891B2" />
            <Text style={s.kpiValue}>{kpis.cobrancasTotal ?? rotas.reduce((a, r) => a + (r.totalCobrancas || 0), 0)}</Text>
            <Text style={s.kpiLabel}>Cobranças</Text>
          </View>
          <View style={s.kpiSep} />
          <View style={s.kpiItem}>
            <Ionicons name="cash" size={16} color="#16A34A" />
            <Text style={s.kpiValue}>{formatarMoeda(kpis.receitaTotal)}</Text>
            <Text style={s.kpiLabel}>Receita</Text>
          </View>
          <View style={s.kpiSep} />
          <View style={s.kpiItem}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={s.kpiValue}>{formatarMoeda(kpis.inadimplenciaTotal)}</Text>
            <Text style={s.kpiLabel}>Inadimpl.</Text>
          </View>
        </View>
      )}

      {/* Período + Sort + Export */}
      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodoScroll} contentContainerStyle={s.periodoContent}>
          {PERIODOS.map(p => (
            <TouchableOpacity key={p.key} style={[s.chip, periodo === p.key && s.chipActive]} onPress={() => setPeriodo(p.key)}>
              <Text style={[s.chipText, periodo === p.key && s.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sort bar */}
      <View style={s.sortRow}>
        <Text style={s.sortLabel}>Ordenar:</Text>
        {([
          { key: 'receita' as const, label: 'Receita', icon: 'cash' as const },
          { key: 'inadimplencia' as const, label: 'Inadimpl.', icon: 'alert-circle' as const },
          { key: 'clientes' as const, label: 'Clientes', icon: 'people' as const },
        ]).map(srt => (
          <TouchableOpacity
            key={srt.key}
            style={[s.sortBtn, sortBy === srt.key && s.sortBtnActive]}
            onPress={() => setSortBy(srt.key)}
          >
            <Ionicons name={srt.icon} size={12} color={sortBy === srt.key ? '#FFF' : '#64748B'} />
            <Text style={[s.sortBtnText, sortBy === srt.key && s.sortBtnTextActive]}>{srt.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.exportBtn} onPress={() => setShowExportModal(true)} disabled={exportando}>
          <Ionicons name="download-outline" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Lista de rotas */}
      <FlatList
        data={sortedRotas}
        keyExtractor={item => item.rotaNome}
        contentContainerStyle={[s.list, rotas.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#7C3AED']} tintColor="#7C3AED" />}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="map-outline" size={56} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Nenhuma rota encontrada</Text>
          </View>
        )}
        renderItem={({ item, index }) => {
          const barPct = (item.receitaTotal / maxReceita) * 100;
          const inadimplPct = item.percentualInadimplencia;
          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={s.rotaRow}>
                    <View style={[s.rankBadge, index < 3 && s.rankBadgeTop]}>
                      <Text style={[s.rankText, index < 3 && s.rankTextTop]}>#{index + 1}</Text>
                    </View>
                    <Text style={s.rotaNome}>{item.rotaNome}</Text>
                  </View>
                </View>
                <Text style={s.receita}>{formatarMoeda(item.receitaTotal)}</Text>
              </View>

              <View style={s.metricRow}>
                <View style={s.metric}>
                  <Ionicons name="people" size={14} color="#2563EB" />
                  <Text style={s.metricText}>{item.totalClientes} clientes</Text>
                </View>
                <View style={s.metric}>
                  <Ionicons name="key" size={14} color="#0891B2" />
                  <Text style={s.metricText}>{item.totalLocacoes} locações</Text>
                </View>
                <View style={s.metric}>
                  <Ionicons name="receipt" size={14} color="#7C3AED" />
                  <Text style={s.metricText}>{item.totalCobrancas || '—'} cobranças</Text>
                </View>
              </View>

              <View style={s.metricRow}>
                <View style={s.metric}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={s.metricText}>Inadimpl: {formatarMoeda(item.saldoDevedor)}</Text>
                </View>
                <View style={s.metric}>
                  <Ionicons name="pie-chart" size={14} color={inadimplPct > 20 ? '#DC2626' : '#16A34A'} />
                  <Text style={[s.metricText, { color: inadimplPct > 20 ? '#DC2626' : '#16A34A' }]}>
                    {formatarPorcentagem(inadimplPct)}
                  </Text>
                </View>
              </View>

              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${barPct}%` as any, backgroundColor: '#7C3AED' }]} />
              </View>
            </View>
          );
        }}
      />

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
            <ActivityIndicator size="large" color="#7C3AED" />
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

  // KPI bar
  kpiBar:     { flexDirection: 'row', backgroundColor: '#1E293B', padding: 12, alignItems: 'center' },
  kpiItem:    { flex: 1, alignItems: 'center', gap: 2 },
  kpiSep:     { width: 1, height: 36, backgroundColor: '#334155' },
  kpiValue:   { fontSize: 12, fontWeight: '800', color: '#FFF' },
  kpiLabel:   { fontSize: 9, color: '#94A3B8', marginTop: 1 },

  // Filter row
  filterRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  periodoScroll: { flex: 1, maxHeight: 44 },
  periodoContent:{ paddingHorizontal: 12, paddingVertical: 6, gap: 8, flexDirection: 'row' },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#7C3AED' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },

  // Sort row
  sortRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  sortLabel:  { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  sortBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F1F5F9' },
  sortBtnActive: { backgroundColor: '#7C3AED' },
  sortBtnText:   { fontSize: 12, fontWeight: '600', color: '#64748B' },
  sortBtnTextActive: { color: '#FFF' },
  exportBtn:  { marginLeft: 'auto', backgroundColor: '#7C3AED', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },

  // Lista
  list:       { padding: 16, paddingBottom: 32 },
  listEmpty:  { flexGrow: 1 },

  // Card
  card:        { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rotaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankBadge:   { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  rankBadgeTop:{ backgroundColor: '#F5F3FF' },
  rankText:    { fontSize: 11, fontWeight: '700', color: '#64748B' },
  rankTextTop: { color: '#7C3AED' },
  rotaNome:   { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  receita:    { fontSize: 17, fontWeight: '800', color: '#16A34A' },

  metricRow:  { flexDirection: 'row', gap: 12, marginBottom: 4, flexWrap: 'wrap' },
  metric:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: 12, color: '#64748B' },

  barBg:      { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill:    { height: '100%', borderRadius: 3 },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },

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
