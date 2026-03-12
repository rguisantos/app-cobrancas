/**
 * ClienteCard.tsx
 * Card de cliente reutilizável para listagens
 * 
 * Uso:
 * <ClienteCard
 *   cliente={cliente}
 *   onPress={() => navigation.navigate('ClienteDetail', { id: cliente.id })}
 * />
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClienteListItem } from '../../types';
import { StatusBadge } from '../StatusBadge';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ClienteCardProps {
  cliente: ClienteListItem;
  onPress?: () => void;
  onLongPress?: () => void;
  showRota?: boolean;
  showContatos?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ClienteCard({
  cliente,
  onPress,
  onLongPress,
  showRota = true,
  showContatos = false,
}: ClienteCardProps) {
  const initial = cliente.nomeExibicao.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      {/* Info */}
      <View style={styles.content}>
        <Text style={styles.nome} numberOfLines={1}>
          {cliente.nomeExibicao}
        </Text>
        <Text style={styles.documento} numberOfLines={1}>
          {cliente.cpfCnpj || 'CPF/CNPJ não informado'}
        </Text>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color="#64748B" />
          <Text style={styles.local} numberOfLines={1}>
            {cliente.cidade} - {cliente.estado}
          </Text>
        </View>
        {showRota && cliente.rotaNome && (
          <View style={styles.infoRow}>
            <Ionicons name="map-outline" size={14} color="#64748B" />
            <Text style={styles.rota} numberOfLines={1}>
              {cliente.rotaNome}
            </Text>
          </View>
        )}
      </View>

      {/* Status */}
      <StatusBadge
        status={cliente.status === 'Ativo' ? 'success' : 'neutral'}
        label={cliente.status}
        size="small"
      />
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
    padding: 16,
    gap: 12,    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  nome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  documento: {
    fontSize: 13,
    color: '#64748B',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  local: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  rota: {
    fontSize: 12,
    color: '#2563EB',
    flex: 1,
  },
});

// ============================================================================// VARIANTE COMPACTA
// ============================================================================

export function ClienteCardCompact({
  cliente,
  onPress,
}: Omit<ClienteCardProps, 'onLongPress' | 'showRota' | 'showContatos'>) {
  const initial = cliente.nomeExibicao.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={stylesCompact.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={stylesCompact.avatar}>
        <Text style={stylesCompact.avatarText}>{initial}</Text>
      </View>
      <View style={stylesCompact.content}>
        <Text style={stylesCompact.nome} numberOfLines={1}>
          {cliente.nomeExibicao}
        </Text>
        <Text style={stylesCompact.cidade} numberOfLines={1}>
          {cliente.cidade} - {cliente.estado}
        </Text>
      </View>
      <StatusBadge
        status={cliente.status === 'Ativo' ? 'success' : 'neutral'}
        size="small"
      />
    </TouchableOpacity>
  );
}

const stylesCompact = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  nome: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  cidade: {
    fontSize: 12,
    color: '#64748B',
  },
});