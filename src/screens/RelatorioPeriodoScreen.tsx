/**
 * RelatorioPeriodoScreen.tsx
 * Cobranças por período — mensal/semanal com drill-down
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { databaseService } from '../services/DatabaseService';
import { formatarMoeda }   from '../utils/currency';

type Agrup = 'mes' | 'semana' | 'dia';

export default function RelatorioPeriodoScreen() {
  const [agrup,      setAgrup]      = useState<Agrup>('mes');
  const [dados,      setDados]      = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // Para semana, usa agrup 'semana'; para dia, usa 'dia'
      const agrupDB = agrup === 'semana' ? 'semana' : agrup === 'dia' ? 'dia' : 'mes';
      // Período dos últimos 12 meses
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      const inicio = d.toISOString().split('T')[0];
      const rows = await databaseService.getCobrancasPorPeriodo(agrupDB as any, inicio);
      setDados(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [agrup]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const maxTotal = dados.reduce((m, d) => Math.max(m, d.total), 1);

  const renderItem = ({ item }: { item: any }) => {
    const barPct = (item.total / maxTotal) * 100;
    return (
      <View style={st.card}>
        <View style={st.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={st.periodo}>{item.periodo}</Text>
            <Text style={st.qtd}>{item.qtd} cobranças</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.total}>{formatarMoeda(item.total)}</Text>
            <Text style={st.empresa}>empresa: {formatarMoeda(item.empresaRecebe)}</Text>
          </View>
        </View>
        {/* barra de progresso proporcional */}
        <View style={st.barBg}>
          <View style={[st.barFill, { width: `${barPct}%` as any }]} />
        </View>
      </View>
    );
  };

  const totalGeral  = dados.reduce((s, d) => s + d.total, 0);
  const totalQtd    = dados.reduce((s, d) => s + d.qtd,   0);
  const mediaPerPeriodo = dados.length > 0 ? totalGeral / dados.length : 0;

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* agrupamento */}
      <View style={st.tabs}>
        {(['mes', 'semana', 'dia'] as Agrup[]).map(a => (
          <TouchableOpacity
            key={a}
            style={[st.tab, agrup === a && st.tabActive]}
            onPress={() => setAgrup(a)}
          >
            <Text style={[st.tabText, agrup === a && st.tabTextActive]}>
              {a === 'mes' ? 'Mensal' : a === 'semana' ? 'Semanal' : 'Diário'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* resumo */}
      <View style={st.resumo}>
        <View style={st.resumoItem}>
          <Text style={st.resumoLabel}>Total</Text>
          <Text style={st.resumoValue}>{formatarMoeda(totalGeral)}</Text>
        </View>
        <View style={st.sep} />
        <View style={st.resumoItem}>
          <Text style={st.resumoLabel}>Cobranças</Text>
          <Text style={st.resumoValue}>{totalQtd}</Text>
        </View>
        <View style={st.sep} />
        <View style={st.resumoItem}>
          <Text style={st.resumoLabel}>Média / período</Text>
          <Text style={st.resumoValue}>{formatarMoeda(mediaPerPeriodo)}</Text>
        </View>
      </View>

      {carregando ? (
        <View style={st.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={[st.list, dados.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#2563EB']} />}
          ListEmptyComponent={() => (
            <View style={st.empty}>
              <Ionicons name="bar-chart-outline" size={56} color="#CBD5E1" />
              <Text style={st.emptyTitle}>Sem cobranças no período</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs:       { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab:        { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:  { borderBottomWidth: 3, borderBottomColor: '#2563EB' },
  tabText:    { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  tabTextActive:{ color: '#2563EB' },
  resumo:     { flexDirection: 'row', backgroundColor: '#1E293B', padding: 16 },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoLabel:{ fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  resumoValue:{ fontSize: 16, fontWeight: '800', color: '#FFF' },
  sep:        { width: 1, backgroundColor: '#334155' },
  list:       { padding: 12, paddingBottom: 24 },
  card:       { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8,
                borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  periodo:    { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  qtd:        { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  total:      { fontSize: 18, fontWeight: '800', color: '#16A34A' },
  empresa:    { fontSize: 11, color: '#2563EB', marginTop: 2 },
  barBg:      { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  barFill:    { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155' },
});
