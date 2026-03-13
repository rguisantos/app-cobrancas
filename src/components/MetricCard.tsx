/**
 * MetricCard.tsx
 * Componente para exibição de métricas no dashboard
 * 
 * Uso:
 * <MetricCard
 *   title="Clientes"
 *   value={42}
 *   icon="people"
 *   color="#2563EB"
 *   onPress={() => navigation.navigate('Clientes')}
 * />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// INTERFACES
// ============================================================================

export interface MetricCardProps {
  // Dados
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  
  // Estilo
  color: string;
  backgroundColor?: string;
  
  // Comportamento
  onPress?: () => void;
  disabled?: boolean;
  
  // Opcional
  badge?: number; // Badge para notificações (ex: cobranças pendentes)
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral'; // Seta de tendência
  trendValue?: number | string; // Valor da tendência
  
  // Customização
  style?: ViewStyle;
  titleStyle?: TextStyle;
  valueStyle?: TextStyle;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MetricCard({
  title,
  value,
  icon,
  color,
  backgroundColor,
  onPress,
  disabled = false,
  badge,
  subtitle,
  trend,
  trendValue,
  style,
  titleStyle,
  valueStyle,
}: MetricCardProps) {
  // Calcular cor de fundo se não fornecida (10% da cor principal)
  const bgColor = backgroundColor || `${color}1A`; // 10% opacity em hex
  
  // Ícone da tendência
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return 'arrow-up';
      case 'down':
        return 'arrow-down';
      default:
        return 'remove';
  
  }
  };

  // Cor da tendência
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return '#16A34A'; // Verde
      case 'down':
        return '#DC2626'; // Vermelho
      default:
        return '#64748B'; // Cinza
  
  }
  };

  // Formatador de números grandes
  const formatValue = (val: number | string): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
    
  }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
    
  }
      return val.toString();
  
  }
    return val;
  };

  // Conteúdo do card
  const cardContent = (
    <View style={[styles.card, { backgroundColor: bgColor }, style]}>
      {/* Header: Ícone + Badge */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
            <Text style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>

      {/* Valor Principal */}
      <Text style={[styles.value, { color }, valueStyle]}>
        {formatValue(value)}
      </Text>

      {/* Título */}
      <Text style={[styles.title, titleStyle]} numberOfLines={2}>
        {title}
      </Text>

      {/* Subtítulo ou Tendência */}
      {(subtitle || trend) && (
        <View style={styles.footer}>
          {trend && (
            <View style={styles.trend}>
              <Ionicons
                name={getTrendIcon()}
                size={12}
                color={getTrendColor()}
              />
              {trendValue && (
                <Text style={[styles.trendValue, { color: getTrendColor() }]}>
                  {trendValue}
                </Text>
              )}
            </View>
          )}
          
          {subtitle && !trend && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  // Se tiver onPress, envolve em TouchableOpacity
  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        style={styles.touchable}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        {cardContent}
      </TouchableOpacity>
    );

  }

  return cardContent;
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    minWidth: '47%', // 2 cards por linha com gap
    maxWidth: '47%',
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
});

// ============================================================================
// VARIANTES PRÉ-DEFINIDAS (opcional)
// ============================================================================

/**
 * Cores pré-definidas para tipos comuns de métricas
 */
export const METRIC_COLORS = {
  blue: '#2563EB',
  green: '#16A34A',
  red: '#DC2626',
  purple: '#9333EA',
  orange: '#EA580C',
  teal: '#0D9488',
  pink: '#DB2777',
  yellow: '#CA8A04',
} as const;

export type MetricColor = keyof typeof METRIC_COLORS;

/**
 * Componente com variantes pré-definidas
 */
export function MetricCardVariant({
  colorVariant,
  ...props
}: Omit<MetricCardProps, 'color'> & { colorVariant: MetricColor }) {
  return (
    <MetricCard
      color={METRIC_COLORS[colorVariant]}
      {...props}
    />
  );
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================