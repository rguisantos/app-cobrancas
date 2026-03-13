/**
 * StatusBadge.tsx
 * Componente de badge de status reutilizável
 * 
 * Uso:
 * <StatusBadge status="Ativo" />
 * <StatusBadge status="Inativo" variant="secondary" />
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// TIPOS
// ============================================================================

export type StatusType =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  variant?: 'solid' | 'outline' | 'soft';
  size?: 'small' | 'medium' | 'large';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

// ============================================================================
// CONFIGURAÇÃO DE CORES
// ============================================================================

const statusConfig: Record<StatusType, { color: string; bg: string; icon: string }> = {
  success: { color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' },
  warning: { color: '#EA580C', bg: '#FFFBEB', icon: 'warning' },
  danger: { color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle' },
  info: { color: '#2563EB', bg: '#DBEAFE', icon: 'information-circle' },
  neutral: { color: '#64748B', bg: '#F1F5F9', icon: 'ellipse' },
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function StatusBadge({
  status,
  label,
  variant = 'soft',
  size = 'medium',
  icon,
  style,
}: StatusBadgeProps) {
  const config = statusConfig[status as StatusType] || statusConfig.neutral;
  const iconName = icon || config.icon;

  const sizes = {
    small: { container: { paddingVertical: 2, paddingHorizontal: 6 }, text: 10, icon: 12 },
    medium: { container: { paddingVertical: 4, paddingHorizontal: 10 }, text: 12, icon: 14 },
    large: { container: { paddingVertical: 6, paddingHorizontal: 14 }, text: 14, icon: 16 },
  };

  const currentSize = sizes[size];

  const getContainerStyle = () => {
    const base = [
      styles.container,
      currentSize.container,
      { backgroundColor: variant === 'soft' ? config.bg : 'transparent' },
      variant === 'outline' && { borderWidth: 1, borderColor: config.color },
      style,
    ];
    return base;
  };

  const getTextStyle = () => [
    styles.text,
    { fontSize: currentSize.text, color: config.color },
  ];

  return (
    <View style={getContainerStyle()}>
      <Ionicons name={iconName as any} size={currentSize.icon} color={config.color} />
      {label && <Text style={getTextStyle()}>{label || status}</Text>}
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
    gap: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});

// ============================================================================
// VARIANTE PONTO (apenas indicador)
// ============================================================================

export function StatusDot({ status }: { status: StatusType | string }) {
  const config = statusConfig[status as StatusType] || statusConfig.neutral;

  return (
    <View
      style={[
        stylesDot.dot,
        { backgroundColor: config.color },
      ]}
    />
  );
}

const stylesDot = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});