/**
 * ConfirmDialog.tsx
 * Componente de diálogo de confirmação reutilizável
 * 
 * Uso:
 * <ConfirmDialog
 *   visible={showDialog}
 *   title="Excluir cliente?"
 *   message="Esta ação não pode ser desfeita."
 *   confirmLabel="Excluir"
 *   cancelLabel="Cancelar"
 *   onConfirm={handleExcluir}
 *   onCancel={() => setShowDialog(false)}
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from './BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  type?: 'info' | 'warning' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ConfirmDialog({  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  type = 'warning',
  loading = false,
  disabled = false,
}: ConfirmDialogProps) {
  const { primaryColor } = useBranding();

  const typeConfig = {
    info: { icon: 'information-circle', color: '#2563EB', bg: '#DBEAFE' },
    warning: { icon: 'warning', color: '#EA580C', bg: '#FFFBEB' },
    danger: { icon: 'alert-circle', color: '#DC2626', bg: '#FEF2F2' },
  };

  const config = typeConfig[type];

  const handleConfirm = async () => {
    if (disabled || loading) return;
    await onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Ícone */}
          <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={32} color={config.color} />
          </View>

          {/* Título */}
          <Text style={styles.title}>{title}</Text>

          {/* Mensagem */}
          {message && <Text style={styles.message}>{message}</Text>}

          {/* Botões */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: config.color },
                (disabled || loading) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={disabled || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
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
    padding: 24,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  confirmButton: {
    // Cor definida inline
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',    color: '#FFFFFF',
  },
});