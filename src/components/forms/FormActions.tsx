/**
 * FormActions.tsx
 * Componente de ações de formulário (botões) reutilizável
 * 
 * Uso:
 * <FormActions
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 *   loading={carregando}
 *   submitLabel="Salvar"
 *   cancelLabel="Cancelar"
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '../BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface FormActionsProps {
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
  onSecondary?: () => void;
  loading?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  secondaryLabel?: string;
  showCancel?: boolean;
  showSecondary?: boolean;
  style?: ViewStyle;
  testID?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function FormActions({  onSubmit,
  onCancel,
  onSecondary,
  loading = false,
  disabled = false,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  secondaryLabel,
  showCancel = true,
  showSecondary = false,
  style,
  testID,
}: FormActionsProps) {
  const { primaryColor } = useBranding();

  const handleSubmit = React.useCallback(async () => {
    if (disabled || loading) return;
    await onSubmit();
  }, [onSubmit, disabled, loading]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Secondary Action (optional) */}
      {showSecondary && onSecondary && (
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onSecondary}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}

      {/* Cancel Action (optional) */}
      {showCancel && onCancel && (
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onCancel}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
        </TouchableOpacity>
      )}

      {/* Submit Action */}
      <TouchableOpacity
        style={[
          styles.button,          styles.submitButton,
          { backgroundColor: primaryColor },
          (disabled || loading) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  submitButton: {
    // Cor definida inline
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// ============================================================================
// VARIANTE APENAS SUBMIT
// ============================================================================

export function FormSubmitButton({
  onSubmit,
  loading = false,
  disabled = false,
  submitLabel = 'Salvar',
  style,
}: Omit<FormActionsProps, 'onCancel' | 'onSecondary' | 'showCancel' | 'showSecondary'>) {
  const { primaryColor } = useBranding();

  return (
    <TouchableOpacity
      style={[
        stylesSubmit.container,
        { backgroundColor: primaryColor },
        (disabled || loading) && stylesSubmit.containerDisabled,
        style,
      ]}
      onPress={onSubmit}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (        <>
          <Ionicons name="save-outline" size={20} color="#FFFFFF" />
          <Text style={stylesSubmit.text}>{submitLabel}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const stylesSubmit = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    margin: 16,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});