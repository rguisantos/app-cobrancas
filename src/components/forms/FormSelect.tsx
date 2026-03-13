/**
 * FormSelect.tsx
 * Componente de select/dropdown de formulário reutilizável
 * 
 * Uso:
 * <FormSelect
 *   label="Estado"
 *   value={estado}
 *   onValueChange={setEstado}
 *   options={[
 *     { label: 'São Paulo', value: 'SP' },
 *     { label: 'Rio de Janeiro', value: 'RJ' },
 *   ]}
 *   placeholder="Selecione"
 * />
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '../BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SelectOption<T = string> {
  label: string;
  value: T;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

export interface FormSelectProps<T = string> {
  label: string;
  value: T | null | undefined;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;  searchable?: boolean;
  style?: ViewStyle;
  testID?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function FormSelect<T = string>({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Selecione',
  error,
  required = false,
  disabled = false,
  searchable = false,
  style,
  testID,
}: FormSelectProps<T>) {
  const { primaryColor } = useBranding();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (!option.disabled) {
        onValueChange(option.value);
        setModalVisible(false);
        setSearchTerm('');
    
  }
    },
    [onValueChange]
  );

  const handleOpenModal = useCallback(() => {
    if (!disabled) {
      setModalVisible(true);
  
  }
  }, [disabled]);
  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSearchTerm('');
  }, []);

  return (
    <View style={[styles.container, style]}>
      {/* Label */}
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>

      {/* Select Button */}
      <TouchableOpacity
        style={[
          styles.selectButton,
          error && styles.selectButtonError,
          disabled && styles.selectButtonDisabled,
        ]}
        onPress={handleOpenModal}
        disabled={disabled}
        activeOpacity={0.7}
        testID={testID}
      >
        <Text
          style={[
            styles.selectValue,
            !selectedOption && styles.selectPlaceholder,
          ]}
        >
          {selectedOption?.label || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? '#94A3B8' : '#64748B'}
        />
      </TouchableOpacity>

      {/* Error Message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Search (optional) */}
            {searchable && (
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#64748B" />
                <Text
                  style={styles.searchInput}
                  onPress={() => {}}
                >
                  Buscar...
                </Text>
              </View>
            )}

            {/* Options List */}
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    item.disabled && styles.optionItemDisabled,
                    value === item.value && styles.optionItemSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                  disabled={item.disabled}
                  activeOpacity={0.7}
                >
                  {item.icon && (
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={value === item.value ? primaryColor : '#64748B'}
                      style={styles.optionIcon}
                    />
                  )}
                  <Text                    style={[
                      styles.optionText,
                      item.disabled && styles.optionTextDisabled,
                      value === item.value && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {value === item.value && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={primaryColor}
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>Nenhuma opção encontrada</Text>
                </View>
            
  }
            />
          </View>
        </View>
      </Modal>
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
    color: '#DC2626',  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  selectButtonError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  selectButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9',
  },
  selectValue: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  selectPlaceholder: {
    color: '#94A3B8',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemSelected: {
    backgroundColor: '#DBEAFE',
  },
  optionItemDisabled: {
    opacity: 0.5,
  },
  optionIcon: {
    marginRight: 4,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#2563EB',
  },
  optionTextDisabled: {
    color: '#94A3B8',  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 16,
  },
});

// ============================================================================
// VARIANTE RADIO (para poucas opções)
// ============================================================================

export function FormRadioSelect<T = string>({
  label,
  value,
  onValueChange,
  options,
  error,
  required,
  disabled,
  style,
}: Omit<FormSelectProps<T>, 'searchable'>) {
  const { primaryColor } = useBranding();

  return (
    <View style={[stylesRadio.container, style]}>
      <Text style={stylesRadio.label}>
        {label}
        {required && <Text style={stylesRadio.required}> *</Text>}
      </Text>
      <View style={stylesRadio.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={String(option.value)}
            style={[
              stylesRadio.option,
              value === option.value && [
                stylesRadio.optionSelected,
                { borderColor: primaryColor },
              ],
              disabled && stylesRadio.optionDisabled,
            ]}
            onPress={() => !disabled && onValueChange(option.value)}
            disabled={disabled || option.disabled}
          >
            <View              style={[
                stylesRadio.radio,
                value === option.value && { backgroundColor: primaryColor },
              ]}
            />
            <Text
              style={[
                stylesRadio.optionText,
                value === option.value && stylesRadio.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <Text style={stylesRadio.errorText}>{error}</Text>}
    </View>
  );
}

const stylesRadio = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  required: {
    color: '#DC2626',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },  optionSelected: {
    // Definido inline
  },
  optionDisabled: {
    opacity: 0.5,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  optionText: {
    fontSize: 14,
    color: '#64748B',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#1E293B',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
});