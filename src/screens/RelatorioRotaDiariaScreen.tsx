/**
 * RelatorioRotaDiariaScreen.tsx
 * Cobranças do dia, agrupadas por rota
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { databaseService } from '../services/DatabaseService';
import { formatarMoeda }   from '../utils/currency';

const STATUS_COLOR: Record<string, string> = {
  Pago: '#16A34A', Parcial: '#EA580C', Pendente: '#DC2626',
  Atrasado: '#7C3AED', Cancelado: '#94A3B8',
};

function fmt(iso: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function RelatorioRotaDiariaScreen() {
  const navigation    = useNavigation<any>();
  const [sections,     setSections]     = useState<any[]>([]);
  const [carregando,   setCarregando]   = useState(true);
  const [dataSel,      setDataSel]      = useState(() => new Date().toISOString().split('T')[0]);
  const [totalDia,     setTotalDia]     = useState(0);
  const [qtdDia,       setQtdDia]       = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const cobrancas = await databaseService.getCobrancasDoDia(dataSel);
      // Agrupar por rota
      const porRota: Record<string, any[]> = {};
      cobrancas.forEach((c: any) => {
        const rota = c.rotaNome || 'Sem rota';
        if (!porRota[rota]) porRota[rota] = [];
        porRota[rota].push(c);
      });
      const sects = Object.entries(porRota).map(([rota, items]) => ({
        title: rota,
        total: items.reduce((s: number, c: any) => s + (c.valorRecebido || 0), 0),
        totalCobranca: items.reduce((s: number, c: any) => s + (c.totalClientePaga || 0), 0),
        qtd:   items.length,
        data:  items,
      })).sort((a, b) => b.total - a.total);

      setSections(sects);
      setTotalDia(cobrancas.reduce((s: number, c: any) => s + (c.valorRecebido || 0), 0));
      setQtdDia(cobrancas.length);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [dataSel]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // navegar dia anterior / próximo
  const mudarDia = (delta: number) => {
    const d = new Date(dataSel + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setDataSel(d.toISOString().split('T')[0]);
  };

  const fmtData = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    const hoje = new Date().toISOString().split('T')[0];
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (iso === hoje)  return 'Hoje';
    if (iso === ontem) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={st.item}
      onPress={() => navigation.navigate('CobrancaDetail', { cobrancaId: item.id })}
      activeOpacity={0.75}
    >
      <View style={[st.statusDot, { backgroundColor: STATUS_COLOR[item.status] || '#94A3B8' }]} />
      <View style={{ flex: 1 }}>
        <Text style={st.itemCliente}>{item.clienteNome}</Text>
        <Text style={st.itemProduto}>{item.produtoIdentificador} · {fmt(item.dataPagamento)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[st.itemTotal, { color: STATUS_COLOR[item.status] || '#1E293B' }]}>
          {formatarMoeda(item.valorRecebido || 0)}
        </Text>
        {(item.saldoDevedorGerado || 0) > 0 && (
          <Text style={st.itemSaldo}>saldo: {formatarMoeda(item.saldoDevedorGerado)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: any) => (
    <View style={st.secHeader}>
      <View style={{ flex: 1 }}>
        <Text style={st.secTitle}>{section.title}</Text>
        <Text style={st.secQtd}>{section.qtd} cobranças</Text>
      </View>
      <Text style={st.secTotal}>{formatarMoeda(section.total)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* navegação de data */}
      <View style={st.datNav}>
        <TouchableOpacity style={st.datBtn} onPress={() => mudarDia(-1)}>
          <Ionicons name="chevron-back" size={20} color="#64748B" />
        </TouchableOpacity>
        <TouchableOpacity style={st.datCenter}>
          <Text style={st.datText}>{fmtData(dataSel)}</Text>
          <Text style={st.datSub}>{new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={st.datBtn}
          onPress={() => mudarDia(1)}
          disabled={dataSel >= new Date().toISOString().split('T')[0]}
        >
          <Ionicons name="chevron-forward" size={20}
            color={dataSel >= new Date().toISOString().split('T')[0] ? '#E2E8F0' : '#64748B'} />
        </TouchableOpacity>
      </View>

      {/* resumo do dia */}
      <View style={st.resumo}>
        <View style={st.resumoItem}>
          <Text style={st.resumoLabel}>Total do dia</Text>
          <Text style={st.resumoValue}>{formatarMoeda(totalDia)}</Text>
        </View>
        <View style={st.sep} />
        <View style={st.resumoItem}>
          <Text style={st.resumoLabel}>Cobranças</Text>
          <Text style={st.resumoValue}>{qtdDia}</Text>
        </View>
        <View style={st.sep} />
        <View style={st.resumoItem}>
          <Text style={st.resumoLabel}>Rotas</Text>
          <Text style={st.resumoValue}>{sections.length}</Text>
        </View>
      </View>

      {carregando ? (
        <View style={st.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => item.id || String(i)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[st.list, sections.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#2563EB']} />}
          ListEmptyComponent={() => (
            <View style={st.empty}>
              <Ionicons name="today-outline" size={56} color="#CBD5E1" />
              <Text style={st.emptyTitle}>Nenhuma cobrança nesta data</Text>
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
  datNav:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
                borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8 },
  datBtn:     { padding: 12 },
  datCenter:  { flex: 1, alignItems: 'center' },
  datText:    { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  datSub:     { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  resumo:     { flexDirection: 'row', backgroundColor: '#1E293B', padding: 14 },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoLabel:{ fontSize: 11, color: '#94A3B8', marginBottom: 3 },
  resumoValue:{ fontSize: 17, fontWeight: '800', color: '#FFF' },
  sep:        { width: 1, backgroundColor: '#334155' },
  list:       { paddingBottom: 24 },
  secHeader:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9',
                paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  secTitle:   { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  secQtd:     { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  secTotal:   { fontSize: 16, fontWeight: '800', color: '#2563EB' },
  item:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF',
                paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  itemCliente:{ fontSize: 14, fontWeight: '600', color: '#1E293B' },
  itemProduto:{ fontSize: 12, color: '#94A3B8', marginTop: 1 },
  itemTotal:  { fontSize: 15, fontWeight: '700' },
  itemSaldo:  { fontSize: 11, color: '#DC2626', marginTop: 1 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155' },
});
