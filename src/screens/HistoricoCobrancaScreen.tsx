/**
 * HistoricoCobrancaScreen.tsx
 * Tela de histórico de cobranças de um cliente
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HistoricoCobranca, StatusPagamento, formatarMoeda } from '../types';

const statusColors: Record<StatusPagamento, string> = {
  Pago: '#16A34A',
  Parcial: '#D97706',
  Pendente: '#DC2626',
  Atrasado: '#B91C1C',
};

interface Props {
  route: {
    params: {
      clienteId: string;
    };
  };
  navigation: any;
}

export default function HistoricoCobrancaScreen({ route, navigation }: Props) {
  const { clienteId } = route.params;
  const [historico, setHistorico] = useState<HistoricoCobranca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistorico();
  }, [clienteId]);

  const loadHistorico = async () => {
    try {
      setLoading(true);
      // TODO: Carregar do banco de dados
      await new Promise(resolve => setTimeout(resolve, 500));
      // Mock
      setHistorico([
        {
          id: '1',
          tipo: 'cobranca',
          locacaoId: '1',
          clienteId: clienteId,
          clienteNome: 'João da Silva',
          produtoIdentificador: '515',
          dataInicio: '2024-03-01',
          dataFim: '2024-03-31',
          relogioAnterior: 8070,
          relogioAtual: 8150,
          fichasRodadas: 80,
          valorFicha: 2.5,
          totalBruto: 200,
          percentualEmpresa: 30,
          subtotalAposDescontos: 200,
          valorPercentual: 60,
          totalClientePaga: 140,
          valorRecebido: 140,
          saldoDevedorGerado: 0,
          status: 'Pago',
          dataPagamento: '2024-03-31',
          createdAt: '2024-03-31',
          updatedAt: '2024-03-31',
          syncStatus: 'synced',
          needsSync: false,
          version: 1,
          deviceId: 'device-1',
        },
        {
          id: '2',
          tipo: 'cobranca',
          locacaoId: '1',
          clienteId: clienteId,
          clienteNome: 'João da Silva',
          produtoIdentificador: '515',
          dataInicio: '2024-02-01',
          dataFim: '2024-02-29',
          relogioAnterior: 7990,
          relogioAtual: 8070,
          fichasRodadas: 80,
          valorFicha: 2.5,
          totalBruto: 200,
          percentualEmpresa: 30,
          subtotalAposDescontos: 200,
          valorPercentual: 60,
          totalClientePaga: 140,
          valorRecebido: 140,
          saldoDevedorGerado: 0,
          status: 'Pago',
          dataPagamento: '2024-02-29',
          createdAt: '2024-02-29',
          updatedAt: '2024-02-29',
          syncStatus: 'synced',
          needsSync: false,
          version: 1,
          deviceId: 'device-1',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCobranca = ({ item }: { item: HistoricoCobranca }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CobrancaDetail', { cobrancaId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Ionicons name="cube" size={20} color="#2563EB" />
          <Text style={styles.produtoText}>N° {item.produtoIdentificador}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColors[item.status]}20` }]}>
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Período</Text>
          <Text style={styles.value}>
            {new Date(item.dataInicio).toLocaleDateString('pt-BR')} - {new Date(item.dataFim).toLocaleDateString('pt-BR')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Fichas</Text>
          <Text style={styles.value}>{item.fichasRodadas}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Valor</Text>
          <Text style={[styles.value, styles.valueHighlight]}>{formatarMoeda(item.totalClientePaga)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </View>
    </TouchableOpacity>
  );

  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhuma cobrança</Text>
      <Text style={styles.emptyText}>Este cliente não possui histórico de cobranças</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={historico}
        keyExtractor={(item) => item.id}
        renderItem={renderCobranca}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={EmptyList}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  produtoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#64748B',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  valueHighlight: {
    color: '#2563EB',
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});
