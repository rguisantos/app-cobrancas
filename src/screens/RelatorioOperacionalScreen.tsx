/**
 * RelatorioOperacionalScreen.tsx
 * Relatório operacional — resumo diário
 * Conectado ao backend: GET /api/relatorios/operacional
 * Recursos: KPIs, resumo diário, filtro período/rota, manutencoes/relocacoes, exportação
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import exportService from '../services/ExportService';
import { formatarMoeda, formatarData, formatarPorcentagem } from '../utils/currency';
import { useRota } from '../contexts/RotaContext';

// ============================================================================
// TIPOS
// ============================================================================

interface KPIs {
  cobrancasCriadasPeriodo: number;
  taxaPagamentoPeriodo: number;
  tempoMedioPagamento: number;
  produtividadeDiaria: number;
  manutencoesPeriodo?: number;
  relocacoesPeriodo?: number;
}

interface ResumoDiario {
  data: string;
  cobrancasCriadas: number;
  valorTotal: number;
  valorRecebido: number;
  saldoDevedor: number;
  manutencoes?: number;
  relocacoes?: number;
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
    default:
      return { inicio: fmtDate(now), fim: fmtDate(now) };
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioOperacionalScreen() {
  const { rotas } = useRota();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [resumoDiario, setResumoDiario] = useState<ResumoDiario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [rotaId, setRotaId] = useState<string | undefined>();
  const [showRotaPicker, setShowRotaPicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  const PERIODOS = [
    { label: 'Hoje',   key: 'hoje' },
    { label: '7 dias', key: '7d'   },
    { label: '30 dias', key: '30d' },
    { label: 'Mês',    key: 'mes'  },
    { label: 'Data',   key: 'custom' },
  ];

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      let params: Record<string, any>;
      if (periodo === 'custom' && customDate) {
        params = { dataInicio: customDate, dataFim: customDate };
      } else {
        params = { periodo };
      }
      if (rotaId) params.rotaId = rotaId;

      const response = await apiService.getRelatorioOperacional(params);
      if (response.success && response.data) {
        const data = response.data;
        setKpis(data.kpis || null);
        setResumoDiario(data.tabela || []);
      } else {
        setResumoDiario([]);
      }
    } catch {
      setResumoDiario([]);
    } finally {
      setCarregando(false);
    }
  }, [periodo, customDate, rotaId]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // ─── rota label ──────────────────────────────────────────────────────
  const rotaLabel = useMemo(() => {
    if (!rotaId) return 'Todas';
    const found = rotas.find(r => String(r.id) === String(rotaId));
    return found?.nome || 'Rota';
  }, [rotaId, rotas]);

  // ─── totals ─────────────────────────────────────────────────────────
  const totalValorRecebido = useMemo(() => resumoDiario.reduce((sum, r) => sum + r.valorRecebido, 0), [resumoDiario]);
  const totalCobrancas = useMemo(() => resumoDiario.reduce((sum, r) => sum + r.cobrancasCriadas, 0), [resumoDiario]);
  const totalSaldoDevedor = useMemo(() => resumoDiario.reduce((sum, r) => sum + r.saldoDevedor, 0), [resumoDiario]);
  const totalManutencoes = useMemo(() => resumoDiario.reduce((sum, r) => sum + (r.manutencoes || 0), 0), [resumoDiario]);
  const totalRelocacoes = useMemo(() => resumoDiario.reduce((sum, r) => sum + (r.relocacoes || 0), 0), [resumoDiario]);

  // ─── exportação ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportModal(false);
    setExportando(true);
    try {
      if (formato === 'csv') {
        await exportService.exportCSV(resumoDiario, 'operacional', [
          { key: 'data', header: 'Data', format: (v: string) => formatarData(v) },
          { key: 'cobrancasCriadas', header: 'Cobranças' },
          { key: 'valorTotal', header: 'Valor Total', format: (v: number) => formatarMoeda(v) },
          { key: 'valorRecebido', header: 'Valor Recebido', format: (v: number) => formatarMoeda(v) },
          { key: 'saldoDevedor', header: 'Saldo Devedor', format: (v: number) => formatarMoeda(v) },
          { key: 'manutencoes', header: 'Manutenções' },
          { key: 'relocacoes', header: 'Relocações' },
        ], { title: 'Relatório Operacional' });
      } else {
        const params: Record<string, string> = { formato, periodo };
        if (rotaId) params.rotaId = rotaId;
        const result = await apiService.exportarRelatorio('operacional', formato, params as any);
        if (result.success && result.data) {
          const blob = result.data;
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
            const { default: FileSystem } = await import('expo-file-system/legacy');
            const { default: Sharing } = await import('expo-sharing');
            const filePath = `${FileSystem.cacheDirectory}operacional.${ext}`;
            await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filePath, { dialogTitle: `Relatório Operacional (${ext.toUpperCase()})` });
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
  }, [resumoDiario, periodo, rotaId]);

  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#0891B2" />
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
            <View style={[s.kpiCard, { borderLeftColor: '#0891B2' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#F0F9FF' }]}>
                <Ionicons name="create" size={20} color="#0891B2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Cobranças Criadas</Text>
                <Text style={[s.kpiValue, { color: '#0891B2' }]}>{kpis.cobrancasCriadasPeriodo}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#16A34A' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Taxa Pagamento</Text>
                <Text style={[s.kpiValue, { color: '#16A34A' }]}>{formatarPorcentagem(kpis.taxaPagamentoPeriodo)}</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#EA580C' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="time" size={20} color="#EA580C" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Tempo Médio Pgto</Text>
                <Text style={[s.kpiValue, { color: '#EA580C' }]}>{kpis.tempoMedioPagamento}d</Text>
              </View>
            </View>

            <View style={[s.kpiCard, { borderLeftColor: '#7C3AED' }]}>
              <View style={[s.kpiIcon, { backgroundColor: '#F5F3FF' }]}>
                <Ionicons name="speedometer" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.kpiLabel}>Produtividade/Dia</Text>
                <Text style={[s.kpiValue, { color: '#7C3AED' }]}>{kpis.produtividadeDiaria}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Resumo rápido */}
      <View style={s.resumoBar}>
        <View style={s.resumoItem}>
          <Text style={s.resumoLabel}>Recebido</Text>
          <Text style={[s.resumoValue, { color: '#16A34A' }]}>{formatarMoeda(totalValorRecebido)}</Text>
        </View>
        <View style={s.resumoSep} />
        <View style={s.resumoItem}>
          <Text style={s.resumoLabel}>Cobranças</Text>
          <Text style={s.resumoValue}>{totalCobrancas}</Text>
        </View>
        <View style={s.resumoSep} />
        <View style={s.resumoItem}>
          <Text style={s.resumoLabel}>Devedor</Text>
          <Text style={[s.resumoValue, { color: '#DC2626' }]}>{formatarMoeda(totalSaldoDevedor)}</Text>
        </View>
        <View style={s.resumoSep} />
        <View style={s.resumoItem}>
          <Text style={s.resumoLabel}>Manut.</Text>
          <Text style={s.resumoValue}>{totalManutencoes}</Text>
        </View>
        <View style={s.resumoSep} />
        <View style={s.resumoItem}>
          <Text style={s.resumoLabel}>Reloc.</Text>
          <Text style={s.resumoValue}>{totalRelocacoes}</Text>
        </View>
      </View>

      {/* Período + Rota + Export */}
      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.periodoScroll} contentContainerStyle={s.periodoContent}>
          {PERIODOS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.chip, periodo === p.key && s.chipActive]}
              onPress={() => {
                if (p.key === 'custom') {
                  setShowCustomDate(true);
                } else {
                  setPeriodo(p.key);
                }
              }}
            >
              <Text style={[s.chipText, periodo === p.key && s.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={s.rotaBtn} onPress={() => setShowRotaPicker(true)}>
          <Ionicons name="map-outline" size={14} color="#64748B" />
          <Text style={s.rotaBtnText} numberOfLines={1}>{rotaLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.exportBtn} onPress={() => setShowExportModal(true)} disabled={exportando}>
          <Ionicons name="download-outline" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Custom date input */}
      {showCustomDate && (
        <View style={s.customDateRow}>
          <Ionicons name="calendar" size={18} color="#0891B2" />
          <TextInput
            style={s.customDateInput}
            placeholder="AAAA-MM-DD"
            placeholderTextColor="#94A3B8"
            value={customDate}
            onChangeText={setCustomDate}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity
            style={s.customDateBtn}
            onPress={() => {
              if (customDate) {
                setPeriodo('custom');
                setShowCustomDate(false);
              }
            }}
          >
            <Text style={s.customDateBtnText}>Ir</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Resumo diário */}
      <FlatList
        data={resumoDiario}
        keyExtractor={item => item.data}
        contentContainerStyle={[s.list, resumoDiario.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#0891B2']} tintColor="#0891B2" />}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={56} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Sem dados operacionais</Text>
            <Text style={s.emptyText}>Altere o período para ver o resumo</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const taxaRecebimento = item.valorTotal > 0 ? (item.valorRecebido / item.valorTotal) * 100 : 0;
          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardData}>{formatarData(item.data)}</Text>
                <View style={[s.taxaBadge, { backgroundColor: taxaRecebimento > 70 ? '#F0FDF4' : taxaRecebimento > 40 ? '#FEF3C7' : '#FEF2F2' }]}>
                  <Text style={[s.taxaText, { color: taxaRecebimento > 70 ? '#16A34A' : taxaRecebimento > 40 ? '#D97706' : '#DC2626' }]}>
                    {formatarPorcentagem(taxaRecebimento)}
                  </Text>
                </View>
              </View>

              <View style={s.metricRow}>
                <View style={s.metric}>
                  <Ionicons name="create" size={14} color="#0891B2" />
                  <Text style={s.metricText}>{item.cobrancasCriadas} cobranças</Text>
                </View>
                <View style={s.metric}>
                  <Ionicons name="cash" size={14} color="#16A34A" />
                  <Text style={s.metricText}>{formatarMoeda(item.valorRecebido)}</Text>
                </View>
              </View>

              <View style={s.metricRow}>
                <View style={s.metric}>
                  <Ionicons name="wallet" size={14} color="#64748B" />
                  <Text style={s.metricText}>Total: {formatarMoeda(item.valorTotal)}</Text>
                </View>
                {item.saldoDevedor > 0 && (
                  <View style={s.metric}>
                    <Ionicons name="alert-circle" size={14} color="#DC2626" />
                    <Text style={[s.metricText, { color: '#DC2626' }]}>Devedor: {formatarMoeda(item.saldoDevedor)}</Text>
                  </View>
                )}
              </View>

              {(item.manutencoes || item.relocacoes) ? (
                <View style={s.metricRow}>
                  {item.manutencoes ? (
                    <View style={s.metric}>
                      <Ionicons name="construct" size={14} color="#EA580C" />
                      <Text style={s.metricText}>{item.manutencoes} manutenção(ões)</Text>
                    </View>
                  ) : null}
                  {item.relocacoes ? (
                    <View style={s.metric}>
                      <Ionicons name="swap-horizontal" size={14} color="#7C3AED" />
                      <Text style={s.metricText}>{item.relocacoes} relocação(ões)</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${Math.min(100, taxaRecebimento)}%` as any, backgroundColor: taxaRecebimento > 70 ? '#16A34A' : taxaRecebimento > 40 ? '#D97706' : '#DC2626' }]} />
              </View>
            </View>
          );
        }}
      />

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
                <Ionicons name="grid" size={18} color={!rotaId ? '#0891B2' : '#64748B'} />
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
            <ActivityIndicator size="large" color="#0891B2" />
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
  kpiCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 10, borderLeftWidth: 4, minWidth: 170, borderWidth: 1, borderColor: '#F1F5F9' },
  kpiIcon:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  kpiLabel:   { fontSize: 11, color: '#64748B', fontWeight: '500' },
  kpiValue:   { fontSize: 18, fontWeight: '800' },

  // Resumo bar
  resumoBar:    { flexDirection: 'row', backgroundColor: '#1E293B', padding: 10, alignItems: 'center' },
  resumoItem:   { flex: 1, alignItems: 'center' },
  resumoSep:    { width: 1, height: 24, backgroundColor: '#334155' },
  resumoLabel:  { fontSize: 9, color: '#94A3B8', marginBottom: 2 },
  resumoValue:  { fontSize: 13, fontWeight: '800', color: '#FFF' },

  // Filter row
  filterRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  periodoScroll: { flex: 1, maxHeight: 44 },
  periodoContent:{ paddingHorizontal: 12, paddingVertical: 6, gap: 8, flexDirection: 'row' },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#0891B2' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  rotaBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', maxWidth: 100 },
  rotaBtnText:{ fontSize: 12, fontWeight: '600', color: '#64748B', flex: 1 },
  exportBtn:  { backgroundColor: '#0891B2', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },

  // Custom date
  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  customDateInput: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, fontSize: 14, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  customDateBtn: { backgroundColor: '#0891B2', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  customDateBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  list:       { padding: 16, paddingBottom: 32 },
  listEmpty:  { flexGrow: 1 },

  card:        { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardData:    { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  taxaBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  taxaText:    { fontSize: 13, fontWeight: '700' },

  metricRow:  { flexDirection: 'row', gap: 16, marginBottom: 4 },
  metric:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: 12, color: '#64748B' },

  barBg:      { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  barFill:    { height: '100%', borderRadius: 3 },

  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  // Rota picker
  rotaList:       { maxHeight: 300 },
  rotaOption:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rotaOptionActive: { backgroundColor: '#F0F9FF', marginHorizontal: -4, paddingHorizontal: 8, borderRadius: 8 },
  rotaOptionText: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  rotaOptionTextActive: { color: '#0891B2', fontWeight: '700' },
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

  exportOverlay:     { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  exportOverlayCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 },
  exportOverlayText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
});
