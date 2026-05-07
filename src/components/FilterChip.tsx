/**
 * FilterChip.tsx
 * Componente de chip de filtro reutilizável
 * 
 * Uso:
 * <FilterChip
 *   label="Ativos"
 *   selected={filtro === 'ativos'}
 *   onPress={() => setFiltro('ativos')}
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

export interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  disabled?: boolean;
  style?: ViewStyle;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function FilterChip({
  label,
  selected,
  onPress,
  icon,
  count,
  disabled = false,
  style,
}: FilterChipProps) {  const { primaryColor } = useBranding();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        selected && [styles.containerSelected, { backgroundColor: primaryColor }],
        disabled && styles.containerDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={16}
          color={selected ? '#FFFFFF' : '#64748B'}
        />
      )}
      <Text
        style={[
          styles.text,
          selected && styles.textSelected,
        ]}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View
          style={[
            styles.badge,
            selected && { backgroundColor: '#FFFFFF' },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              selected && { color: primaryColor },
            ]}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  containerSelected: {
    // Definido inline para usar primaryColor dinâmica
  },
  containerDisabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  textSelected: {
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

// ============================================================================
// GRUPO DE FILTER CHIPS
// ============================================================================

export interface FilterChipGroupProps<T extends string | number> {
  options: Array<{ label: string; value: T; icon?: keyof typeof Ionicons.glyphMap; count?: number }>;  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
}

export function FilterChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  scrollable = true,
}: FilterChipGroupProps<T>) {
  const Container = scrollable ? View : View;
  const containerStyles = scrollable ? stylesGroup.scrollContainer : stylesGroup.container;

  return (
    <Container style={containerStyles}>
      {scrollable ? (
        <View style={stylesGroup.scrollContent}>
          {options.map((option) => (
            <FilterChip
              key={String(option.value)}
              label={option.label}
              selected={value === option.value}
              onPress={() => onChange(option.value)}
              icon={option.icon}
              count={option.count}
            />
          ))}
        </View>
      ) : (
        options.map((option) => (
          <FilterChip
            key={String(option.value)}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
            icon={option.icon}
            count={option.count}
          />
        ))
      )}
    </Container>
  );
}

const stylesGroup = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,  },
  scrollContainer: {
    // Container para ScrollView horizontal
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
});