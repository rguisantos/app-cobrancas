/**
 * SyncIndicator.tsx
 * Componente para exibição do status de sincronização
 * 
 * Uso:
 * <SyncIndicator 
 *   status="synced" 
 *   isSyncing={false} 
 *   size="medium"
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SyncIndicatorProps {
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
  isSyncing: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  style?: ViewStyle;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SyncIndicator({
  status,
  isSyncing,
  size = 'medium',
  showLabel = false,
  style,
}: SyncIndicatorProps) {
  // Configurações por tamanho
  const sizes = {
    small: { icon: 16, text: 12, container: { padding: 6 } },
    medium: { icon: 20, text: 14, container: { padding: 8 } },
    large: { icon: 24, text: 16, container: { padding: 12 } },
  };

  const currentSize = sizes[size];

  // Configurações por status
  const getStatusConfig = () => {
    if (isSyncing) {
      return {
        icon: 'sync-outline' as const,
        color: '#2563EB',
        label: 'Sincronizando',
        animated: true,
      };
  
  }

    switch (status) {
      case 'synced':
        return {
          icon: 'checkmark-circle' as const,
          color: '#16A34A',
          label: 'Sincronizado',
          animated: false,
        };
      case 'syncing':
        return {
          icon: 'sync-outline' as const,
          color: '#2563EB',
          label: 'Sincronizando',
          animated: true,
        };
      case 'pending':
        return {
          icon: 'time-outline' as const,
          color: '#EA580C',
          label: 'Pendente',
          animated: false,
        };
      case 'conflict':
        return {
          icon: 'warning' as const,
          color: '#DC2626',
          label: 'Conflito',
          animated: false,
        };
      case 'error':
        return {
          icon: 'close-circle' as const,
          color: '#DC2626',
          label: 'Erro',
          animated: false,
        };
  
  }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, currentSize.container, style]}>
      {isSyncing ? (
        <ActivityIndicator size={size === 'large' ? 'large' : 'small'} color={config.color} />
      ) : (
        <Ionicons
          name={config.icon}
          size={currentSize.icon}
          color={config.color}
        />
      )}

      {showLabel && (
        <Text style={[styles.label, { fontSize: currentSize.text, color: config.color }]}>
          {config.label}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
  },
  label: {
    fontWeight: '600',
  },
  badge: {
    // Override para badge
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DBEAFE',
    padding: 12,
    borderRadius: 10,
  },
  pendingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
});

// ============================================================================
// VARIANTES ESPECIAIS
// ============================================================================

/**
 * Badge compacto para header (apenas ícone)
 */
export function SyncBadge({
  status,
  isSyncing,
}: Omit<SyncIndicatorProps, 'size' | 'showLabel'>) {
  return (
    <SyncIndicator
      status={status}
      isSyncing={isSyncing}
      size="small"
      showLabel={false}
      style={styles.badge}
    />
  );
}

/**
 * Card completo com detalhes
 */
export function SyncStatusCard({
  status,
  isSyncing,
  lastSyncAt,
  mudancasPendentes,
}: SyncIndicatorProps & {
  lastSyncAt?: string | null;
  mudancasPendentes?: number;
}) {
  const formatarData = (date: string | null) => {
    if (!date) return 'Nunca';
    const d = new Date(date);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} h atrás`;
    return `${Math.floor(diffMinutes / 1440)} d atrás`;
  };

  return (
    <View style={styles.statusCard}>
      <SyncIndicator
        status={status}
        isSyncing={isSyncing}
        size="large"
        showLabel={true}
      />
      
      <View style={styles.statusInfo}>
        <Text style={styles.statusLabel}>Última sincronização</Text>
        <Text style={styles.statusValue}>{formatarData(lastSyncAt || null)}</Text>
      </View>

      {mudancasPendentes !== undefined && mudancasPendentes > 0 && (
        <View style={styles.pendingInfo}>
          <Ionicons name="cloud-upload-outline" size={20} color="#2563EB" />
          <Text style={styles.pendingValue}>{mudancasPendentes} pendentes</Text>
        </View>
      )}
    </View>
  );
}
