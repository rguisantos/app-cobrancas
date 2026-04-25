/**
 * ProdutoCard.tsx
 * Card de produto reutilizável para listagens
 * 
 * Uso:
 * <ProdutoCard
 *   produto={produto}
 *   onPress={() => navigation.navigate('ProdutoDetail', { id: produto.id })}
 * />
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProdutoListItem } from '../../types';
import StatusBadge from '../StatusBadge';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProdutoCardProps {
  produto: ProdutoListItem;
  onPress?: () => void;
  onLongPress?: () => void;
  showCliente?: boolean;
  showRelogio?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ProdutoCard({
  produto,
  onPress,
  onLongPress,
  showCliente = true,
  showRelogio = false,
}: ProdutoCardProps) {
  const estaLocado = !!produto.clienteNome;
  const statusColor = estaLocado ? 'info' : produto.statusProduto === 'Ativo' ? 'success' : 'neutral';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >      {/* Ícone do Tipo */}
      <View style={styles.iconContainer}>
        <Ionicons
          name={produto.tipoNome.toLowerCase().includes('bilhar') ? 'cube' : 'radio'}
          size={24}
          color="#2563EB"
        />
      </View>

      {/* Info */}
      <View style={styles.content}>
        <Text style={styles.nome} numberOfLines={1}>
          {produto.tipoNome} N° {produto.identificador}
        </Text>
        <Text style={styles.descricao} numberOfLines={1}>
          {produto.descricaoNome} • {produto.tamanhoNome}
        </Text>
        {showCliente && produto.clienteNome && (
          <View style={styles.clienteRow}>
            <Ionicons name="person-outline" size={14} color="#64748B" />
            <Text style={styles.clienteNome} numberOfLines={1}>
              {produto.clienteNome}
            </Text>
          </View>
        )}
      </View>

      {/* Status */}
      <View style={styles.statusContainer}>
        <StatusBadge
          status={statusColor}
          label={estaLocado ? 'Locado' : produto.statusProduto}
          size="small"
        />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  nome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  descricao: {
    fontSize: 13,
    color: '#64748B',
  },
  clienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  clienteNome: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
});

// ============================================================================
// VARIANTE PARA ESTOQUE
// ============================================================================

export function ProdutoEstoqueCard({
  produto,  onPress,
}: Omit<ProdutoCardProps, 'onLongPress' | 'showCliente' | 'showRelogio'>) {
  return (
    <ProdutoCard
      produto={produto}
      onPress={onPress}
      showCliente={false}
      showRelogio={true}
    />
  );
}