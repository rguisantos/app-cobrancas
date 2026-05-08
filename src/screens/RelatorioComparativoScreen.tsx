/**
 * RelatorioComparativoScreen.tsx
 * Comparação entre dois períodos
 * Conectado ao backend: GET /api/relatorios/comparativo
 * Recursos: Dois date pickers, comparação receita/cobranças/inadimplência, variação %, rota filter
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import { formatarMoeda, formatarPorcentagem, formatarData } from '../utils/currency';
import { useRota } from '../contexts/RotaContext';

// ============================================================================
// TIPOS
// ============================================================================

interface ComparacaoItem {
  periodo1: number;
  periodo2: number;
  variacao: number;
}

interface ComparacaoData {
  receita: ComparacaoItem;
  totalCobrado: ComparacaoItem;
  saldoDevedor: ComparacaoItem;
  totalCobrancas: ComparacaoItem;
  inadimplencia: ComparacaoItem & { valor1?: number; valor2?: number };
  locacoesAtivas: ComparacaoItem;
}

// ============================================================================
// HELPERS
// ============================================================================

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function getVariacaoColor(variacao: number): string {
  if (variacao > 0) return '#16A34A';
  if (variacao < 0) return '#DC2626';
  return '#64748B';
}

function getVariacaoIcon(variacao: number): string {
  if (variacao > 0) return 'trending-up';
  if (variacao < 0) return 'trending-down';
  return 'remove';
}

function formatarVariacao(variacao: number): string {
  const signal = variacao > 0 ? '+' : '';
  return `${signal}${variacao.toFixed(1)}%`;
}

// Quick period presets
const PRESET_PERIODS = [
  { label: 'Mês anterior vs Atual', getKey: () => {
    const now = new Date();
    const mesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      p1i: fmtDate(new Date(mesAnt.getFullYear(), mesAnt.getMonth(), 1)),
      p1f: fmtDate(new Date(mesAnt.getFullYear(), mesAnt.getMonth() + 1, 0)),
      p2i: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      p2f: fmtDate(now),
    };
  }},
  { label: 'Trimestre anterior vs Atual', getKey: () => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    const trimStart = new Date(now.getFullYear(), q * 3, 1);
    const prevTrimStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
    if (q === 0) {
      return {
        p1i: fmtDate(new Date(now.getFullYear() - 1, 9, 1)),
        p1f: fmtDate(new Date(now.getFullYear() - 1, 11, 31)),
        p2i: fmtDate(trimStart),
        p2f: fmtDate(now),
      };
    }
    return {
      p1i: fmtDate(prevTrimStart),
      p1f: fmtDate(new Date(prevTrimStart.getFullYear(), prevTrimStart.getMonth() + 3, 0)),
      p2i: fmtDate(trimStart),
      p2f: fmtDate(now),
    };
  }},
  { label: 'Ano anterior vs Atual', getKey: () => {
    const now = new Date();
    return {
      p1i: fmtDate(new Date(now.getFullYear() - 1, 0, 1)),
      p1f: fmtDate(new Date(now.getFullYear() - 1, 11, 31)),
      p2i: fmtDate(new Date(now.getFullYear(), 0, 1)),
      p2f: fmtDate(now),
    };
  }},
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioComparativoScreen() {
  const { rotas } = useRota();

  const now = new Date();
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [periodo1Inicio, setPeriodo1Inicio] = useState(fmtDate(new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1)));
  const [periodo1Fim, setPeriodo1Fim] = useState(fmtDate(new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0)));
  const [periodo2Inicio, setPeriodo2Inicio] = useState(fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [periodo2Fim, setPeriodo2Fim] = useState(fmtDate(now));

  const [comparacao, setComparacao] = useState<ComparacaoData | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [rotaId, setRotaId] = useState<string | undefined>();
  const [showRotaPicker, setShowRotaPicker] = useState(false);

  const rotaLabel = useMemo(() => {
    if (!rotaId) return 'Todas';
    const found = rotas.find(r => String(r.id) === String(rotaId));
    return found?.nome || 'Rota';
  }, [rotaId, rotas]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const response = await apiService.getRelatorioComparativo(
        periodo1Inicio, periodo1Fim, periodo2Inicio, periodo2Fim, rotaId
      );
      if (response.success && response.data) {
        setComparacao(response.data);
      } else {
        setComparacao(null);
        setErro(response.error || 'Erro ao carregar comparativo');
      }
    } catch (e: any) {
      setComparacao(null);
      setErro(e?.message || 'Erro de conexão');
    } finally {
      setCarregando(false);
    }
  }, [periodo1Inicio, periodo1Fim, periodo2Inicio, periodo2Fim, rotaId]);

  const handleExport = useCallback(async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportModal(false);
    setExportando(true);
    try {
      const params: Record<string, string> = {
        periodo1Inicio, periodo1Fim, periodo2Inicio, periodo2Fim,
      };
      if (rotaId) params.rotaId = rotaId;
      const result = await apiService.exportarRelatorio('comparativo', formato, params as any);
      if (result.success && result.data) {
        const blob = result.data;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
          const { default: FileSystem } = await import('expo-file-system/legacy');
          const { default: Sharing } = await import('expo-sharing');
          const filePath = `${FileSystem.cacheDirectory}comparativo.${ext}`;
          await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(filePath, { dialogTitle: `Relatório Comparativo (${ext.toUpperCase()})` });
          }
        };
        reader.readAsDataURL(blob);
      } else {
        Alert.alert('Erro', result.error || 'Falha ao exportar');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha na exportação');
    } finally {
      setExportando(false);
    }
  }, [periodo1Inicio, periodo1Fim, periodo2Inicio, periodo2Fim, rotaId]);

  // ─── apply preset ──────────────────────────────────────────────────────
  const applyPreset = (presetIdx: number) => {
    const { p1i, p1f, p2i, p2f } = PRESET_PERIODS[presetIdx].getKey();
    setPeriodo1Inicio(p1i);
    setPeriodo1Fim(p1f);
    setPeriodo2Inicio(p2i);
    setPeriodo2Fim(p2f);
  };

  // ─── render comparison card ────────────────────────────────────────────
  const renderComparacaoCard = (
    label: string, icon: string, color: string, bg: string,
    periodo1Val: number, periodo2Val: number, variacao: number,
    isCurrency: boolean = true
  ) => {
    const fmtVal = (v: number) => isCurrency ? formatarMoeda(v) : String(v);
    const varColor = label.includes('Inadimpl') || label.includes('Devedor')
      ? (variacao < 0 ? '#16A34A' : variacao > 0 ? '#DC2626' : '#64748B')
      : getVariacaoColor(variacao);

    return (
      <View style={[st.card, { borderLeftColor: color }]}>
        <View style={st.cardHeader}>
          <View style={[st.cardIcon, { backgroundColor: bg }]}>
            <Ionicons name={icon as any} size={20} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardLabel}>{label}</Text>
          </View>
          <View style={[st.varBadge, { backgroundColor: `${varColor}15` }]}>
            <Ionicons name={getVariacaoIcon(variacao) as any} size={14} color={varColor} />
            <Text style={[st.varText, { color: varColor }]}>{formatarVariacao(variacao)}</Text>
          </View>
        </View>

        <View style={st.cardRow}>
          <View style={st.cardCol}>
            <Text style={st.colLabel}>Período A</Text>
            <Text style={st.colValue}>{fmtVal(periodo1Val)}</Text>
          </View>
          <View style={st.colSep} />
          <View style={st.cardCol}>
            <Text style={st.colLabel}>Período B</Text>
            <Text style={st.colValue}>{fmtVal(periodo2Val)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#7C3AED']} tintColor="#7C3AED" />}
      >
        {/* Quick presets */}
        <View style={st.presetsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.presetsContent}>
            {PRESET_PERIODS.map((p, idx) => (
              <TouchableOpacity key={idx} style={st.presetBtn} onPress={() => applyPreset(idx)}>
                <Ionicons name="flash" size={14} color="#7C3AED" />
                <Text style={st.presetText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Período A */}
        <View style={st.periodSection}>
          <View style={st.periodHeader}>
            <View style={[st.periodDot, { backgroundColor: '#0891B2' }]} />
            <Text style={st.periodTitle}>Período A</Text>
          </View>
          <View style={st.periodRow}>
            <View style={st.dateField}>
              <Text style={st.dateLabel}>Início</Text>
              <TextInput
                style={st.dateInput}
                value={periodo1Inicio}
                onChangeText={setPeriodo1Inicio}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={st.dateField}>
              <Text style={st.dateLabel}>Fim</Text>
              <TextInput
                style={st.dateInput}
                value={periodo1Fim}
                onChangeText={setPeriodo1Fim}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        </View>

        {/* Período B */}
        <View style={st.periodSection}>
          <View style={st.periodHeader}>
            <View style={[st.periodDot, { backgroundColor: '#7C3AED' }]} />
            <Text style={st.periodTitle}>Período B</Text>
          </View>
          <View style={st.periodRow}>
            <View style={st.dateField}>
              <Text style={st.dateLabel}>Início</Text>
              <TextInput
                style={st.dateInput}
                value={periodo2Inicio}
                onChangeText={setPeriodo2Inicio}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={st.dateField}>
              <Text style={st.dateLabel}>Fim</Text>
              <TextInput
                style={st.dateInput}
                value={periodo2Fim}
                onChangeText={setPeriodo2Fim}
                placeholder="AAAA-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        </View>

        {/* Botão comparar + rota + exportar */}
        <View style={st.actionRow}>
          <TouchableOpacity style={st.compareBtn} onPress={carregar} disabled={carregando}>
            {carregando ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="swap-horizontal" size={18} color="#FFF" />
                <Text style={st.compareBtnText}>Comparar</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={st.rotaBtnSmall} onPress={() => setShowRotaPicker(true)}>
            <Ionicons name="map-outline" size={16} color="#7C3AED" />
            <Text style={st.rotaBtnText}>{rotaLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.exportBtnSmall} onPress={() => setShowExportModal(true)} disabled={exportando || !comparacao}>
            <Ionicons name="download-outline" size={18} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* Erro */}
        {erro && (
          <View style={st.erroCard}>
            <Ionicons name="warning" size={18} color="#DC2626" />
            <Text style={st.erroText}>{erro}</Text>
          </View>
        )}

        {/* Resultado */}
        {carregando && !comparacao && (
          <View style={st.loadingBox}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={st.loadingText}>Comparando períodos...</Text>
          </View>
        )}

        {comparacao && (
          <View style={st.resultSection}>
            <Text style={st.sectionTitle}>Resultado da Comparação</Text>

            {renderComparacaoCard('Receita', 'cash', '#16A34A', '#F0FDF4',
              comparacao.receita.periodo1, comparacao.receita.periodo2, comparacao.receita.variacao)}

            {renderComparacaoCard('Total Cobrado', 'wallet', '#0891B2', '#F0F9FF',
              comparacao.totalCobrado.periodo1, comparacao.totalCobrado.periodo2, comparacao.totalCobrado.variacao)}

            {renderComparacaoCard('Saldo Devedor', 'alert-circle', '#DC2626', '#FEF2F2',
              comparacao.saldoDevedor.periodo1, comparacao.saldoDevedor.periodo2, comparacao.saldoDevedor.variacao)}

            {renderComparacaoCard('Total Cobranças', 'receipt', '#2563EB', '#EFF6FF',
              comparacao.totalCobrancas.periodo1, comparacao.totalCobrancas.periodo2, comparacao.totalCobrancas.variacao, false)}

            {renderComparacaoCard('Inadimplência', 'close-circle', '#EA580C', '#FFF7ED',
              comparacao.inadimplencia.periodo1, comparacao.inadimplencia.periodo2, comparacao.inadimplencia.variacao, false)}

            {renderComparacaoCard('Locações Ativas', 'key', '#7C3AED', '#F5F3FF',
              comparacao.locacoesAtivas.periodo1, comparacao.locacoesAtivas.periodo2, comparacao.locacoesAtivas.variacao, false)}
          </View>
        )}

        {!comparacao && !carregando && !erro && (
          <View style={st.empty}>
            <Ionicons name="swap-horizontal-outline" size={56} color="#CBD5E1" />
            <Text style={st.emptyTitle}>Selecione os períodos</Text>
            <Text style={st.emptyText}>Defina as datas e toque em Comparar</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Rota Picker Modal */}
      <Modal visible={showRotaPicker} transparent animationType="fade" onRequestClose={() => setShowRotaPicker(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Filtrar por Rota</Text>
            <ScrollView style={st.rotaList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[st.rotaOption, !rotaId && st.rotaOptionActive]}
                onPress={() => { setRotaId(undefined); setShowRotaPicker(false); }}
              >
                <Ionicons name="grid" size={18} color={!rotaId ? '#7C3AED' : '#64748B'} />
                <Text style={[st.rotaOptionText, !rotaId && st.rotaOptionTextActive]}>Todas as rotas</Text>
              </TouchableOpacity>
              {rotas.map(r => (
                <TouchableOpacity
                  key={String(r.id)}
                  style={[st.rotaOption, String(rotaId) === String(r.id) && st.rotaOptionActive]}
                  onPress={() => { setRotaId(String(r.id)); setShowRotaPicker(false); }}
                >
                  <View style={[st.rotaDot, { backgroundColor: r.cor || '#64748B' }]} />
                  <Text style={[st.rotaOptionText, String(rotaId) === String(r.id) && st.rotaOptionTextActive]}>{r.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={st.modalCancel} onPress={() => setShowRotaPicker(false)}>
              <Text style={st.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Exportar Comparativo</Text>
            <Text style={st.modalSub}>Escolha o formato de exportação</Text>
            <TouchableOpacity style={[st.modalBtn, { borderLeftColor: '#16A34A' }]} onPress={() => handleExport('csv')}>
              <Ionicons name="grid-outline" size={22} color="#16A34A" />
              <View style={{ flex: 1 }}><Text style={st.modalBtnLabel}>CSV</Text><Text style={st.modalBtnSub}>Planilha compatível com Excel</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={[st.modalBtn, { borderLeftColor: '#2563EB' }]} onPress={() => handleExport('xlsx')}>
              <Ionicons name="document-text-outline" size={22} color="#2563EB" />
              <View style={{ flex: 1 }}><Text style={st.modalBtnLabel}>XLSX</Text><Text style={st.modalBtnSub}>Formato Excel nativo</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={[st.modalBtn, { borderLeftColor: '#DC2626' }]} onPress={() => handleExport('pdf')}>
              <Ionicons name="document-outline" size={22} color="#DC2626" />
              <View style={{ flex: 1 }}><Text style={st.modalBtnLabel}>PDF</Text><Text style={st.modalBtnSub}>Documento para impressão</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={st.modalCancel} onPress={() => setShowExportModal(false)}>
              <Text style={st.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {exportando && (
        <View style={st.exportOverlay}>
          <View style={st.exportOverlayCard}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={st.exportOverlayText}>Exportando...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const st = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16 },

  // Presets
  presetsRow:    { marginBottom: 12 },
  presetsContent:{ gap: 8, flexDirection: 'row' },
  presetBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE' },
  presetText:    { fontSize: 12, fontWeight: '600', color: '#7C3AED' },

  // Período
  periodSection: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  periodHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  periodDot:     { width: 10, height: 10, borderRadius: 5 },
  periodTitle:   { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  periodRow:     { flexDirection: 'row', gap: 12 },
  dateField:     { flex: 1 },
  dateLabel:     { fontSize: 11, color: '#94A3B8', marginBottom: 4, fontWeight: '600' },
  dateInput:     { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, fontSize: 14, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },

  // Action row
  actionRow:       { flexDirection: 'row', gap: 12, marginBottom: 16 },
  compareBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 14 },
  compareBtnText:  { fontSize: 15, fontWeight: '700', color: '#FFF' },
  rotaBtnSmall:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F3FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12 },
  rotaBtnText:     { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  exportBtnSmall:  { backgroundColor: '#F5F3FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },

  // Erro
  erroCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', marginBottom: 12, padding: 14, borderRadius: 12 },
  erroText:   { flex: 1, color: '#DC2626', fontSize: 14 },

  // Loading
  loadingBox: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  loadingText:{ color: '#64748B', fontSize: 15 },

  // Result
  resultSection: { gap: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },

  // Comparacao card
  card:        { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardIcon:    { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardLabel:   { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  varBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  varText:     { fontSize: 13, fontWeight: '700' },
  cardRow:     { flexDirection: 'row' },
  cardCol:     { flex: 1, alignItems: 'center' },
  colSep:      { width: 1, backgroundColor: '#E2E8F0' },
  colLabel:    { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  colValue:    { fontSize: 17, fontWeight: '800', color: '#1E293B' },

  // Empty
  empty:      { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:  { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  // Rota picker
  rotaList:       { maxHeight: 300 },
  rotaOption:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rotaOptionActive: { backgroundColor: '#F5F3FF', marginHorizontal: -4, paddingHorizontal: 8, borderRadius: 8 },
  rotaOptionText: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  rotaOptionTextActive: { color: '#7C3AED', fontWeight: '700' },
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
