/**
 * SearchBar.tsx
 * Componente de busca reutilizável
 * 
 * Uso:
 * <SearchBar
 *   value={searchTerm}
 *   onChangeText={setSearchTerm}
 *   placeholder="Buscar..."
 *   onClear={() => setSearchTerm('')}
 * />
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from './BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  autoFocus?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar...',  onClear,
  onFocus,
  onBlur,
  onSubmitEditing,
  disabled = false,
  style,
  autoFocus = false,
}: SearchBarProps) {
  const { primaryColor } = useBranding();
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChangeText('');
    onClear?.();
  }, [onChangeText, onClear]);

  return (
    <View
      style={[
        styles.container,
        isFocused && [styles.containerFocused, { borderColor: primaryColor }],
        disabled && styles.containerDisabled,
        style,
      ]}
    >
      {/* Ícone de busca */}
      <Ionicons
        name="search"
        size={20}
        color={isFocused ? primaryColor : '#64748B'}
      />

      {/* Input */}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        autoCapitalize="none"        autoCorrect={false}
        editable={!disabled}
        autoFocus={autoFocus}
      />

      {/* Botão de limpar */}
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close-circle" size={20} color="#64748B" />
        </TouchableOpacity>
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  containerFocused: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  containerDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
});

// ============================================================================
// VARIANTE COMPACTA
// ============================================================================
export function SearchBarCompact({
  value,
  onChangeText,
  placeholder = 'Buscar...',
  onClear,
}: SearchBarProps) {
  const { primaryColor } = useBranding();

  return (
    <View
      style={[
        stylesCompact.container,
        { borderColor: primaryColor },
      ]}
    >
      <Ionicons name="search" size={18} color={primaryColor} />
      <TextInput
        style={stylesCompact.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <Ionicons name="close" size={18} color="#64748B" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const stylesCompact = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },});