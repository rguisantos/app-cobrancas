/**
 * LocacoesListScreen.tsx
 * Lista de locações de um cliente com ações: relocar e enviar para estoque
 */

import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ModalStackParamList } from '../navigation/AppNavigator';

import { useLocacao }              from '../contexts/LocacaoContext';
import { useClienteNavigate }      from '../navigation/ClientesStack';
import { LocacaoListItem, StatusLocacao } from '../types';

type Props = NativeStackScreenProps<ModalStackParamList, 'LocacoesList'>;

const STATUS_CFG: Record<StatusLocacao, { color: string; bg: string }> = {
  Ativa:      { color: '#16A34A', bg: '#DCFCE7' },
  Finalizada: { color: '#64748B', bg: '#F1F5F9' },
  Cancelada:  { color: '#DC2626', bg: '#FEF2F2' },
};

const FORMA_LABELS: Record<string, string> = {
  Periodo:           'Valor Fixo',
  PercentualPagar:   '% a Pagar',
  PercentualReceber: '% a Receber',
};

export default function LocacoesListScreen({ route, navigation }: Props) {
  const { clienteId } = route.params;
  const { locacoes, carregando, carregarLocacoesPorCliente } = useLocacao();
  const navigateCliente = useClienteNavigate();

  useFocusEffect(
    useCallback(() => {
      carregarLocacoesPorCliente(clienteId);
    }, [clienteId, carregarLocacoesPorCliente])
  );

  const handleRelocar = useCallback((item: LocacaoListItem) => {
    navigateCliente.toRelocar(String(item.id), String(item.produtoId || ''), clienteId);
  }, [navigateCliente, clienteId]);

  const handleEnviarEstoque = useCallback((item: LocacaoListItem) => {
    navigation.navigate('EnviarEstoque', {
      locacaoId: String(item.id),
      produtoId: String(item.produtoId || ''),
    });
  }, [navigation]);

  const handleDetalhe = useCallback((item: LocacaoListItem) => {
    navigation.navigate('LocacaoDetail', { locacaoId: String(item.id) });
  }, [navigation]);

  const renderItem = ({ item }: { item: LocacaoListItem }) => {
    const cfg = STATUS_CFG[item.status] || STATUS_CFG.Finalizada;
    const ativa = item.status === 'Ativa';

    return (
      <TouchableOpacity style={s.card} onPress={() => handleDetalhe(item)} activeOpacity={0.8}>
        {/* Cabeçalho */}
        <View style={s.cardHead}>
          <View style={s.prodBox}>
            <Ionicons name="cube" size={18} color="#2563EB" />
            <Text style={s.prodNome}>{item.produtoTipo} N° {item.produtoIdentificador}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.statusText, { color: cfg.color }]}>{item.status}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={s.info}>
          <View style={s.infoRow}>
            <Ionicons name="calendar-outline" size={14} color="#94A3B8" />
            <Text style={s.infoText}>
              Desde {new Date(item.dataLocacao).toLocaleDateString('pt-BR')}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="speedometer-outline" size={14} color="#94A3B8" />
            <Text style={s.infoText}>Relógio: {item.numeroRelogio}</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="cash-outline" size={14} color="#94A3B8" />
            <Text style={s.infoText}>
              {FORMA_LABELS[item.formaPagamento] ?? item.formaPagamento}
              {item.formaPagamento !== 'Periodo'
                ? ` · ${item.percentualEmpresa}% empresa`
                : ` · R$ ${item.precoFicha?.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Ações (só para locações ativas) */}
        {ativa && (
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnBlue]}
              onPress={() => handleRelocar(item)}
            >
              <Ionicons name="swap-horizontal" size={15} color="#2563EB" />
              <Text style={[s.actionBtnText, { color: '#2563EB' }]}>Relocar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnOrange]}
              onPress={() => handleEnviarEstoque(item)}
            >
              <Ionicons name="archive" size={15} color="#EA580C" />
              <Text style={[s.actionBtnText, { color: '#EA580C' }]}>Estoque</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnGreen]}
              onPress={() => navigation.navigate('CobrancaConfirm', { locacaoId: String(item.id) })}
            >
              <Ionicons name="cash" size={15} color="#16A34A" />
              <Text style={[s.actionBtnText, { color: '#16A34A' }]}>Cobrar</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {carregando && locacoes.length === 0 ? (
        <View style={s.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      ) : (
        <FlatList
          data={locacoes}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[s.list, locacoes.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={carregando}
              onRefresh={() => carregarLocacoesPorCliente(clienteId)}
              colors={['#2563EB']}
            />
          }
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Nenhuma locação</Text>
              <Text style={s.emptyText}>Toque no + para adicionar a primeira locação</Text>
            </View>
          )}
        />
      )}

      {/* FAB - Nova Locação */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('LocacaoForm', { clienteId, modo: 'criar' })}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F8FAFC' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:         { padding: 16, paddingBottom: 88 },
  listEmpty:    { flexGrow: 1 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  prodBox:      { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  prodNome:     { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText:   { fontSize: 11, fontWeight: '700' },

  info:         { gap: 5, marginBottom: 12 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText:     { fontSize: 13, color: '#64748B' },

  actions:      { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  actionBtn:    {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  actionBtnBlue:  { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  actionBtnOrange:{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  actionBtnGreen: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  actionBtnText:  { fontSize: 13, fontWeight: '700' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
  emptyTitle:   { fontSize: 18, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:    { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center', elevation: 5,
  },
});
