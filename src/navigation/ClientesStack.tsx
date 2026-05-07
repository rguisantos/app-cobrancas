/**
 * ClientesStack.tsx
 * Navegação específica do módulo de Clientes
 */

import React, { useCallback } from 'react';
import { Alert, TouchableOpacity, useColorScheme } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Types
import { Cliente } from '../types';

// Screens
import ClientesListScreen from '../screens/ClientesListScreen';
import ClienteDetailScreen from '../screens/ClienteDetailScreen';
import ClienteFormScreen from '../screens/ClienteFormScreen';
import LocacoesListScreen from '../screens/LocacoesListScreen';
import LocacaoFormScreen from '../screens/LocacaoFormScreen';
import LocacaoDetailScreen from '../screens/LocacaoDetailScreen';
import EnviarEstoqueScreen from '../screens/EnviarEstoqueScreen';

// ============================================================================
// TIPOS DE NAVEGAÇÃO
// ============================================================================

export type ClientesStackParamList = {
  ClientesList: undefined;
  ClienteDetail: { clienteId: string };
  ClienteForm: { clienteId?: string; modo: 'criar' | 'editar' };
  LocacoesList: { clienteId: string };
  LocacaoForm: {
    clienteId: string;
    produtoId?: string;
    modo: 'criar' | 'editar' | 'relocar';
    locacaoId?: string;
  };
  LocacaoDetail: { locacaoId: string };
  EnviarEstoque: { locacaoId: string; produtoId: string };
};

const Stack = createNativeStackNavigator<ClientesStackParamList>();

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ClientesStack() {
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

  const canEditCliente = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('clientes', 'mobile');
  };

  const canManageLocacoes = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('locacaoRelocacaoEstoque', 'mobile');
  };

  return (
    <Stack.Navigator
      initialRouteName="ClientesList"
      screenOptions={{
        ...theme,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="ClientesList"
        component={ClientesListScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="ClienteDetail"
        component={ClienteDetailScreen}
        options={({ navigation, route }) => ({
          title: 'Detalhes do Cliente',
          headerRight: () => canEditCliente() && (
            <TouchableOpacity
              onPress={() => navigation.navigate('ClienteForm', {
                clienteId: route.params.clienteId,
                modo: 'editar',
              })}
              style={{ padding: 8 }}
            >
              <Ionicons name="create-outline" size={24} color="#2563EB" />
            </TouchableOpacity>
          ),
        })}
      />

      <Stack.Screen
        name="ClienteForm"
        component={ClienteFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Cliente' : 'Editar Cliente',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        })}
      />

      <Stack.Screen
        name="LocacoesList"
        component={LocacoesListScreen}
        options={{ title: 'Locações' }}
      />

      <Stack.Screen
        name="LocacaoForm"
        component={LocacaoFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Nova Locação' :
                 route.params.modo === 'relocar' ? 'Relocar Produto' : 'Editar Locação',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        })}
      />

      <Stack.Screen
        name="LocacaoDetail"
        component={LocacaoDetailScreen}
        options={{ title: 'Detalhes da Locação' }}
      />

      <Stack.Screen
        name="EnviarEstoque"
        component={EnviarEstoqueScreen}
        options={{
          title: 'Enviar para Estoque',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}

// ============================================================================
// HOOK DE NAVEGAÇÃO
// ============================================================================

export function useClienteNavigate() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientesStackParamList>>();
  const { user, canAccessRota } = useAuth();

  const toDetail = useCallback((clienteId: string, cliente?: { rotaId?: string }) => {
    if (cliente?.rotaId && user?.tipoPermissao !== 'Administrador') {
      if (!canAccessRota(cliente.rotaId)) {
        console.warn('[ClientesNav] Acesso negado à rota do cliente');
        return;
      }
    }
    navigation.navigate('ClienteDetail', { clienteId });
  }, [navigation, user, canAccessRota]);

  const toForm = useCallback((modo: 'criar' | 'editar', clienteId?: string) => {
    navigation.navigate('ClienteForm', { modo, clienteId });
  }, [navigation]);

  const toLocacoes = useCallback((clienteId: string) => {
    navigation.navigate('LocacoesList', { clienteId });
  }, [navigation]);

  const toNovaLocacao = useCallback((clienteId: string, produtoId?: string) => {
    navigation.navigate('LocacaoForm', {
      clienteId,
      produtoId,
      modo: 'criar',
    });
  }, [navigation]);

  const toRelocar = useCallback((locacaoId: string, produtoId: string, clienteId: string) => {
    navigation.navigate('LocacaoForm', {
      clienteId,
      produtoId,
      locacaoId,
      modo: 'relocar',
    });
  }, [navigation]);

  return {
    toDetail,
    toForm,
    toLocacoes,
    toNovaLocacao,
    toRelocar,
    navigation,
  };
}

// Tipo para navigation prop
export type ClientesStackNavigationProp = NativeStackNavigationProp<ClientesStackParamList>;
