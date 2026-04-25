/**
 * RelatorioCobrancasScreen.tsx
 * Tela unificada de relatórios de cobranças
 * Combina: Resumo Financeiro + Por Período + Por Rota
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, SectionList, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { databaseService } from '../services/DatabaseService';
import { formatarMoeda } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

type Periodo = 'hoje' | '7d' | '30d' | 'mes' | 'ano' | 'tudo';
type Agrupamento = 'resumo' | 'periodo' | 'rota';

const PERIODOS: { label: string; key: Periodo }[] = [
  { label: 'Hoje',  key: 'hoje' },
  { label: '7 dias', key: '7d'   },
  { label: '30 dias', key: '30d' },
  { label: 'Mês',    key: 'mes'  },
  { label: 'Ano',    key: 'ano'  },
  { label: 'Tudo',   key: 'tudo' },
];

const STATUS_COLOR: Record<string, string> = {
  Pago: '#16A34A', Parcial: '#EA580C', Pendente: '#DC2626',
  Atrasado: '#7C3AED', Cancelado: '#94A3B8',
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function getDateRange(periodo: Periodo): { inicio?: string; fim?: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  if (periodo === 'tudo') return {};
  if (periodo === 'hoje') return { inicio: fmt(now), fim: fmt(now) };
  if (periodo === '7d')  { const d = new Date(now); d.setDate(d.getDate()-7);  return { inicio: fmt(d) }; }
  if (periodo === '30d') { const d = new Date(now); d.setDate(d.getDate()-30); return { inicio: fmt(d) }; }
  if (periodo === 'mes') { return { inicio: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01` }; }
  if (periodo === 'ano') { return { inicio: `${now.getFullYear()}-01-01` }; }
  return {};
}

function fmtTime(iso: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// ============================================================================
// COMPONENTES
// ============================================================================

function StatCard({ icon, color, bg, label, value, sub }: any) {
  return (
    <View style={[st.statCard, { borderLeftColor: color }]}>
      <View style={[st.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.statLabel}>{label}</Text>
        <Text style={[st.statValue, { color }]}>{value}</Text>
        {sub ? <Text style={st.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function BarraProgresso({ percentual }: { percentual: number }) {
  return (
    <View style={st.barBg}>
      <View style={[st.barFill, { width: `${Math.min(100, percentual)}%` as any }]} />
    </View>
  );
}

// ============================================================================
// TELA PRINCIPAL
// ============================================================================

export default function RelatorioCobrancasScreen() {
  const navigation = useNavigation<any>();
  
  // Estados
  const [periodo,     setPeriodo]     = useState<Periodo>('mes');
  const [agrup,       setAgrup]       = useState<Agrupamento>('resumo');
  const [resumo,      setResumo]      = useState<any>(null);
  const [porPeriodo,  setPorPeriodo]  = useState<any[]>([]);
  const [porRota,     setPorRota]     = useState<any[]>([]);
  const [carregando,  setCarregando]  = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { inicio, fim } = getDateRange(periodo);
      
      // Carregar dados em paralelo
      const [res, periodoData, rotaData] = await Promise.all([
        databaseService.getResumoFinanceiro(inicio, fim),
        databaseService.getCobrancasPorPeriodo('mes', inicio, fim),
        periodo === 'hoje' ? databaseService.getCobrancasDoDia(inicio) : Promise.resolve([]),
      ]);
      
      setResumo(res);
      setPorPeriodo(periodoData);
      
      // Agrupar por rota
      if (rotaData.length > 0) {
        const agrupado: Record<string, any[]> = {};
        rotaData.forEach((c: any) => {
          const rota = c.rotaNome || 'Sem rota';
          if (!agrupado[rota]) agrupado[rota] = [];
          agrupado[rota].push(c);
        });
        const sections = Object.entries(agrupado).map(([rota, items]) => ({
          title: rota,
          total: items.reduce((s: number, c: any) => s + (c.valorRecebido || 0), 0),
          qtd: items.length,
          data: items,
        })).sort((a, b) => b.total - a.total);
        setPorRota(sections);
      } else {
        setPorRota([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // Métricas calculadas
  const ticketMedio = resumo && resumo.totalCobrancas > 0
    ? resumo.totalArrecadado / resumo.totalCobrancas : 0;

  const maxTotalPeriodo = porPeriodo.reduce((m, d) => Math.max(m, d.total), 1);

  // Período formatado para exibição
  const periodoLabel = PERIODOS.find(p => p.key === periodo)?.label || periodo;

  // ============================================================================
  // RENDERS
  // ============================================================================

  const renderResumo = () => (
    <ScrollView 
      contentContainerStyle={st.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Card principal de totais */}
      <View style={st.totaisCard}>
        <View style={st.totaisRow}>
          <View style={st.totaisItem}>
            <Text style={st.totaisLabel}>Total a Receber</Text>
            <Text style={[st.totaisValue, { color: '#0891B2' }]}>{formatarMoeda(resumo?.totalClientePaga ?? 0)}</Text>
            <Text style={st.totaisSub}>{resumo?.totalCobrancas ?? 0} cobranças</Text>
          </View>
          <View style={st.totaisSep} />
          <View style={st.totaisItem}>
            <Text style={st.totaisLabel}>Total Recebido</Text>
            <Text style={st.totaisValue}>{formatarMoeda(resumo?.totalArrecadado ?? 0)}</Text>
            <Text style={st.totaisSub}>Em caixa</Text>
          </View>
        </View>
      </View>

      {/* Cards de detalhes */}
      <View style={st.sectionHeader}>
        <Ionicons name="stats-chart" size={16} color="#64748B" />
        <Text style={st.sectionTitle}>Detalhamento</Text>
      </View>

      <StatCard icon="wallet" color="#16A34A" bg="#F0FDF4"
        label="Recebido (em caixa)"
        value={formatarMoeda(resumo?.totalArrecadado ?? 0)}
        sub="Valores já pagos" />

      <StatCard icon="alert-circle" color="#DC2626" bg="#FEF2F2"
        label="Saldo Devedor"
        value={formatarMoeda(resumo?.totalSaldoDevedor ?? 0)}
        sub="Valores pendentes" />

      <StatCard icon="pricetag" color="#EA580C" bg="#FFF7ED"
        label="Total em Descontos"
        value={formatarMoeda(resumo?.totalDesconto ?? 0)}
        sub="Descontos concedidos" />

      <StatCard icon="trending-up" color="#0891B2" bg="#F0F9FF"
        label="Ticket Médio"
        value={formatarMoeda(ticketMedio)}
        sub="Por cobrança" />

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  const renderPeriodo = () => (
    <FlatList
      data={porPeriodo}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={st.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={st.periodoHeader}>
          <Text style={st.periodoInfo}>
            {porPeriodo.length} períodos • {periodoLabel}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const barPct = (item.total / maxTotalPeriodo) * 100;
        return (
          <View style={st.periodoCard}>
            <View style={st.periodoRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.periodoLabel}>{item.periodo}</Text>
                <Text style={st.periodoQtd}>{item.qtd} cobranças</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.periodoTotal}>{formatarMoeda(item.total)}</Text>
              </View>
            </View>
            <BarraProgresso percentual={barPct} />
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={st.empty}>
          <Ionicons name="bar-chart-outline" size={48} color="#CBD5E1" />
          <Text style={st.emptyText}>Sem dados no período</Text>
        </View>
      }
    />
  );

  const renderRota = () => {
    if (periodo !== 'hoje') {
      return (
        <View style={st.emptyFull}>
          <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
          <Text style={st.emptyText}>Selecione "Hoje" para ver por rota</Text>
          <TouchableOpacity style={st.emptyBtn} onPress={() => setPeriodo('hoje')}>
            <Text style={st.emptyBtnText}>Ver hoje</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (porRota.length === 0) {
      return (
        <View style={st.emptyFull}>
          <Ionicons name="map-outline" size={48} color="#CBD5E1" />
          <Text style={st.emptyText}>Nenhuma cobrança hoje</Text>
        </View>
      );
    }

    const totalDia = porRota.reduce((s, r) => s + r.total, 0);
    const qtdDia = porRota.reduce((s, r) => s + r.qtd, 0);

    return (
      <SectionList
        sections={porRota}
        keyExtractor={(item, i) => item.id || String(i)}
        contentContainerStyle={st.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={st.rotaResumo}>
            <View style={st.rotaResumoItem}>
              <Text style={st.rotaResumoLabel}>Total do dia</Text>
              <Text style={st.rotaResumoValue}>{formatarMoeda(totalDia)}</Text>
            </View>
            <View style={st.rotaResumoSep} />
            <View style={st.rotaResumoItem}>
              <Text style={st.rotaResumoLabel}>Cobranças</Text>
              <Text style={st.rotaResumoValue}>{qtdDia}</Text>
            </View>
            <View style={st.rotaResumoSep} />
            <View style={st.rotaResumoItem}>
              <Text style={st.rotaResumoLabel}>Rotas</Text>
              <Text style={st.rotaResumoValue}>{porRota.length}</Text>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={st.rotaHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.rotaTitle}>{section.title}</Text>
              <Text style={st.rotaQtd}>{section.qtd} cobranças</Text>
            </View>
            <Text style={st.rotaTotal}>{formatarMoeda(section.total)}</Text>
          </View>
        )}
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity
            style={st.rotaItem}
            onPress={() => navigation.navigate('CobrancaDetail', { cobrancaId: item.id })}
            activeOpacity={0.7}
          >
            <View style={[st.statusDot, { backgroundColor: STATUS_COLOR[item.status] || '#94A3B8' }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.rotaItemCliente}>{item.clienteNome}</Text>
              <Text style={st.rotaItemProduto}>{item.produtoIdentificador} • {fmtTime(item.dataPagamento)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[st.rotaItemValor, { color: STATUS_COLOR[item.status] || '#1E293B' }]}>
                {formatarMoeda(item.valorRecebido || 0)}
              </Text>
              {(item.saldoDevedorGerado || 0) > 0 && (
                <Text style={st.rotaItemSaldo}>saldo: {formatarMoeda(item.saldoDevedorGerado)}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        stickySectionHeadersEnabled
      />
    );
  };

  const renderConteudo = () => {
    if (carregando) {
      return <View style={st.center}><ActivityIndicator size="large" color="#2563EB" /></View>;
    }

    switch (agrup) {
      case 'resumo': return renderResumo();
      case 'periodo': return renderPeriodo();
      case 'rota': return renderRota();
      default: return renderResumo();
    }
  };

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* Filtro de Período */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={st.filtroScroll} 
        contentContainerStyle={st.filtroContent}
      >
        {PERIODOS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[st.chip, periodo === p.key && st.chipActive]}
            onPress={() => setPeriodo(p.key)}
          >
            <Text style={[st.chipText, periodo === p.key && st.chipTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Resumo rápido no topo */}
      {!carregando && resumo && (
        <View style={st.headerResumo}>
          <View style={st.headerResumoItem}>
            <Ionicons name="cash" size={16} color="#16A34A" />
            <Text style={st.headerResumoValue}>{formatarMoeda(resumo?.totalArrecadado ?? 0)}</Text>
            <Text style={st.headerResumoLabel}>Recebido</Text>
          </View>
          <View style={st.headerResumoSep} />
          <View style={st.headerResumoItem}>
            <Ionicons name="card" size={16} color="#0891B2" />
            <Text style={st.headerResumoValue}>{formatarMoeda(resumo?.totalClientePaga ?? 0)}</Text>
            <Text style={st.headerResumoLabel}>A Receber</Text>
          </View>
          <View style={st.headerResumoSep} />
          <View style={st.headerResumoItem}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={st.headerResumoValue}>{formatarMoeda(resumo?.totalSaldoDevedor ?? 0)}</Text>
            <Text style={st.headerResumoLabel}>Saldo</Text>
          </View>
        </View>
      )}

      {/* Abas */}
      <View style={st.tabs}>
        {[
          { key: 'resumo', label: 'Resumo', icon: 'stats-chart' as const },
          { key: 'periodo', label: 'Por Período', icon: 'calendar' as const },
          { key: 'rota', label: 'Por Rota', icon: 'map' as const },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[st.tab, agrup === tab.key && st.tabActive]}
            onPress={() => setAgrup(tab.key as Agrupamento)}
          >
            <Ionicons 
              name={tab.icon} 
              size={16} 
              color={agrup === tab.key ? '#2563EB' : '#94A3B8'} 
            />
            <Text style={[st.tabText, agrup === tab.key && st.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conteúdo */}
      {renderConteudo()}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Filtro de período
  filtroScroll: { maxHeight: 48, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filtroContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#2563EB' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },

  // Header resumo
  headerResumo: { flexDirection: 'row', backgroundColor: '#1E293B', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  headerResumoItem: { flex: 1, alignItems: 'center', gap: 2 },
  headerResumoSep: { width: 1, height: 32, backgroundColor: '#334155' },
  headerResumoValue: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  headerResumoLabel: { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#2563EB' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: '#2563EB' },

  // Scroll content
  scrollContent: { padding: 16 },

  // Totais card
  totaisCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  totaisRow: { flexDirection: 'row' },
  totaisItem: { flex: 1, alignItems: 'center' },
  totaisSep: { width: 1, backgroundColor: '#E2E8F0' },
  totaisLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  totaisValue: { fontSize: 22, fontWeight: '800', color: '#16A34A' },
  totaisSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748B' },

  // Stat cards
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderLeftWidth: 4 },
  statIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  // Periodo
  listContent: { padding: 12, paddingBottom: 24 },
  periodoHeader: { marginBottom: 12 },
  periodoInfo: { fontSize: 12, color: '#94A3B8' },
  periodoCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  periodoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  periodoLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  periodoQtd: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  periodoTotal: { fontSize: 17, fontWeight: '800', color: '#16A34A' },

  // Barra progresso
  barBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },

  // Rota
  rotaResumo: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 12, marginHorizontal: 4 },
  rotaResumoItem: { flex: 1, alignItems: 'center' },
  rotaResumoSep: { width: 1, backgroundColor: '#334155' },
  rotaResumoLabel: { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
  rotaResumoValue: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  rotaHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  rotaTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  rotaQtd: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  rotaTotal: { fontSize: 16, fontWeight: '800', color: '#2563EB' },
  rotaItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  rotaItemCliente: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  rotaItemProduto: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  rotaItemValor: { fontSize: 15, fontWeight: '700' },
  rotaItemSaldo: { fontSize: 11, color: '#DC2626', marginTop: 1 },

  // Empty states
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  emptyFull: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { fontSize: 15, color: '#64748B', textAlign: 'center' },
  emptyBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
