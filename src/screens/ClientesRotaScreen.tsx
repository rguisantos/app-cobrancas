/**
 * ClientesRotaScreen.tsx
 * Passo 2 do fluxo — clientes da rota com status de locações
 * 
 * Mostra clientes com:
 * - Produtos ativos (locados)
 * - Saldo devedor de locações finalizadas
 * 
 * Otimizado: usa queries agregadas em lote ao invés de N+1
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { Ionicons }        from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useCliente }        from '../contexts/ClienteContext';
import { locacaoRepository } from '../repositories/LocacaoRepository';
import { cobrancaRepository } from '../repositories/CobrancaRepository';
import { ClienteListItem }   from '../types';
import {
  CobrancasStackParamList,
  CobrancasStackNavigationProp,
} from '../navigation/CobrancasStack';

type RoutePropType = RouteProp<CobrancasStackParamList, 'ClientesRota'>;

interface ClienteComStatus extends ClienteListItem { 
  totalProdutos: number;
  temSaldoDevedor?: boolean;
}

export default function ClientesRotaScreen() {
  const route      = useRoute<RoutePropType>();
  const navigation = useNavigation<CobrancasStackNavigationProp>();
  const { rotaId, rotaNome } = route.params;

  const { clientes, carregarClientes, carregando } = useCliente();

  const [clientesComStatus, setClientesComStatus] = useState<ClienteComStatus[]>([]);
  const [carregandoStatus,  setCarregandoStatus]  = useState(false);
  const [refreshing,        setRefreshing]         = useState(false);
  const [busca,             setBusca]              = useState('');

  const carregar = useCallback(async () => {
    await carregarClientes({ rotaId, status: 'Ativo' });
  }, [carregarClientes, rotaId]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  useEffect(() => {
    const filtrados = clientes.filter(c =>
      !c.rotaId || String(c.rotaId) === String(rotaId)
    );
    if (filtrados.length === 0) { setClientesComStatus([]); return; }

    setCarregandoStatus(true);
    
    // Queries em lote — 2 queries ao invés de 2*N
    const clienteIds = filtrados.map(c => String(c.id));

    Promise.all([
      locacaoRepository.countAtivasByClientes(clienteIds),
      cobrancaRepository.hasSaldoPendenteFinalizadoBatch(clienteIds),
    ])
      .then(([locacoesMap, saldosSet]) => 
        setClientesComStatus(filtrados.map(c => ({ 
          ...c, 
          totalProdutos: locacoesMap.get(String(c.id)) ?? 0,
          temSaldoDevedor: saldosSet.has(String(c.id))
        })))
      )
      .catch(()    => setClientesComStatus(filtrados.map(c => ({ ...c, totalProdutos: 0, temSaldoDevedor: false }))))
      .finally(()  => setCarregandoStatus(false));
  }, [clientes, rotaId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  const filtrados = busca.trim()
    ? clientesComStatus.filter(c => c.nomeExibicao.toLowerCase().includes(busca.toLowerCase()))
    : clientesComStatus;

  const isLoading = (carregando || carregandoStatus) && clientesComStatus.length === 0;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* busca */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color="#9E9E9E" style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput} placeholder="Buscar cliente..."
          placeholderTextColor="#9E9E9E" value={busca} onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={18} color="#BDBDBD" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1976D2" /></View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => String(item.id)}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1976D2']} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={56} color="#E0E0E0" />
              <Text style={s.emptyText}>
                {busca ? 'Nenhum cliente encontrado' : 'Sem clientes nesta rota'}
              </Text>
            </View>
          }
          renderItem={({ item }: { item: ClienteComStatus }) => {
            const temProdutos = item.totalProdutos > 0;
            const temSaldo = item.temSaldoDevedor;
            const podeCobrar = temProdutos || temSaldo;
            return (
              <TouchableOpacity
                style={s.row}
                onPress={() => podeCobrar && navigation.navigate('CobrancaCliente', {
                  clienteId: String(item.id), clienteNome: item.nomeExibicao, rotaId, rotaNome,
                })}
                activeOpacity={podeCobrar ? 0.6 : 1}
              >
                <View style={s.iconStatus}>
                  {temProdutos ? (
                    <Ionicons name="checkmark" size={22} color="#1976D2" />
                  ) : temSaldo ? (
                    <Ionicons name="alert-circle" size={22} color="#E53935" />
                  ) : (
                    <Ionicons name="flash" size={20} color="#9E9E9E" />
                  )}
                </View>
                <View style={s.info}>
                  <Text style={s.nome}>{item.nomeExibicao}</Text>
                  <Text style={s.cidade}>{item.cidade} - {item.estado}</Text>
                  {temSaldo && !temProdutos && (
                    <Text style={s.saldoAlerta}>Saldo devedor pendente</Text>
                  )}
                </View>
                <View style={s.actions}>
                  {temProdutos && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{item.totalProdutos}P</Text>
                    </View>
                  )}
                  {temSaldo && !temProdutos && (
                    <View style={[s.badge, { backgroundColor: '#FFCDD2' }]}>
                      <Text style={[s.badgeText, { color: '#E53935' }]}>$</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={s.btnDetalhe}
                    onPress={() => navigation.navigate('ClienteDetail', { clienteId: String(item.id) })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="person-circle-outline" size={28} color="#BDBDBD" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEEEEE' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#212121' },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 12, minHeight: 64,
  },
  iconStatus: { width: 32, alignItems: 'center' },
  info:       { flex: 1, marginLeft: 8 },
  nome:       { fontSize: 15, color: '#212121' },
  cidade:     { fontSize: 13, color: '#757575', marginTop: 2 },
  saldoAlerta:{ fontSize: 11, color: '#E53935', marginTop: 2, fontWeight: '600' },
  actions:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center',
  },
  badgeText:  { fontSize: 13, color: '#424242', fontWeight: '600' },
  btnDetalhe: { padding: 2 },
  sep:        { height: 1, backgroundColor: '#F0F0F0', marginLeft: 56 },
  empty:      { flex: 1, padding: 48, alignItems: 'center', gap: 12 },
  emptyText:  { fontSize: 15, color: '#9E9E9E', textAlign: 'center' },
});
