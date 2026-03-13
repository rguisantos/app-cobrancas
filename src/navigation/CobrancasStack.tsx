/**
 * CobrancasStack.tsx
 * Navegação específica do módulo de Cobranças
 */

import React, { useCallback } from 'react';
import { Alert, TouchableOpacity, useColorScheme } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Types
import { StatusPagamento } from '../types';

// Screens
import CobrancasListScreen from '../screens/CobrancasListScreen';
import RotasCobrancaScreen from '../screens/RotasCobrancaScreen';
import CobrancaDetailScreen from '../screens/CobrancaDetailScreen';
import CobrancaConfirmScreen from '../screens/CobrancaConfirmScreen';
import HistoricoCobrancaScreen from '../screens/HistoricoCobrancaScreen';
import ClienteDetailScreen from '../screens/ClienteDetailScreen';

// ============================================================================
// TIPOS DE NAVEGAÇÃO
// ============================================================================

export type CobrancasStackParamList = {
  CobrancasList: {
    filtroRota?: string | number;
    filtroStatus?: StatusPagamento;
    filtroCliente?: string;
  };
  RotasCobranca: undefined;
  CobrancaDetail: { cobrancaId: string };
  CobrancaConfirm: {
    locacaoId: string;
    cobrancaId?: string;
    modo: 'nova' | 'editar' | 'parcial';
  };
  HistoricoCobranca: { clienteId: string; produtoId?: string };
  ClienteDetail: { clienteId: string };
};

const Stack = createNativeStackNavigator<CobrancasStackParamList>();

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CobrancasStack() {
  const { user, hasPermission } = useAuth();
  const colorScheme = useColorScheme();

  const theme = {
    headerStyle: {
      backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
    },
    headerTintColor: colorScheme === 'dark' ? '#F1F5F9' : '#1E293B',
    headerTitleStyle: { fontWeight: '600' as const },
    contentStyle: {
      backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F8FAFC',
    },
  };

  const canCobrar = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('cobrancasFaturas', 'mobile');
  };

  const canEditarCobranca = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('cobrancasFaturas', 'mobile');
  };

  return (
    <Stack.Navigator
      initialRouteName="CobrancasList"
      screenOptions={{
        ...theme,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="CobrancasList"
        component={CobrancasListScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="RotasCobranca"
        component={RotasCobrancaScreen}
        options={{
          title: 'Cobranças por Rota',
          headerBackTitle: 'Voltar',
        }}
      />

      <Stack.Screen
        name="CobrancaDetail"
        component={CobrancaDetailScreen}
        options={{
          title: 'Detalhes da Cobrança',
          headerRight: () => canEditarCobranca() && (
            <TouchableOpacity style={{ padding: 8 }}>
              <Ionicons name="create-outline" size={24} color="#2563EB" />
            </TouchableOpacity>
          ),
        }}
      />

      <Stack.Screen
        name="CobrancaConfirm"
        component={CobrancaConfirmScreen}
        options={({ route }) => ({
          title: route.params.modo === 'nova' ? 'Confirmar Cobrança' :
                 route.params.modo === 'editar' ? 'Editar Cobrança' : 'Pagamento Parcial',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: route.params.modo !== 'nova',
        })}
      />

      <Stack.Screen
        name="HistoricoCobranca"
        component={HistoricoCobrancaScreen}
        options={{
          title: 'Histórico de Cobranças',
          headerBackTitle: 'Voltar',
        }}
      />

      <Stack.Screen
        name="ClienteDetail"
        component={ClienteDetailScreen}
        options={{
          title: 'Detalhes do Cliente',
          headerBackTitle: 'Voltar',
        }}
      />
    </Stack.Navigator>
  );
}

// ============================================================================
// HOOK DE NAVEGAÇÃO
// ============================================================================

export function useCobrancaNavigate() {
  const navigation = useNavigation<NativeStackNavigationProp<CobrancasStackParamList>>();
  const { user, hasPermission, canAccessRota } = useAuth();

  const toList = useCallback((filtros?: {
    rotaId?: string | number;
    status?: StatusPagamento;
    clienteId?: string;
  }) => {
    if (filtros?.rotaId && user?.tipoPermissao !== 'Administrador') {
      if (!canAccessRota(filtros.rotaId)) {
        console.warn('[CobrancaNav] Acesso negado à rota');
        return;
      }
    }

    navigation.navigate('CobrancasList', {
      filtroRota: filtros?.rotaId,
      filtroStatus: filtros?.status,
      filtroCliente: filtros?.clienteId,
    });
  }, [navigation, user, canAccessRota]);

  const toRotas = useCallback(() => {
    navigation.navigate('RotasCobranca');
  }, [navigation]);

  const toConfirm = useCallback((
    locacaoId: string,
    modo: 'nova' | 'editar' | 'parcial' = 'nova',
    cobrancaId?: string
  ) => {
    if (!hasPermission('cobrancasFaturas', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para realizar cobranças');
      return;
    }

    navigation.navigate('CobrancaConfirm', {
      locacaoId,
      cobrancaId,
      modo,
    });
  }, [navigation, hasPermission, user]);

  const toDetail = useCallback((cobrancaId: string) => {
    navigation.navigate('CobrancaDetail', { cobrancaId });
  }, [navigation]);

  const toHistorico = useCallback((clienteId: string, produtoId?: string) => {
    if (!hasPermission('cobrancasFaturas', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para ver histórico de cobranças');
      return;
    }

    navigation.navigate('HistoricoCobranca', {
      clienteId,
      produtoId,
    });
  }, [navigation, hasPermission, user]);

  const toCliente = useCallback((clienteId: string) => {
    navigation.navigate('ClienteDetail', { clienteId });
  }, [navigation]);

  const toPagamentoParcial = useCallback((cobrancaId: string, locacaoId: string) => {
    navigation.navigate('CobrancaConfirm', {
      locacaoId,
      cobrancaId,
      modo: 'parcial',
    });
  }, [navigation]);

  return {
    toList,
    toRotas,
    toConfirm,
    toDetail,
    toHistorico,
    toCliente,
    toPagamentoParcial,
    navigation,
  };
}

// ============================================================================
// FILTROS DISPONÍVEIS
// ============================================================================

export const COBRANCA_FILTROS = {
  STATUS: [
    { label: 'Todas', value: undefined },
    { label: 'Pendentes', value: 'Pendente' as StatusPagamento },
    { label: 'Pagas', value: 'Pago' as StatusPagamento },
    { label: 'Parciais', value: 'Parcial' as StatusPagamento },
    { label: 'Atrasadas', value: 'Atrasado' as StatusPagamento },
  ],
  PERIODO: [
    { label: 'Hoje', value: 'hoje' },
    { label: 'Esta Semana', value: 'semana' },
    { label: 'Este Mês', value: 'mes' },
    { label: 'Personalizado', value: 'personalizado' },
  ],
  ORDENACAO: [
    { label: 'Mais Recentes', value: 'recentes' },
    { label: 'Mais Antigas', value: 'antigas' },
    { label: 'Maior Valor', value: 'maior_valor' },
    { label: 'Menor Valor', value: 'menor_valor' },
    { label: 'Mais Atrasadas', value: 'atrasadas' },
  ],
};

// Tipo para navigation prop
export type CobrancasStackNavigationProp = NativeStackNavigationProp<CobrancasStackParamList>;
