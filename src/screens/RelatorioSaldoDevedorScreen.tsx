/**
 * RelatorioSaldoDevedorScreen.tsx
 * Lista de clientes com saldo devedor em aberto
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { Ionicons }       from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { clienteRepository }  from '../repositories/ClienteRepository';
import { cobrancaRepository } from '../repositories/CobrancaRepository';
import { formatarMoeda }      from '../utils/currency';

interface ClienteSaldo {
  id: string;
  nomeExibicao: string;
  rotaId?: string;
  rotaNome?: string;
  telefone?: string;
  saldoTotal: number;
  cobrancasPendentes: number;
}

export default function RelatorioSaldoDevedorScreen() {
  const navigation    = useNavigation<any>();
  const [lista,        setLista]        = useState<ClienteSaldo[]>([]);
  const [filtrados,    setFiltrados]    = useState<ClienteSaldo[]>([]);
  const [busca,        setBusca]        = useState('');
  const [carregando,   setCarregando]   = useState(true);
  const [totalGeral,   setTotalGeral]   = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const clientes = await clienteRepository.getComSaldoDevedor();
      const comSaldo: ClienteSaldo[] = await Promise.all(
        clientes.map(async c => {
          const cobrancas = await cobrancaRepository.getByCliente(String(c.id));
          const pendentes = cobrancas.filter(cb =>
            ['Parcial', 'Pendente', 'Atrasado'].includes(cb.status)
          );
          return {
            id:                 String(c.id),
            nomeExibicao:       (c as any).nomeExibicao || (c as any).nome || '',
            rotaId:             (c as any).rotaId,
            rotaNome:           (c as any).rotaNome,
            telefone:           (c as any).telefone,
            saldoTotal:         (c as any).saldoDevedorTotal ?? 0,
            cobrancasPendentes: pendentes.length,
          };
        })
      );
      const ordenados = comSaldo
        .filter(c => c.saldoTotal > 0)
        .sort((a, b) => b.saldoTotal - a.saldoTotal);

      setLista(ordenados);
      setFiltrados(ordenados);
      setTotalGeral(ordenados.reduce((s, c) => s + c.saldoTotal, 0));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const handleBusca = (v: string) => {
    setBusca(v);
    if (!v.trim()) { setFiltrados(lista); return; }
    const q = v.toLowerCase();
    setFiltrados(lista.filter(c =>
      c.nomeExibicao.toLowerCase().includes(q) ||
      (c.rotaNome ?? '').toLowerCase().includes(q)
    ));
  };

  const handleNavegarCobranca = useCallback((cliente: ClienteSaldo) => {
    // Navegar para a tela de cobrança do cliente
    // Usamos navigate com aninhamento correto de telas
    // Isso garante que o botão de voltar funcione corretamente
    
    // A estrutura de navegação é:
    // RootStack > App (ModalStack) > AppTabs (TabNavigator) > Cobrancas (StackNavigator)
    
    // Navegar de forma aninhada: AppTabs > Cobrancas > CobrancaCliente
    navigation.navigate('AppTabs', {
      screen: 'Cobrancas',
      params: {
        screen: 'CobrancaCliente',
        params: {
          clienteId: cliente.id,
          clienteNome: cliente.nomeExibicao,
          rotaId: cliente.rotaId || '',
        },
      },
    });
  }, [navigation]);

  const renderItem = ({ item, index }: { item: ClienteSaldo; index: number }) => (
    <TouchableOpacity
      style={st.card}
      onPress={() => handleNavegarCobranca(item)}
      activeOpacity={0.75}
    >
      <View style={[st.rank, index < 3 && st.rankTop]}>
        <Text style={[st.rankText, index < 3 && st.rankTextTop]}>#{index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.nome}>{item.nomeExibicao}</Text>
        <View style={st.infoRow}>
          {item.rotaNome && (
            <View style={st.tag}>
              <Ionicons name="map-outline" size={11} color="#64748B" />
              <Text style={st.tagText}>{item.rotaNome}</Text>
            </View>
          )}
          {item.cobrancasPendentes > 0 && (
            <View style={[st.tag, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="alert-circle-outline" size={11} color="#DC2626" />
              <Text style={[st.tagText, { color: '#DC2626' }]}>
                {item.cobrancasPendentes} pendente{item.cobrancasPendentes > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={st.saldo}>{formatarMoeda(item.saldoTotal)}</Text>
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* total */}
      <View style={st.totalBar}>
        <View>
          <Text style={st.totalLabel}>Total em aberto</Text>
          <Text style={st.totalValue}>{formatarMoeda(totalGeral)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.totalLabel}>Clientes</Text>
          <Text style={[st.totalValue, { color: '#DC2626' }]}>{filtrados.length}</Text>
        </View>
      </View>

      {/* busca */}
      <View style={st.searchBox}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar cliente ou rota..."
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

      {carregando ? (
        <View style={st.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={[st.list, filtrados.length === 0 && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} colors={['#2563EB']} />}
          ListEmptyComponent={() => (
            <View style={st.empty}>
              <Ionicons name="checkmark-circle" size={56} color="#86EFAC" />
              <Text style={st.emptyTitle}>Sem saldos em aberto</Text>
              <Text style={st.emptySub}>Todos os clientes estão em dia</Text>
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
  totalBar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: '#1E293B', padding: 16 },
  totalLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 2 },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 12, padding: 12,
                backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:{ flex: 1, fontSize: 15, color: '#1E293B' },
  list:       { padding: 12, paddingBottom: 24 },
  card:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF',
                borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  rank:       { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F1F5F9',
                justifyContent: 'center', alignItems: 'center' },
  rankTop:    { backgroundColor: '#FEF3C7' },
  rankText:   { fontSize: 12, fontWeight: '700', color: '#64748B' },
  rankTextTop:{ color: '#D97706' },
  nome:       { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  infoRow:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F8FAFC',
                paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  tagText:    { fontSize: 11, color: '#64748B' },
  saldo:      { fontSize: 17, fontWeight: '800', color: '#DC2626', marginBottom: 4 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155' },
  emptySub:   { fontSize: 14, color: '#94A3B8' },
});
