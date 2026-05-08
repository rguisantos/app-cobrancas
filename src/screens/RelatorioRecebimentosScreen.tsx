/**
 * RelatorioRecebimentosScreen.tsx
 * Relatório de recebimentos — cobranças pagas em um período
 * Conectado ao backend: GET /api/relatorios/recebimentos
 * Recursos: KPIs, filtro período/rota, agrupamento dia/semana/mês, exportação
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl, ScrollView, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import exportService from '../services/ExportService';
import { formatarMoeda, formatarData, formatarDataHora, formatarPorcentagem } from '../utils/currency';
import { useRota } from '../contexts/RotaContext';

// ============================================================================
// TIPOS
// ============================================================================

interface KPIs {
  totalRecebido: number;
  mediaPorRecebimento: number;
  recebimentosNoPeriodo: number;
  taxaRecebimento: number;
  receitaPendente: number;
}

interface CobrancaRecebida {
  id: string;
  clienteNome: string;
  produtoIdentificador: string;
  dataPagamento: string;
  valorRecebido: number;
  formaPagamento: string;
  rotaNome: string;
}

type Agrupamento = 'dia' | 'semana' | 'mes';

interface GrupoRecebimento {
  chave: string;
  label: string;
  cobrancas: CobrancaRecebida[];
  total: number;
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

function getChaveAgrupamento(dataStr: string, agrup: Agrupamento): string {
  try {
    const d = new Date(dataStr);
    switch (agrup) {
      case 'dia':
        return fmtDate(d);
      case 'semana': {
        const dayOfWeek = d.getDay();
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - dayOfWeek);
        return `sem_${fmtDate(startOfWeek)}`;
      }
      case 'mes':
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      default:
        return fmtDate(d);
    }
  } catch {
    return 'desconhecido';
  }
}

function getLabelAgrupamento(chave: string, agrup: Agrupamento): string {
  if (agrup === 'dia') {
    try { return formatarData(chave); } catch { return chave; }
  }
  if (agrup === 'mes') {
    try {
      const [y, m] = chave.split('-');
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${meses[parseInt(m, 10) - 1]} ${y}`;
    } catch { return chave; }
  }
  if (agrup === 'semana') {
    try {
      const datePart = chave.replace('sem_', '');
      return `Semana de ${formatarData(datePart)}`;
    } catch { return chave; }
  }
  return chave;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function RelatorioRecebimentosScreen() {
  const navigation = useNavigation<any>();
  const { rotas } = useRota();

  const [cobrancas, setCobrancas] = useState<CobrancaRecebida[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('dia');
  const [rotaId, setRotaId] = useState<string | undefined>();
  const [showRotaPicker, setShowRotaPicker] = useState(false);
  const [busca, setBusca] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportando, setExportando] = useState(false);

  const PERIODOS = [
    { label: 'Hoje',   key: 'hoje' },
    { label: '7 dias',  key: '7d'   },
    { label: '30 dias', key: '30d'  },
    { label: 'Mês',     key: 'mes'  },
    { label: 'Ano',     key: 'ano'  },
  ];

  // ==========================================================================
  // CARREGAR DADOS
  // ==========================================================================

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { inicio, fim } = getDateRange(periodo);
      const response = await apiService.getRelatorioRecebimentos(inicio, fim, rotaId);

      if (response.success && response.data) {
        const data = response.data;
        setKpis(data.kpis || null);
        setCobrancas(data.tabela || []);
      } else {
        setCobrancas([]);
      }
    } catch (e) {
      console.error('[RelatorioRecebimentos] Erro ao carregar:', e);
      setCobrancas([]);
    } finally {
      setCarregando(false);
    }
  }, [periodo, rotaId]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // ==========================================================================
  // MÉTRICAS
  // ==========================================================================

  const filtrados = useMemo(() => {
    if (!busca.trim()) return cobrancas;
    const lower = busca.toLowerCase();
    return cobrancas.filter(c =>
      c.clienteNome.toLowerCase().includes(lower) ||
      c.produtoIdentificador.toLowerCase().includes(lower)
    );
  }, [cobrancas, busca]);

  const totalRecebido = useMemo(
    () => filtrados.reduce((s, c) => s + c.valorRecebido, 0),
    [filtrados]
  );

  const mediaPorCobranca = useMemo(
    () => filtrados.length > 0 ? totalRecebido / filtrados.length : 0,
    [totalRecebido, filtrados.length]
  );

  // ==========================================================================
  // ROTA
  // ==========================================================================

  const rotaLabel = useMemo(() => {
    if (!rotaId) return 'Todas';
    const found = rotas.find(r => String(r.id) === String(rotaId));
    return found?.nome || 'Rota';
  }, [rotaId, rotas]);

  // ==========================================================================
  // AGRUPAMENTO
  // ==========================================================================

  const grupos = useMemo(() => {
    const mapa: Record<string, CobrancaRecebida[]> = {};
    for (const c of filtrados) {
      const chave = getChaveAgrupamento(c.dataPagamento, agrupamento);
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(c);
    }

    return Object.entries(mapa)
      .map(([chave, items]) => ({
        chave,
        label: getLabelAgrupamento(chave, agrupamento),
        cobrancas: items.sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento)),
        total: items.reduce((s, c) => s + c.valorRecebido, 0),
      }))
      .sort((a, b) => b.chave.localeCompare(a.chave));
  }, [filtrados, agrupamento]);

  // ==========================================================================
  // EXPORTAÇÃO
  // ==========================================================================

  const handleExport = useCallback(async (formato: 'csv' | 'xlsx' | 'pdf') => {
    setShowExportModal(false);
    setExportando(true);
    try {
      if (formato === 'csv') {
        await exportService.exportCSV(filtrados, 'recebimentos', [
          { key: 'clienteNome', header: 'Cliente' },
          { key: 'produtoIdentificador', header: 'Produto' },
          { key: 'dataPagamento', header: 'Data Pagamento' },
          { key: 'valorRecebido', header: 'Valor Recebido', format: (v: number) => formatarMoeda(v) },
          { key: 'formaPagamento', header: 'Forma Pagamento' },
          { key: 'rotaNome', header: 'Rota' },
        ], { title: 'Relatório de Recebimentos' });
      } else {
        const { inicio, fim } = getDateRange(periodo);
        const params: Record<string, string> = { dataInicio: inicio, dataFim: fim };
        if (rotaId) params.rotaId = rotaId;
        const result = await apiService.exportarRelatorio('recebimentos', formato, params as any);
        if (result.success && result.data) {
          const blob = result.data;
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
            const { default: FileSystem } = await import('expo-file-system/legacy');
            const { default: Sharing } = await import('expo-sharing');
            const filePath = `${FileSystem.cacheDirectory}recebimentos.${ext}`;
            await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(filePath, { dialogTitle: `Relatório Recebimentos (${ext.toUpperCase()})` });
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
  }, [filtrados, periodo, rotaId]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const renderGrupo = ({ item: grupo }: { item: GrupoRecebimento }) => (
    <View style={st.grupoCard}>
      <View style={st.grupoHeader}>
        <View style={{ flex: 1 }}>
          <Text style={st.grupoLabel}>{grupo.label}</Text>
          <Text style={st.grupoQtd}>{grupo.cobrancas.length} cobrança{grupo.cobrancas.length !== 1 ? 's' : ''}</Text>
        </View>
        <Text style={st.grupoTotal}>{formatarMoeda(grupo.total)}</Text>
      </View>
      {grupo.cobrancas.map(c => (
        <TouchableOpacity
          key={c.id}
          style={st.cobrancaRow}
          onPress={() => navigation.navigate('CobrancaDetail', { cobrancaId: c.id })}
          activeOpacity={0.7}
        >
          <View style={[st.statusDot, { backgroundColor: '#16A34A' }]} />
          <View style={{ flex: 1 }}>
            <Text style={st.cobrancaCliente}>{c.clienteNome}</Text>
            <Text style={st.cobrancaProduto}>{c.produtoIdentificador} • {formatarDataHora(c.dataPagamento)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.cobrancaValor, { color: '#16A34A' }]}>{formatarMoeda(c.valorRecebido)}</Text>
            {c.formaPagamento ? <Text style={st.cobrancaForma}>{c.formaPagamento}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* Filtro de Período + Rota */}
      <View style={st.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={st.periodoScroll}
          contentContainerStyle={st.periodoContent}
        >
          {PERIODOS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[st.chip, periodo === p.key && st.chipActive]}
              onPress={() => setPeriodo(p.key)}
            >
              <Text style={[st.chipText, periodo === p.key && st.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={st.rotaBtn} onPress={() => setShowRotaPicker(true)}>
          <Ionicons name="map-outline" size={14} color="#64748B" />
          <Text style={st.rotaBtnText} numberOfLines={1}>{rotaLabel}</Text>
          <Ionicons name="chevron-down" size={12} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* KPIs */}
      <View style={st.kpiBar}>
        <View style={st.kpiItem}>
          <Text style={st.kpiLabel}>Total Recebido</Text>
          <Text style={[st.kpiValue, { color: '#16A34A' }]}>{formatarMoeda(kpis?.totalRecebido ?? totalRecebido)}</Text>
        </View>
        <View style={st.kpiSep} />
        <View style={st.kpiItem}>
          <Text style={st.kpiLabel}>Cobranças</Text>
          <Text style={st.kpiValue}>{kpis?.recebimentosNoPeriodo ?? filtrados.length}</Text>
        </View>
        <View style={st.kpiSep} />
        <View style={st.kpiItem}>
          <Text style={st.kpiLabel}>Média</Text>
          <Text style={[st.kpiValue, { color: '#2563EB' }]}>{formatarMoeda(kpis?.mediaPorRecebimento ?? mediaPorCobranca)}</Text>
        </View>
        {kpis && <>
          <View style={st.kpiSep} />
          <View style={st.kpiItem}>
            <Text style={st.kpiLabel}>Taxa</Text>
            <Text style={[st.kpiValue, { color: '#0891B2' }]}>{formatarPorcentagem(kpis.taxaRecebimento)}</Text>
          </View>
        </>}
      </View>

      {/* Busca */}
      <View style={st.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar cliente ou produto..."
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

      {/* Agrupamento + Export */}
      <View style={st.agrupRow}>
        <Text style={st.agrupLabel}>Agrupar:</Text>
        {([
          { key: 'dia' as Agrupamento, label: 'Dia', icon: 'today' as const },
          { key: 'semana' as Agrupamento, label: 'Semana', icon: 'calendar' as const },
          { key: 'mes' as Agrupamento, label: 'Mês', icon: 'calendar-outline' as const },
        ]).map(a => (
          <TouchableOpacity
            key={a.key}
            style={[st.agrupBtn, agrupamento === a.key && st.agrupBtnActive]}
            onPress={() => setAgrupamento(a.key)}
          >
            <Ionicons name={a.icon} size={12} color={agrupamento === a.key ? '#FFF' : '#64748B'} />
            <Text style={[st.agrupBtnText, agrupamento === a.key && st.agrupBtnTextActive]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={st.exportBtnSmall} onPress={() => setShowExportModal(true)} disabled={exportando}>
          <Ionicons name="download-outline" size={16} color="#16A34A" />
        </TouchableOpacity>
      </View>

      {/* Lista */}
      {carregando ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={g => g.chave}
          renderItem={renderGrupo}
          contentContainerStyle={[st.list, grupos.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#16A34A']} />}
          ListEmptyComponent={() => (
            <View style={st.empty}>
              <Ionicons name="cash-outline" size={56} color="#CBD5E1" />
              <Text style={st.emptyTitle}>Nenhum recebimento</Text>
              <Text style={st.emptySub}>Altere o período para ver recebimentos</Text>
            </View>
          )}
        />
      )}

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
                <Ionicons name="grid" size={18} color={!rotaId ? '#16A34A' : '#64748B'} />
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
            <Text style={st.modalTitle}>Exportar Relatório</Text>
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
            <ActivityIndicator size="large" color="#16A34A" />
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
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Filter row (period + rota)
  filterRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  periodoScroll:  { flex: 1, maxHeight: 48 },
  periodoContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#16A34A' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },
  rotaBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', marginRight: 12, maxWidth: 120 },
  rotaBtnText:{ fontSize: 12, fontWeight: '600', color: '#64748B', flex: 1 },

  // KPI bar
  kpiBar:     { flexDirection: 'row', backgroundColor: '#1E293B', padding: 12, alignItems: 'center' },
  kpiItem:    { flex: 1, alignItems: 'center' },
  kpiSep:     { width: 1, height: 28, backgroundColor: '#334155' },
  kpiLabel:   { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
  kpiValue:   { fontSize: 14, fontWeight: '800', color: '#FFF' },

  // Busca
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, padding: 12,
                backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:{ flex: 1, fontSize: 15, color: '#1E293B' },

  // Agrupamento
  agrupRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF' },
  agrupLabel:  { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  agrupBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F1F5F9' },
  agrupBtnActive: { backgroundColor: '#16A34A' },
  agrupBtnText:    { fontSize: 12, fontWeight: '600', color: '#64748B' },
  agrupBtnTextActive: { color: '#FFF' },
  exportBtnSmall: { marginLeft: 'auto', padding: 6, borderRadius: 8, backgroundColor: '#F0FDF4' },

  // Lista
  list:       { padding: 12, paddingBottom: 24 },

  // Grupo
  grupoCard:  { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  grupoHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  grupoLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  grupoQtd:   { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  grupoTotal: { fontSize: 16, fontWeight: '800', color: '#16A34A' },

  // Cobrança row
  cobrancaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  cobrancaCliente: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  cobrancaProduto: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  cobrancaValor: { fontSize: 15, fontWeight: '700' },
  cobrancaForma: { fontSize: 10, color: '#0891B2', fontWeight: '600', marginTop: 1 },

  // Empty
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155' },
  emptySub:   { fontSize: 14, color: '#94A3B8' },

  // Rota picker
  rotaList:       { maxHeight: 300 },
  rotaOption:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rotaOptionActive: { backgroundColor: '#F0FDF4', marginHorizontal: -4, paddingHorizontal: 8, borderRadius: 8 },
  rotaOptionText: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  rotaOptionTextActive: { color: '#16A34A', fontWeight: '700' },
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
