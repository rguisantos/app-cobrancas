/**
 * RelatorioFinanceiroScreen.tsx
 * Resumo financeiro geral com filtros por período
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { databaseService } from '../services/DatabaseService';
import { formatarMoeda }   from '../utils/currency';

type Periodo = '7d' | '30d' | '90d' | 'mes' | 'ano' | 'tudo';

const PERIODOS: { label: string; key: Periodo }[] = [
  { label: '7 dias',  key: '7d'  },
  { label: '30 dias', key: '30d' },
  { label: 'Mês',     key: 'mes' },
  { label: '90 dias', key: '90d' },
  { label: 'Ano',     key: 'ano' },
  { label: 'Tudo',    key: 'tudo'},
];

function getDateRange(periodo: Periodo): { inicio?: string; fim?: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  if (periodo === 'tudo') return {};
  if (periodo === '7d')  { const d = new Date(now); d.setDate(d.getDate()-7);  return { inicio: fmt(d) }; }
  if (periodo === '30d') { const d = new Date(now); d.setDate(d.getDate()-30); return { inicio: fmt(d) }; }
  if (periodo === '90d') { const d = new Date(now); d.setDate(d.getDate()-90); return { inicio: fmt(d) }; }
  if (periodo === 'mes') { return { inicio: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01` }; }
  if (periodo === 'ano') { return { inicio: `${now.getFullYear()}-01-01` }; }
  return {};
}

function StatCard({ icon, color, bg, label, value, sub }: any) {
  return (
    <View style={[st.statCard, { borderLeftColor: color }]}>
      <View style={[st.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.statLabel}>{label}</Text>
        <Text style={[st.statValue, { color }]}>{value}</Text>
        {sub ? <Text style={st.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export default function RelatorioFinanceiroScreen() {
  const [periodo,    setPeriodo]    = useState<Periodo>('30d');
  const [resumo,     setResumo]     = useState<any>(null);
  const [porMes,     setPorMes]     = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { inicio, fim } = getDateRange(periodo);
      const [res, meses] = await Promise.all([
        databaseService.getResumoFinanceiro(inicio, fim),
        databaseService.getCobrancasPorPeriodo('mes', inicio, fim),
      ]);
      setResumo(res);
      setPorMes(meses.slice(0, 6));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const ticketMedio = resumo && resumo.totalCobrancas > 0
    ? resumo.totalArrecadado / resumo.totalCobrancas : 0;

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* filtro período */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={st.filtroScroll} contentContainerStyle={st.filtroContent}>
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

      {carregando ? (
        <View style={st.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={st.scroll}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#2563EB']} />}
        >
          {/* cards principais */}
          <View style={st.sectionHeader}>
            <Ionicons name="stats-chart" size={18} color="#2563EB" />
            <Text style={st.sectionTitle}>Resumo</Text>
          </View>

          <StatCard icon="cash"           color="#16A34A" bg="#F0FDF4"
            label="Total Arrecadado"
            value={formatarMoeda(resumo?.totalArrecadado ?? 0)}
            sub={`${resumo?.totalCobrancas ?? 0} cobranças`} />

          <StatCard icon="business"       color="#2563EB" bg="#EFF6FF"
            label="Empresa Recebe"
            value={formatarMoeda(resumo?.totalEmpresaRecebe ?? 0)}
            sub={resumo?.totalArrecadado > 0
              ? `${((resumo.totalEmpresaRecebe/resumo.totalArrecadado)*100).toFixed(1)}% do total`
              : undefined} />

          <StatCard icon="wallet"         color="#7C3AED" bg="#F5F3FF"
            label="Total Recebido (em caixa)"
            value={formatarMoeda(resumo?.totalPago ?? 0)} />

          <StatCard icon="alert-circle"   color="#DC2626" bg="#FEF2F2"
            label="Saldo Devedor Gerado"
            value={formatarMoeda(resumo?.totalSaldoDevedor ?? 0)} />

          <StatCard icon="pricetag"       color="#EA580C" bg="#FFF7ED"
            label="Total em Descontos"
            value={formatarMoeda(resumo?.totalDesconto ?? 0)} />

          <StatCard icon="trending-up"    color="#0891B2" bg="#F0F9FF"
            label="Ticket Médio"
            value={formatarMoeda(ticketMedio)} />

          {/* por mês */}
          {porMes.length > 0 && (<>
            <View style={[st.sectionHeader, { marginTop: 20 }]}>
              <Ionicons name="calendar" size={18} color="#2563EB" />
              <Text style={st.sectionTitle}>Por mês</Text>
            </View>
            {porMes.map((m, i) => (
              <View key={i} style={st.mesRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.mesLabel}>{m.periodo}</Text>
                  <Text style={st.mesQtd}>{m.qtd} cobranças</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.mesTotal}>{formatarMoeda(m.total)}</Text>
                  <Text style={st.mesEmpresa}>empresa: {formatarMoeda(m.empresaRecebe)}</Text>
                </View>
              </View>
            ))}
          </>)}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filtroScroll:{ maxHeight: 48, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filtroContent:{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#2563EB' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive:{ color: '#FFF' },
  scroll:     { padding: 16 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  statCard:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFF',
                borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 4,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  statIcon:   { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statLabel:  { fontSize: 12, color: '#64748B', marginBottom: 2 },
  statValue:  { fontSize: 20, fontWeight: '800' },
  statSub:    { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  mesRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8,
                borderWidth: 1, borderColor: '#E2E8F0' },
  mesLabel:   { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  mesQtd:     { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  mesTotal:   { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  mesEmpresa: { fontSize: 11, color: '#2563EB', marginTop: 2 },
});
