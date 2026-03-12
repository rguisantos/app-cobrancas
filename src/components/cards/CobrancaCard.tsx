/**
 * CobrancaCard.tsx
 * Card de cobrança reutilizável para listagens
 * 
 * Uso:
 * <CobrancaCard
 *   cobranca={cobranca}
 *   onPress={() => navigation.navigate('CobrancaDetail', { id: cobranca.id })}
 * />
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HistoricoCobranca } from '../../types';
import { StatusBadge } from '../StatusBadge';
import { formatarMoeda, formatarData } from '../../utils/currency';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CobrancaCardProps {
  cobranca: HistoricoCobranca;
  onPress?: () => void;
  onLongPress?: () => void;
  showSaldo?: boolean;
  compact?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CobrancaCard({
  cobranca,
  onPress,
  onLongPress,
  showSaldo = true,
  compact = false,
}: CobrancaCardProps) {
  const statusConfig = {
    Pago: { color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' },
    Pendente: { color: '#EA580C', bg: '#FFFBEB', icon: 'time-outline' },
    Parcial: { color: '#2563EB', bg: '#DBEAFE', icon: 'ellipsis-horizontal' },
    Atrasado: { color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle' },
  };

  const config = statusConfig[cobranca.status as keyof typeof statusConfig] || statusConfig.Pendente;
  if (compact) {
    return (
      <TouchableOpacity
        style={stylesCompact.container}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <View style={stylesCompact.left}>
          <View style={[stylesCompact.icon, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={16} color={config.color} />
          </View>
          <View style={stylesCompact.info}>
            <Text style={stylesCompact.produto} numberOfLines={1}>
              {cobranca.produtoIdentificador}
            </Text>
            <Text style={stylesCompact.data} numberOfLines={1}>
              {formatarData(cobranca.dataInicio)}
            </Text>
          </View>
        </View>
        <View style={stylesCompact.right}>
          <Text style={stylesCompact.valor}>{formatarMoeda(cobranca.totalClientePaga)}</Text>
          <StatusBadge status={cobranca.status as any} size="small" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.produtoInfo}>
          <Text style={styles.produtoNome} numberOfLines={1}>
            {cobranca.produtoIdentificador}
          </Text>
          <Text style={styles.clienteNome} numberOfLines={1}>
            {cobranca.clienteNome}
          </Text>
        </View>
        <StatusBadge status={cobranca.status as any} size="small" />
      </View>

      {/* Info Grid */}      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.infoLabel}>Período</Text>
          <Text style={styles.infoValue}>
            {formatarData(cobranca.dataInicio)} - {formatarData(cobranca.dataFim)}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="timer-outline" size={14} color="#64748B" />
          <Text style={styles.infoLabel}>Fichas</Text>
          <Text style={styles.infoValue}>{cobranca.fichasRodadas}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerValue}>{formatarMoeda(cobranca.totalClientePaga)}</Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.footerLabel}>Recebido</Text>
          <Text style={[styles.footerValue, { color: '#16A34A' }]}>
            {formatarMoeda(cobranca.valorRecebido)}
          </Text>
        </View>
        {showSaldo && cobranca.saldoDevedorGerado > 0 && (
          <View style={styles.footerRight}>
            <Text style={styles.footerLabel}>Saldo</Text>
            <Text style={[styles.footerValue, { color: '#DC2626' }]}>
              {formatarMoeda(cobranca.saldoDevedorGerado)}
            </Text>
          </View>
        )}
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
    padding: 16,    gap: 12,
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
  clienteNome: {
    fontSize: 13,
    color: '#64748B',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  footerRight: {
    alignItems: 'flex-end',
  },
});

// ============================================================================
// VARIANTE COMPACTA
// ============================================================================

const stylesCompact = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,  },
  produto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  data: {
    fontSize: 12,
    color: '#64748B',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  valor: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
});