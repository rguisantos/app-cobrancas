/**
 * LocacaoDetailScreen.tsx
 * Detalhes de uma locação específica
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';
import { Locacao, StatusLocacao } from '../types';
import { formatarMoeda } from '../types';

type Props = NativeStackScreenProps<ModalStackParamList, 'LocacaoDetail'>;

const statusColors: Record<StatusLocacao, { bg: string; text: string }> = {
  Ativa: { bg: '#DCFCE7', text: '#16A34A' },
  Finalizada: { bg: '#F1F5F9', text: '#64748B' },
  Cancelada: { bg: '#FEE2E2', text: '#DC2626' },
};

export default function LocacaoDetailScreen({ route, navigation }: Props) {
  const { locacaoId } = route.params;
  
  const [locacao, setLocacao] = useState<Locacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocacao();
  }, [locacaoId]);

  const loadLocacao = async () => {
    try {
      setLoading(true);
      // TODO: Carregar do banco de dados
      await new Promise(resolve => setTimeout(resolve, 500));
      // Mock
      setLocacao({
        id: locacaoId,
        tipo: 'locacao',
        clienteId: '1',
        clienteNome: 'João da Silva',
        produtoId: '515',
        produtoIdentificador: '515',
        produtoTipo: 'Bilhar',
        dataLocacao: '2024-01-15',
        formaPagamento: 'Periodo',
        numeroRelogio: '8070',
        precoFicha: 2.5,
        percentualEmpresa: 30,
        percentualCliente: 70,
        periodicidade: 'Mensal',
        valorFixo: 150,
        status: 'Ativa',
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15',
        syncStatus: 'synced',
        needsSync: false,
        version: 1,
        deviceId: 'device-1',
      });
    } catch (error) {
      console.error('Erro ao carregar locação:', error);
    } finally {
      setLoading(false);
  
  }
  };

  const handleFinalizar = () => {
    Alert.alert(
      'Finalizar Locação',
      'Deseja realmente finalizar esta locação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Finalizar', 
          style: 'destructive',
          onPress: async () => {
            // TODO: Implementar finalização
            navigation.goBack();
        
  }
      
  }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );

  }

  if (!locacao) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Locação não encontrada</Text>
      </View>
    );

  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View style={styles.identificadorContainer}>
            <Ionicons name="cube" size={32} color="#2563EB" />
            <View style={styles.identificadorInfo}>
              <Text style={styles.identificadorText}>N° {locacao.produtoIdentificador}</Text>
              <Text style={styles.tipoText}>{locacao.produtoTipo}</Text>
            </View>
          </View>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: statusColors[locacao.status].bg }
          ]}>
            <Text style={[
              styles.statusText, 
              { color: statusColors[locacao.status].text }
            ]}>
              {locacao.status}
            </Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <TouchableOpacity 
            style={styles.clientCard}
            onPress={() => navigation.navigate('ClienteDetail', { clienteId: String(locacao.clienteId) })}
          >
            <Ionicons name="person" size={24} color="#2563EB" />
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{locacao.clienteNome}</Text>
              <Text style={styles.clientAction}>Ver detalhes</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* Dados da Locação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados da Locação</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Data Início</Text>
            <Text style={styles.infoValue}>
              {new Date(locacao.dataLocacao).toLocaleDateString('pt-BR')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>N° Relógio</Text>
            <Text style={styles.infoValue}>{locacao.numeroRelogio}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Forma Pagamento</Text>
            <Text style={styles.infoValue}>
              {locacao.formaPagamento === 'Periodo' ? 'Valor Fixo' : 
               locacao.formaPagamento === 'PercentualPagar' ? 'Percentual a Pagar' : 
               'Percentual a Receber'}
            </Text>
          </View>

          {locacao.valorFixo && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Valor Fixo</Text>
              <Text style={[styles.infoValue, styles.highlightValue]}>
                {formatarMoeda(locacao.valorFixo)}
              </Text>
            </View>
          )}

          {locacao.periodicidade && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Periodicidade</Text>
              <Text style={styles.infoValue}>{locacao.periodicidade}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>% Empresa</Text>
            <Text style={styles.infoValue}>{locacao.percentualEmpresa}%</Text>
          </View>

          {locacao.precoFicha > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Preço Ficha</Text>
              <Text style={styles.infoValue}>{formatarMoeda(locacao.precoFicha)}</Text>
            </View>
          )}
        </View>

        {/* Ações */}
        {locacao.status === 'Ativa' && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('CobrancaConfirm', { locacaoId: locacao.id })}
            >
              <Ionicons name="cash" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Realizar Cobrança</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleFinalizar}
            >
              <Ionicons name="close-circle" size={20} color="#64748B" />
              <Text style={styles.secondaryButtonText}>Finalizar Locação</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  identificadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identificadorInfo: {
    gap: 2,
  },
  identificadorText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  tipoText: {
    fontSize: 14,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  clientAction: {
    fontSize: 13,
    color: '#2563EB',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  highlightValue: {
    color: '#2563EB',
    fontWeight: '700',
  },
  actionsSection: {
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
  },
});
