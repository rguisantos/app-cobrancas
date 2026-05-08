/**
 * RelatorioManutencaoScreen.tsx
 * Relatório de trocas de pano e manutenções realizadas
 * Conectado ao backend: GET /api/relatorios/manutencoes
 * Recursos: KPIs, filtro tipo/período/produto, lista detalhada, exportação
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import exportService from '../services/ExportService';
import { formatarMoeda, formatarData, formatarDataHora } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

interface KPIs {
  totalManutencoes: number;
  trocasPano: number;
  manutencoesGerais: number;
  produtosEmManutencao: number;
  tempoMedioManutencao: number;
}

interface ManutencaoItem {
  id: string;
  produtoIdentificador: string;
  produtoTipo: string;
  clienteNome: string;
  tipo: string;
  descricao: string;
  data: string;
  registradoPor: string;
  custo?: number;
}

// ============================================================================
// CONFIG
// ============================================================================

const TIPO_LABEL: Record<string, string> = {
  trocaPano: 'Troca de Pano',
  manutencao: 'Manutenção',
};

const TIPO_COLOR: Record<string, string> = {
  trocaPano: '#2563EB',
  manutencao: '#EA580C',
};

const PERIODOS = [
  { label: '7 dias', key: '7d' },
  { label: '30 dias', key: '30d' },
  { label: 'Mês', key: 'mes' },
  { label: '90 dias', key: '90d' },
  { label: 'Ano', key: 'ano' },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioManutencaoScreen() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [registros, setRegistros] = useState<ManutencaoItem[]>([]);
  const [filtrados, setFiltrados] = useState<ManutencaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'trocaPano' | 'manutencao'>('todos');
  const [periodo, setPeriodo] = useState('mes');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const response = await apiService.getRelatorioManutencoes({
        periodo,
        tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
      });

      if (response.success && response.data) {
        const data = response.data;
        setKpis(data.kpis || null);
        setRegistros(data.tabela || []);
        applyFilters(data.tabela || [], busca, filtroTipo);
      } else {
        setRegistros([]);
        setFiltrados([]);
      }
    } catch {
      setRegistros([]);
      setFiltrados([]);
    } finally {
      setCarregando(false);
    }
  }, [periodo, filtroTipo]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const applyFilters = (lista: ManutencaoItem[], q: string, tipo: string) => {
    let result = lista;
    if (tipo !== 'todos') result = result.filter(r => r.tipo === tipo);
    if (q.trim()) {
      const lower = q.toLowerCase();
      result = result.filter(r =>
        r.produtoIdentificador?.toLowerCase().includes(lower) ||
        r.produtoTipo?.toLowerCase().includes(lower) ||
        r.clienteNome?.toLowerCase().includes(lower) ||
        r.descricao?.toLowerCase().includes(lower)
      );
    }
    setFiltrados(result);
  };

  const handleBusca = (v: string) => {
    setBusca(v);
    applyFilters(registros, v, filtroTipo);
  };

  const handleFiltroTipo = (tipo: 'todos' | 'trocaPano' | 'manutencao') => {
    setFiltroTipo(tipo);
    applyFilters(registros, busca, tipo);
  };

  // ─── custo total ───────────────────────────────────────────────────────
  const custoTotal = useMemo(
    () => filtrados.reduce((acc, r) => acc + (r.custo || 0), 0),
    [filtrados]
  );

  // ─── exportação ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportModal(false);
    setExportando(true);
    try {
      if (formato === 'csv') {
        await exportService.exportCSV(filtrados, 'manutencoes', [
          { key: 'data', header: 'Data', format: (v: string) => formatarData(v) },
          { key: 'produtoIdentificador', header: 'Produto' },
          { key: 'tipo', header: 'Tipo', format: (v: string) => TIPO_LABEL[v] || v },
          { key: 'descricao', header: 'Descrição' },
          { key: 'clienteNome', header: 'Cliente' },
          { key: 'registradoPor', header: 'Registrado Por' },
          { key: 'custo', header: 'Custo', format: (v: number) => formatarMoeda(v || 0) },
        ], { title: 'Relatório de Manutenções' });
      } else {
        const params: Record<string, string> = { formato, periodo };
        if (filtroTipo !== 'todos') params.tipo = filtroTipo;
        const result = await apiService.exportarRelatorio('manutencoes', formato, params as any);
        if (result.success && result.data) {
          const blob = result.data;
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
            const { default: FileSystem } = await import('expo-file-system/legacy');
            const { default: Sharing } = await import('expo-sharing');
            const filePath = `${FileSystem.cacheDirectory}manutencoes.${ext}`;
            await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filePath, { dialogTitle: `Relatório Manutenções (${ext.toUpperCase()})` });
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
  }, [filtrados, periodo, filtroTipo]);

  const renderItem = ({ item }: { item: ManutencaoItem }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.tipoBadge, { backgroundColor: `${TIPO_COLOR[item.tipo]}15` }]}>
          <Ionicons
            name={item.tipo === 'trocaPano' ? 'color-wand' : 'construct'}
            size={14}
            color={TIPO_COLOR[item.tipo]}
          />
          <Text style={[s.tipoBadgeText, { color: TIPO_COLOR[item.tipo] }]}>
            {TIPO_LABEL[item.tipo] ?? item.tipo}
          </Text>
        </View>
        <Text style={s.dataText}>{formatarDataHora(item.data)}</Text>
      </View>

      <View style={s.cardBody}>
        <View style={s.produtoRow}>
          <Ionicons name="cube" size={16} color="#2563EB" />
          <Text style={s.produtoText}>
            {item.produtoTipo} N° {item.produtoIdentificador}
          </Text>
        </View>

        {item.clienteNome && (
          <View style={s.infoRow}>
            <Ionicons name="person-outline" size={14} color="#94A3B8" />
            <Text style={s.infoText}>{item.clienteNome}</Text>
          </View>
        )}

        {item.descricao && (
          <Text style={s.descricao}>{item.descricao}</Text>
        )}

        <View style={s.cardFooter}>
          {item.registradoPor && (
            <View style={s.infoRow}>
              <Ionicons name="person" size={14} color="#94A3B8" />
              <Text style={s.infoText}>Por: {item.registradoPor}</Text>
            </View>
          )}
          {item.custo ? (
            <Text style={s.custoText}>Custo: {formatarMoeda(item.custo)}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* KPIs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiScroll} contentContainerStyle={s.kpiScrollContent}>
        {kpis && (
          <>
            <View style={[s.kpiCard, { borderLeftColor: '#1E293B' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="construct" size={20} color="#1E293B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Total</Text>
                <Text style={[s.kpiValue, { color: '#1E293B' }]}>{kpis.totalManutencoes}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#2563EB' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="color-wand" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Trocas de Pano</Text>
                <Text style={[s.kpiValue, { color: '#2563EB' }]}>{kpis.trocasPano}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#EA580C' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="build" size={20} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Manutenções</Text>
                <Text style={[s.kpiValue, { color: '#EA580C' }]}>{kpis.manutencoesGerais}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#DC2626' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="time" size={20} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Tempo Médio</Text>
                <Text style={[s.kpiValue, { color: '#DC2626' }]}>{kpis.tempoMedioManutencao}d</Text>
              </View>
            </View>

            {custoTotal > 0 && (
              <View style={[s.kpiCard, { borderLeftColor: '#059669' }]}>
                <View style={[s.kpiIcon, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="cash" size={20} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.kpiLabel}>Custo Total</Text>
                  <Text style={[s.kpiValue, { color: '#059669' }]}>{formatarMoeda(custoTotal)}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Período */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodoScroll} contentContainerStyle={s.periodoContent}>
        {PERIODOS.map(p => (
          <TouchableOpacity key={p.key} style={[s.chip, periodo === p.key && s.chipActive]} onPress={() => setPeriodo(p.key)}>
            <Text style={[s.chipText, periodo === p.key && s.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* busca */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={s.searchInput}
          placeholder="Produto, cliente, descrição..."
          placeholderTextColor="#94A3B8"
          value={busca}
          onChangeText={handleBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => handleBusca('')}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      </View>

      {/* filtro tipo + export */}
      <View style={s.filtroRow}>
        {(['todos', 'trocaPano', 'manutencao'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.filtroChip, filtroTipo === t && s.filtroChipActive]}
            onPress={() => handleFiltroTipo(t)}
          >
            <Text style={[s.filtroChipText, filtroTipo === t && s.filtroChipTextActive]}>
              {t === 'todos' ? 'Todos' : TIPO_LABEL[t]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.exportBtnSmall} onPress={() => setShowExportModal(true)} disabled={exportando}>
          <Ionicons name="download-outline" size={16} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={s.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, filtrados.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#2563EB']} />
          }
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="construct-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Nenhuma manutenção registrada</Text>
              <Text style={s.emptyText}>
                Marque "Troca de pano" ao criar locações ou durante cobranças
              </Text>
            </View>
          )}
        />
      )}

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
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={s.exportOverlayText}>Exportando...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // KPI scroll
  kpiScroll:      { maxHeight: 90, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  kpiScrollContent:{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  kpiCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 10, borderLeftWidth: 4, minWidth: 160, borderWidth: 1, borderColor: '#F1F5F9' },
  kpiIcon:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  kpiLabel:   { fontSize: 11, color: '#64748B', fontWeight: '500' },
  kpiValue:   { fontSize: 18, fontWeight: '800' },

  // Período
  periodoScroll: { maxHeight: 44, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  periodoContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 8, flexDirection: 'row' },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#2563EB' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },

  // Search
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:{ flex: 1, fontSize: 15, color: '#1E293B' },

  // Filtro tipo
  filtroRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8, alignItems: 'center' },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filtroChipActive: { backgroundColor: '#2563EB' },
  filtroChipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filtroChipTextActive: { color: '#FFFFFF' },
  exportBtnSmall: { marginLeft: 'auto', padding: 6, borderRadius: 8, backgroundColor: '#EFF6FF' },

  list:       { padding: 12, paddingBottom: 24 },
  listEmpty:  { flexGrow: 1 },

  card:       { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tipoBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tipoBadgeText: { fontSize: 12, fontWeight: '700' },
  dataText:   { fontSize: 12, color: '#94A3B8' },

  cardBody:   { gap: 5 },
  produtoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  produtoText:{ fontSize: 15, fontWeight: '700', color: '#1E293B' },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:   { fontSize: 13, color: '#64748B' },
  descricao:  { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  custoText:  { fontSize: 13, fontWeight: '600', color: '#059669' },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155' },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 280 },

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
