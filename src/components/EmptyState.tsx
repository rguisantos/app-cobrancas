/**
 * EmptyState.tsx
 * Componente de estado vazio reutilizável
 * 
 * Uso:
 * <EmptyState
 *   icon="people-outline"
 *   title="Nenhum cliente"
 *   subtitle="Cadastre seu primeiro cliente"
 *   actionLabel="Cadastrar"
 *   onAction={handleCadastrar}
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
import { useBranding } from './BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: ViewStyle;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function EmptyState({
  icon = 'document-outline',
  title,
  subtitle,
  actionLabel,
  onAction,  secondaryActionLabel,
  onSecondaryAction,
  style,
}: EmptyStateProps) {
  const { primaryColor } = useBranding();

  return (
    <View style={[styles.container, style]}>
      {/* Ícone */}
      <View style={[styles.iconContainer, { backgroundColor: `${primaryColor}1A` }]}>
        <Ionicons name={icon} size={48} color={primaryColor} />
      </View>

      {/* Título */}
      <Text style={styles.title}>{title}</Text>

      {/* Subtítulo */}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {/* Ações */}
      <View style={styles.actions}>
        {actionLabel && onAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: primaryColor }]}
            onPress={onAction}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryActionButton]}
            onPress={onSecondaryAction}
          >
            <Text style={styles.secondaryActionButtonText}>
              {secondaryActionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryActionButton: {
    backgroundColor: '#F1F5F9',
  },
  secondaryActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },});

// ============================================================================
// VARIANTE SIMPLES (sem ações)
// ============================================================================

export function EmptyStateSimple({
  icon,
  title,
  subtitle,
}: Omit<EmptyStateProps, 'actionLabel' | 'onAction'>) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      subtitle={subtitle}
      style={stylesSimple.container}
    />
  );
}

const stylesSimple = StyleSheet.create({
  container: {
    paddingVertical: 80,
  },
});