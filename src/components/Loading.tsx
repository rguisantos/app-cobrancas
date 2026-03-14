/**
 * Loading.tsx
 * Componente de loading reutilizável
 * 
 * Uso:
 * <Loading visible={carregando} message="Carregando..." />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ViewStyle,
} from 'react-native';
import { useBranding } from './BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface LoadingProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
  onRequestClose?: () => void;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Loading({
  visible,
  message = 'Carregando...',
  transparent = true,
  onRequestClose,
}: LoadingProps) {
  const { primaryColor } = useBranding();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={primaryColor} />
          {message && (
            <Text style={[styles.message, { color: primaryColor }]}>
              {message}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 150,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// ============================================================================
// VARIANTE INLINE (para dentro de cards)
// ============================================================================

export function LoadingInline({ size = 'small' }: { size?: 'small' | 'large' }) {
  const { primaryColor } = useBranding();

  return (
    <View style={stylesInline.inlineContainer}>
      <ActivityIndicator size={size} color={primaryColor} />
    </View>
  );
}

const stylesInline = StyleSheet.create({
  inlineContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});