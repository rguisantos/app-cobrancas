/**
 * LocacaoCard.tsx
 * Card de locação reutilizável para listagens
 * 
 * Uso:
 * <LocacaoCard
 *   locacao={locacao}
 *   onPress={() => navigation.navigate('LocacaoDetail', { id: locacao.id })}
 * />
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocacaoListItem } from '../../types';
import StatusBadge from '../StatusBadge';
import { formatarMoeda } from '../../utils/currency';

// ============================================================================
// INTERFACES
// ============================================================================

export interface LocacaoCardProps {
  locacao: LocacaoListItem;
  onPress?: () => void;
  onLongPress?: () => void;
  showValor?: boolean;
  showData?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function LocacaoCard({
  locacao,
  onPress,
  onLongPress,
  showValor = true,
  showData = true,
}: LocacaoCardProps) {
  const dataFormatada = new Date(locacao.dataLocacao).toLocaleDateString('pt-BR');

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >      {/* Header */}
      <View style={styles.header}>
        <View style={styles.produtoInfo}>
          <Text style={styles.produtoNome} numberOfLines={1}>
            {locacao.produtoTipo} N° {locacao.produtoIdentificador}
          </Text>
          <Text style={styles.produtoDescricao} numberOfLines={1}>
            {locacao.produtoDescricao} • {locacao.produtoTamanho}
          </Text>
        </View>
        <StatusBadge
          status={locacao.status === 'Ativa' ? 'success' : 'neutral'}
          label={locacao.status}
          size="small"
        />
      </View>

      {/* Info Grid */}
      <View style={styles.infoGrid}>
        {showData && (
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={16} color="#64748B" />
            <Text style={styles.infoLabel}>Data Locação</Text>
            <Text style={styles.infoValue}>{dataFormatada}</Text>
          </View>
        )}

        <View style={styles.infoItem}>
          <Ionicons name="timer-outline" size={16} color="#64748B" />
          <Text style={styles.infoLabel}>Relógio</Text>
          <Text style={styles.infoValue}>{locacao.numeroRelogio}</Text>
        </View>

        {showValor && (
          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={16} color="#64748B" />
            <Text style={styles.infoLabel}>Valor Ficha</Text>
            <Text style={styles.infoValue}>{formatarMoeda(locacao.precoFicha)}</Text>
          </View>
        )}

        <View style={styles.infoItem}>
          <Ionicons name="pie-chart-outline" size={16} color="#64748B" />
          <Text style={styles.infoLabel}>% Empresa</Text>
          <Text style={styles.infoValue}>{locacao.percentualEmpresa}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  produtoInfo: {
    flex: 1,
    gap: 4,
  },
  produtoNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  produtoDescricao: {
    fontSize: 13,
    color: '#64748B',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: '45%',
  },
  infoLabel: {    fontSize: 11,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
});

// ============================================================================
// VARIANTE RESUMO (para dashboard)
// ============================================================================

export function LocacaoResumoCard({
  locacao,
  onPress,
}: Omit<LocacaoCardProps, 'onLongPress' | 'showValor' | 'showData'>) {
  return (
    <TouchableOpacity
      style={stylesResumo.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={stylesResumo.header}>
        <Text style={stylesResumo.produtoNome} numberOfLines={1}>
          {locacao.produtoTipo} N° {locacao.produtoIdentificador}
        </Text>
        <StatusBadge
          status={locacao.status === 'Ativa' ? 'success' : 'neutral'}
          size="small"
        />
      </View>
      <Text style={stylesResumo.cliente} numberOfLines={1}>
        {locacao.produtoDescricao}
      </Text>
    </TouchableOpacity>
  );
}

const stylesResumo = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  header: {    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  produtoNome: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  cliente: {
    fontSize: 12,
    color: '#64748B',
  },
});