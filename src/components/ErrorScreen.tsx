/**
 * ErrorScreen.tsx
 * Tela de erro reutilizável
 * 
 * Uso:
 * <ErrorScreen 
 *   error={error} 
 *   onRetry={handleRetry}
 *   title="Ops!"
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from './BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ErrorScreenProps {
  error?: Error | null;
  onRetry?: () => void;
  title?: string;
  subtitle?: string;
  showDetails?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ErrorScreen({
  error,
  onRetry,
  title = 'Ops! Algo deu errado',
  subtitle = 'Ocorreu um erro inesperado. Tente novamente.',
  showDetails = false,
}: ErrorScreenProps) {
  const { primaryColor } = useBranding();

  return (
    <View style={styles.container}>      <View style={styles.content}>
        {/* Ícone */}
        <View style={[styles.iconContainer, { backgroundColor: `${primaryColor}1A` }]}>
          <Ionicons name="alert-circle" size={48} color={primaryColor} />
        </View>

        {/* Título */}
        <Text style={styles.title}>{title}</Text>

        {/* Subtítulo */}
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Mensagem de erro (dev) */}
        {showDetails && error && (
          <ScrollView style={styles.errorScroll}>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.stack && (
              <Text style={styles.errorStack}>{error.stack}</Text>
            )}
          </ScrollView>
        )}

        {/* Botão de Retry */}
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: primaryColor }]}
            onPress={onRetry}
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Tentar Novamente</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {    alignItems: 'center',
    maxWidth: 400,
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
    fontSize: 20,
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
  errorScroll: {
    maxHeight: 150,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'monospace',
  },
  errorStack: {
    fontSize: 11,
    color: '#991B1B',
    fontFamily: 'monospace',
    marginTop: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,    gap: 8,
    minWidth: 200,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// ============================================================================
// VARIANTE COMPACTA (para dentro de cards)
// ============================================================================

export function ErrorInline({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { primaryColor } = useBranding();

  return (
    <View style={errorInlineStyles.container}>
      <Ionicons name="warning" size={24} color="#DC2626" />
      <Text style={errorInlineStyles.message}>
        {message || 'Erro ao carregar dados'}
      </Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={[errorInlineStyles.retryText, { color: primaryColor }]}>
            Tentar novamente
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const errorInlineStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  message: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});