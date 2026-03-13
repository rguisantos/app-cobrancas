/**
 * LocacoesListScreen.tsx
 * Lista de locações de um cliente específico
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';
import { LocacaoListItem, StatusLocacao } from '../types';

type Props = NativeStackScreenProps<ModalStackParamList, 'LocacoesList'>;

const statusColors: Record<StatusLocacao, string> = {
  Ativa: '#22C55E',
  Finalizada: '#64748B',
  Cancelada: '#EF4444',
};

export default function LocacoesListScreen({ route, navigation }: Props) {
  const { clienteId } = route.params;
  
  const [locacoes, setLocacoes] = useState<LocacaoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocacoes();
  }, [clienteId]);

  const loadLocacoes = async () => {
    try {
      setLoading(true);
      // TODO: Carregar do banco de dados
      // Mock temporário
      await new Promise(resolve => setTimeout(resolve, 500));
      setLocacoes([
        {
          id: '1',
          produtoIdentificador: '515',
          produtoTipo: 'Bilhar',
          produtoDescricao: 'Azul',
          produtoTamanho: '2,20',
          formaPagamento: 'Periodo',
          numeroRelogio: '8070',
          percentualEmpresa: 30,
          precoFicha: 2.5,
          dataLocacao: '2024-01-15',
          status: 'Ativa',
        },
        {
          id: '2',
          produtoIdentificador: '320',
          produtoTipo: 'Jukebox',
          produtoDescricao: 'Padrão Grande',
          produtoTamanho: 'Grande',
          formaPagamento: 'PercentualPagar',
          numeroRelogio: '1520',
          percentualEmpresa: 25,
          precoFicha: 0,
          dataLocacao: '2024-02-20',
          status: 'Ativa',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar locações:', error);
    } finally {
      setLoading(false);
  
  }
  };

  const renderLocacao = ({ item }: { item: LocacaoListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('LocacaoDetail', { locacaoId: String(item.id) })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.identificador}>
          <Ionicons name="cube" size={20} color="#2563EB" />
          <Text style={styles.identificadorText}>N° {item.produtoIdentificador}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColors[item.status]}20` }]}>
          <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.produtoTipo}>{item.produtoTipo}</Text>
        <Text style={styles.produtoDesc}>
          {item.produtoDescricao} - {item.produtoTamanho}
        </Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="speedometer-outline" size={16} color="#64748B" />
          <Text style={styles.infoText}>Relógio: {item.numeroRelogio}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#64748B" />
          <Text style={styles.infoText}>
            Desde {new Date(item.dataLocacao).toLocaleDateString('pt-BR')}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.formaPagamento}>
          {item.formaPagamento === 'Periodo' ? 'Valor Fixo' : 'Percentual'}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </View>
    </TouchableOpacity>
  );

  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhuma locação</Text>
      <Text style={styles.emptyText}>Este cliente não possui locações cadastradas</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={locacoes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderLocacao}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={EmptyList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('LocacaoForm', { 
          clienteId, 
          modo: 'criar' 
        })}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
    paddingBottom: 80,
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
  identificador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  identificadorText: {
    fontSize: 16,
    fontWeight: '700',
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
    gap: 6,
  },
  produtoTipo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  produtoDesc: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#64748B',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  formaPagamento: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500',
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
