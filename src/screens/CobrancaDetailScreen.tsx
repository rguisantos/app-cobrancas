/**
 * CobrancaDetailScreen.tsx
 * Detalhes de uma cobrança específica
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';
import { HistoricoCobranca, StatusPagamento, formatarMoeda } from '../types';

type Props = NativeStackScreenProps<ModalStackParamList, 'CobrancaDetail'>;

const statusColors: Record<StatusPagamento, { bg: string; text: string }> = {
  Pago: { bg: '#DCFCE7', text: '#16A34A' },
  Parcial: { bg: '#FEF3C7', text: '#D97706' },
  Pendente: { bg: '#FEE2E2', text: '#DC2626' },
  Atrasado: { bg: '#FEE2E2', text: '#B91C1C' },
};

export default function CobrancaDetailScreen({ route, navigation }: Props) {
  const { cobrancaId } = route.params;
  const [cobranca, setCobranca] = useState<HistoricoCobranca | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCobranca();
  }, [cobrancaId]);

  const loadCobranca = async () => {
    try {
      setLoading(true);
      // TODO: Carregar do banco de dados
      await new Promise(resolve => setTimeout(resolve, 500));
      // Mock
      setCobranca({
        id: cobrancaId,
        tipo: 'cobranca',
        locacaoId: '1',
        clienteId: '1',
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
        createdAt: '2024-03-31',
        updatedAt: '2024-03-31',
        syncStatus: 'synced',
        needsSync: false,
        version: 1,
        deviceId: 'device-1',
      });
    } catch (error) {
      console.error('Erro ao carregar cobrança:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!cobranca) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Cobrança não encontrada</Text>
      </View>
    );
  }

  const statusConfig = statusColors[cobranca.status];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Header */}
        <View style={[styles.statusHeader, { backgroundColor: statusConfig.bg }]}>
          <View style={styles.statusIconContainer}>
            <Ionicons
              name={cobranca.status === 'Pago' ? 'checkmark-circle' : 'time'}
              size={32}
              color={statusConfig.text}
            />
          </View>
          <Text style={[styles.statusText, { color: statusConfig.text }]}>
            {cobranca.status}
          </Text>
          <Text style={styles.totalValue}>{formatarMoeda(cobranca.totalClientePaga)}</Text>
        </View>

        {/* Cliente e Produto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue}>{cobranca.clienteNome}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Produto</Text>
            <Text style={styles.infoValue}>N° {cobranca.produtoIdentificador}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Período</Text>
            <Text style={styles.infoValue}>
              {new Date(cobranca.dataInicio).toLocaleDateString('pt-BR')} a {new Date(cobranca.dataFim).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>

        {/* Leituras */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leituras</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Relógio Anterior</Text>
            <Text style={styles.infoValue}>{cobranca.relogioAnterior}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Relógio Atual</Text>
            <Text style={styles.infoValue}>{cobranca.relogioAtual}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fichas Rodadas</Text>
            <Text style={styles.infoValue}>{cobranca.fichasRodadas}</Text>
          </View>
        </View>

        {/* Valores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Valores</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Bruto</Text>
            <Text style={styles.infoValue}>{formatarMoeda(cobranca.totalBruto)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>% Empresa ({cobranca.percentualEmpresa}%)</Text>
            <Text style={styles.infoValue}>{formatarMoeda(cobranca.valorPercentual)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Valor Recebido</Text>
            <Text style={[styles.infoValue, styles.highlightValue]}>
              {formatarMoeda(cobranca.valorRecebido)}
            </Text>
          </View>
        </View>
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
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusIconContainer: {
    marginBottom: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
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
    color: '#16A34A',
    fontWeight: '700',
  },
});
