/**
 * FormDatePicker.tsx
 * Componente de seleção de data de formulário reutilizável
 * 
 * Uso:
 * <FormDatePicker
 *   label="Data de Nascimento"
 *   value={dataNascimento}
 *   onValueChange={setDataNascimento}
 *   placeholder="DD/MM/AAAA"
 * />
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useBranding } from '../BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface FormDatePickerProps {
  label: string;
  value: Date | null | undefined;
  onValueChange: (date: Date) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  style?: any;
  testID?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function FormDatePicker({
  label,  value,
  onValueChange,
  placeholder = 'DD/MM/AAAA',
  error,
  required = false,
  disabled = false,
  mode = 'date',
  minimumDate,
  maximumDate,
  style,
  testID,
}: FormDatePickerProps) {
  const { primaryColor } = useBranding();
  const [showPicker, setShowPicker] = useState(false);

  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('pt-BR');
  }, []);

  const handleOpenPicker = useCallback(() => {
    if (!disabled) {
      setShowPicker(true);
  
  }
  }, [disabled]);

  const handleClosePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  const handleDateChange = useCallback(
    (_event: any, selectedDate?: Date) => {
      setShowPicker(Platform.OS === 'ios');
      if (selectedDate) {
        onValueChange(selectedDate);
    
  }
    },
    [onValueChange]
  );

  const selectedDate = value ? formatDate(value) : placeholder;

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>
      {/* Date Picker Button */}
      <TouchableOpacity
        style={[
          styles.pickerButton,
          error && styles.pickerButtonError,
          disabled && styles.pickerButtonDisabled,
        ]}
        onPress={handleOpenPicker}
        disabled={disabled}
        activeOpacity={0.7}
        testID={testID}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={disabled ? '#94A3B8' : '#64748B'}
        />
        <Text
          style={[
            styles.pickerValue,
            !value && styles.pickerPlaceholder,
          ]}
        >
          {selectedDate}
        </Text>
        {value && !disabled && (
          <TouchableOpacity onPress={() => onValueChange(new Date())}>
            <Ionicons name="close-circle" size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Error Message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Native Picker */}
      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          locale="pt-BR"
        />
      )}
    </View>
  );}

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
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    gap: 12,
  },
  pickerButtonError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  pickerButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9',
  },
  pickerValue: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  pickerPlaceholder: {
    color: '#94A3B8',
  },  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    marginLeft: 4,
  },
});

// ============================================================================
// VARIANTE APENAS HORA
// ============================================================================

export function FormTimePicker({
  value,
  onValueChange,
  ...props
}: Omit<FormDatePickerProps, 'value' | 'onValueChange' | 'mode'> & {
  value: Date | null | undefined;
  onValueChange: (date: Date) => void;
}) {
  const formatTime = useCallback((date: Date): string => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const handleTimeChange = useCallback(
    (_event: any, selectedTime?: Date) => {
      if (selectedTime) {
        onValueChange(selectedTime);
    
  }
    },
    [onValueChange]
  );

  const selectedTime = value ? formatTime(value) : 'HH:MM';

  return (
    <FormDatePicker
      value={value}
      onValueChange={handleTimeChange}
      mode="time"
      placeholder={selectedTime}
      {...props}
    />
  );
}