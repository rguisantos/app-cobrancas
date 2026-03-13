/**
 * QuickAction.tsx
 * Componente para botões de ação rápida no dashboard
 * 
 * Uso:
 * <QuickAction
 *   title="Clientes"
 *   icon="people"
 *   color="#2563EB"
 *   onPress={() => navigation.navigate('Clientes')}
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// INTERFACES
// ============================================================================

export interface QuickActionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  
  // Opcional
  disabled?: boolean;
  badge?: number;
  subtitle?: string;
  
  // Customização
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function QuickAction({
  title,
  icon,
  color,
  onPress,
  disabled = false,
  badge,
  subtitle,
  style,
  size = 'medium',
}: QuickActionProps) {
  // Tamanhos pré-definidos
  const sizes = {
    small: {
      container: { padding: 12, minHeight: 90 },
      icon: 24,
      iconContainer: 48,
      title: 12,
    },
    medium: {
      container: { padding: 16, minHeight: 110 },
      icon: 28,
      iconContainer: 56,
      title: 13,
    },
    large: {
      container: { padding: 20, minHeight: 130 },
      icon: 32,
      iconContainer: 64,
      title: 14,
    },
  };

  const currentSize = sizes[size];
  const bgColor = `${color}1A`; // 10% opacity

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { ...currentSize.container, backgroundColor: bgColor },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* Ícone */}
      <View
        style={[
          styles.iconContainer,
          {
            width: currentSize.iconContainer,
            height: currentSize.iconContainer,
            backgroundColor: color,
          },
        ]}
      >
        <Ionicons name={icon} size={currentSize.icon} color="#FFFFFF" />
        
        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
            <Text style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>

      {/* Título */}
      <Text style={[styles.title, { fontSize: currentSize.title }]} numberOfLines={2}>
        {title}
      </Text>

      {/* Subtítulo */}
      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}

      {/* Overlay de disabled */}
      {disabled && <View style={styles.disabledOverlay} />}
    </TouchableOpacity>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '30%', // 3 cards por linha
    maxWidth: '30%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  disabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E2E8F0',
    opacity: 0.5,
    borderRadius: 16,
  },
});

// ============================================================================
// VARIANTES PRÉ-DEFINIDAS
// ============================================================================

export const QUICK_ACTION_COLORS = {
  blue: '#2563EB',
  green: '#16A34A',
  red: '#DC2626',
  purple: '#9333EA',
  orange: '#EA580C',
  teal: '#0D9488',
} as const;

export type QuickActionColor = keyof typeof QUICK_ACTION_COLORS;

export function QuickActionVariant({
  colorVariant,
  ...props
}: Omit<QuickActionProps, 'color'> & { colorVariant: QuickActionColor }) {
  return (
    <QuickAction
      color={QUICK_ACTION_COLORS[colorVariant]}
      {...props}
    />
  );
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================