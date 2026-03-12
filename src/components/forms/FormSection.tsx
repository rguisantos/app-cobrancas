/**
 * FormSection.tsx
 * Componente de seção de formulário reutilizável
 * 
 * Uso:
 * <FormSection title="Dados Pessoais">
 *   <FormInput label="Nome" value={nome} onChangeText={setNome} />
 *   <FormInput label="Email" value={email} onChangeText={setEmail} />
 * </FormSection>
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '../BrandingProvider';

// ============================================================================
// INTERFACES
// ============================================================================

export interface FormSectionProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  style?: ViewStyle;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function FormSection({
  title,
  subtitle,
  icon,
  children,
  style,
  collapsible = false,
  defaultExpanded = true,
  onToggle,
}: FormSectionProps) {
  const { primaryColor } = useBranding();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const handleToggle = React.useCallback(() => {
    if (collapsible) {      const newExpanded = !expanded;
      setExpanded(newExpanded);
      onToggle?.(newExpanded);
    }
  }, [collapsible, expanded, onToggle]);

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggle}
        disabled={!collapsible}
        activeOpacity={collapsible ? 0.7 : 1}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <View style={[styles.iconContainer, { backgroundColor: `${primaryColor}1A` }]}>
              <Ionicons name={icon} size={20} color={primaryColor} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        {collapsible && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#64748B"
          />
        )}
      </TouchableOpacity>

      {/* Content */}
      {(expanded || !collapsible) && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    gap: 16,
  },
});

// ============================================================================
// VARIANTE CARD
// ============================================================================

export function FormSectionCard({
  title,
  subtitle,
  icon,  children,
  style,
}: Omit<FormSectionProps, 'collapsible' | 'defaultExpanded' | 'onToggle'>) {
  return (
    <View style={[stylesCard.container, style]}>
      {(title || subtitle) && (
        <View style={stylesCard.header}>
          {icon && (
            <Ionicons name={icon} size={20} color="#64748B" style={stylesCard.icon} />
          )}
          <View style={stylesCard.headerText}>
            {title && <Text style={stylesCard.title}>{title}</Text>}
            {subtitle && <Text style={stylesCard.subtitle}>{subtitle}</Text>}
          </View>
        </View>
      )}
      <View style={stylesCard.content}>
        {children}
      </View>
    </View>
  );
}

const stylesCard = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  icon: {
    marginRight: 4,
  },
  headerText: {
    flex: 1,
  },  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    gap: 16,
  },
});