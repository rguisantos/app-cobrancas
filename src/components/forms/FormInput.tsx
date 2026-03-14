/**
 * FormInput.tsx
 * Componente de input de formulário reutilizável
 * 
 * Uso:
 * <FormInput
 *   label="Nome"
 *   value={nome}
 *   onChangeText={setNome}
 *   placeholder="Digite o nome"
 *   error={errors.nome}
 *   required
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
import { useBranding } from '../BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  leftIcon?: keyof typeof Ionicons.glyphMap;  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  required = false,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
  onBlur,
  onSubmitEditing,
  returnKeyType = 'done',
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  testID,
}: FormInputProps) {
  const { primaryColor } = useBranding();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  const handleTogglePassword = useCallback(() => {
    setShowPassword(!showPassword);
  }, [showPassword]);

  const handleRightIconPress = useCallback(() => {
    if (secureTextEntry) {
      handleTogglePassword();
    } else {
      onRightIconPress?.();
  
  }
  }, [secureTextEntry, onRightIconPress, handleTogglePassword]);
  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>

      {/* Input Container */}
      <View
        style={[
          styles.inputContainer,
          isFocused && [styles.inputFocused, { borderColor: primaryColor }],
          error && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
      >
        {/* Left Icon */}
        {leftIcon && (
          <Ionicons name={leftIcon} size={20} color="#64748B" style={styles.leftIcon} />
        )}

        {/* Input */}
        <TextInput
          style={[
            styles.input,
            multiline && [styles.inputMultiline, { minHeight: numberOfLines * 40 }],
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          testID={testID}        />

        {/* Right Icon */}
        {(rightIcon || secureTextEntry) && (
          <TouchableOpacity
            onPress={handleRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={disabled}
          >
            <Ionicons
              name={secureTextEntry ? (showPassword ? 'eye-off' : 'eye') : (rightIcon as any)}
              size={20}
              color="#64748B"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  required: {
    color: '#DC2626',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9',
  },
  leftIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    paddingVertical: 12,
  },
  inputMultiline: {
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    marginLeft: 4,
  },
});

// ============================================================================
// VARIANTE NUMÉRICA
// ============================================================================

export function FormNumberInput({
  value,
  onChangeText,
  ...props
}: Omit<FormInputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const handleNumericChange = useCallback((text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    onChangeText(numericValue);
  }, [onChangeText]);
  return (
    <FormInput
      value={value}
      onChangeText={handleNumericChange}
      keyboardType="numeric"
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
    />
  );
}

// ============================================================================
// VARIANTE EMAIL
// ============================================================================

export function FormEmailInput({
  value,
  onChangeText,
  ...props
}: Omit<FormInputProps, 'value' | 'onChangeText' | 'keyboardType' | 'autoCapitalize' | 'autoCorrect'> & {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const handleEmailChange = useCallback((text: string) => {
    onChangeText(text.toLowerCase().trim());
  }, [onChangeText]);

  return (
    <FormInput
      value={value}
      onChangeText={handleEmailChange}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      leftIcon="mail-outline"
      {...props}
    />
  );
}

// ============================================================================
// VARIANTE TELEFONE
// ============================================================================

export function FormPhoneInput({
  value,
  onChangeText,
  ...props
}: Omit<FormInputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const handlePhoneChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;    
    if (digits.length > 10) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    } else if (digits.length > 6) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 2) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  
  }
    
    onChangeText(formatted);
  }, [onChangeText]);

  return (
    <FormInput
      value={value}
      onChangeText={handlePhoneChange}
      keyboardType="phone-pad"
      autoCapitalize="none"
      autoCorrect={false}
      leftIcon="call-outline"
      maxLength={15}
      {...props}
    />
  );
}

// ============================================================================
// VARIANTE CPF/CNPJ
// ============================================================================

export function FormDocumentoInput({
  value,
  onChangeText,
  ...props
}: Omit<FormInputProps, 'value' | 'onChangeText' | 'keyboardType' | 'maxLength'> & {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const handleDocumentoChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    
    if (digits.length > 11) {
      // CNPJ
      formatted = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
    } else {
      // CPF
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  
  }
    
    onChangeText(formatted.slice(0, 18));
  }, [onChangeText]);
  return (
    <FormInput
      value={value}
      onChangeText={handleDocumentoChange}
      keyboardType="numeric"
      autoCapitalize="none"
      autoCorrect={false}
      leftIcon="id-card-outline"
      maxLength={18}
      placeholder="000.000.000-00"
      {...props}
    />
  );
}