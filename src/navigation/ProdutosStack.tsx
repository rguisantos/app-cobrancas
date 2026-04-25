/**
 * ProdutosStack.tsx
 * Navegação específica do módulo de Produtos
 */

import React, { useCallback } from 'react';
import { Alert, TouchableOpacity, useColorScheme } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Types
import { StatusProduto, Conservacao } from '../types';

// Screens
import ProdutosListScreen from '../screens/ProdutosListScreen';
import ProdutoDetailScreen from '../screens/ProdutoDetailScreen';
import ProdutoFormScreen from '../screens/ProdutoFormScreen';
import ProdutoAlterarRelogioScreen from '../screens/ProdutoAlterarRelogioScreen';
import LocacaoFormScreen from '../screens/LocacaoFormScreen';
import LocacaoDetailScreen from '../screens/LocacaoDetailScreen';
import EnviarEstoqueScreen from '../screens/EnviarEstoqueScreen';

// ============================================================================
// TIPOS DE NAVEGAÇÃO
// ============================================================================

export type ProdutosStackParamList = {
  ProdutosList: {
    filtroStatus?: StatusProduto;
    filtroConservacao?: Conservacao;
    termoBusca?: string;
    mostrarEstoque?: boolean;
  };
  ProdutoDetail: { produtoId: string };
  ProdutoForm: { produtoId?: string; modo: 'criar' | 'editar' };
  ProdutoAlterarRelogio: { produtoId: string };
  LocacaoForm: {
    clienteId: string;
    produtoId?: string;
    locacaoId?: string;
    modo: 'criar' | 'editar' | 'relocar';
  };
  LocacaoDetail: { locacaoId: string };
  EnviarEstoque: { locacaoId: string; produtoId: string };
};

const Stack = createNativeStackNavigator<ProdutosStackParamList>();

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ProdutosStack() {
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

  const canEditProduto = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('todosCadastros', 'mobile');
  };

  const canAlterarRelogio = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('alteracaoRelogio', 'mobile');
  };

  const canManageLocacoes = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('locacaoRelocacaoEstoque', 'mobile');
  };

  return (
    <Stack.Navigator
      initialRouteName="ProdutosList"
      screenOptions={{
        ...theme,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="ProdutosList"
        component={ProdutosListScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="ProdutoDetail"
        component={ProdutoDetailScreen}
        options={({ navigation, route }) => ({
          title: 'Detalhes do Produto',
          headerRight: () => (
            <>
              {canAlterarRelogio() && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProdutoAlterarRelogio', {
                    produtoId: route.params.produtoId,
                  })}
                  style={{ padding: 8, marginRight: 8 }}
                >
                  <Ionicons name="speedometer-outline" size={24} color="#2563EB" />
                </TouchableOpacity>
              )}
              {canEditProduto() && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProdutoForm', {
                    produtoId: route.params.produtoId,
                    modo: 'editar',
                  })}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="create-outline" size={24} color="#2563EB" />
                </TouchableOpacity>
              )}
            </>
          ),
        })}
      />

      <Stack.Screen
        name="ProdutoForm"
        component={ProdutoFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Produto' : 'Editar Produto',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        })}
      />

      <Stack.Screen
        name="ProdutoAlterarRelogio"
        component={ProdutoAlterarRelogioScreen}
        options={{
          title: 'Alterar Relógio',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
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

export function useProdutoNavigate() {
  const navigation = useNavigation<NativeStackNavigationProp<ProdutosStackParamList>>();
  const { user, hasPermission } = useAuth();

  const toDetail = useCallback((produtoId: string) => {
    navigation.navigate('ProdutoDetail', { produtoId });
  }, [navigation]);

  const toForm = useCallback((modo: 'criar' | 'editar', produtoId?: string) => {
    if (!hasPermission('todosCadastros', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para editar produtos');
      return;
    }
    navigation.navigate('ProdutoForm', { modo, produtoId });
  }, [navigation, hasPermission, user]);

  const toAlterarRelogio = useCallback((produtoId: string) => {
    if (!hasPermission('alteracaoRelogio', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para alterar o relógio');
      return;
    }
    navigation.navigate('ProdutoAlterarRelogio', { produtoId });
  }, [navigation, hasPermission, user]);

  const toLocar = useCallback((produtoId: string, clienteId: string) => {
    if (!hasPermission('locacaoRelocacaoEstoque', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para criar locações');
      return;
    }
    navigation.navigate('LocacaoForm', {
      clienteId,
      produtoId,
      modo: 'criar',
    });
  }, [navigation, hasPermission, user]);

  const toRelocar = useCallback((locacaoId: string, produtoId: string, clienteIdAtual: string) => {
    if (!hasPermission('locacaoRelocacaoEstoque', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para relocar produtos');
      return;
    }
    navigation.navigate('LocacaoForm', {
      clienteId: clienteIdAtual,
      produtoId,
      locacaoId,
      modo: 'relocar',
    });
  }, [navigation, hasPermission, user]);

  const toEstoque = useCallback((locacaoId: string, produtoId: string) => {
    if (!hasPermission('locacaoRelocacaoEstoque', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para enviar para estoque');
      return;
    }
    navigation.navigate('EnviarEstoque', { locacaoId, produtoId });
  }, [navigation, hasPermission, user]);

  // Aliases para compatibilidade
  const toNovaLocacao = useCallback((produtoId: string) => {
    // Para nova locação, precisamos de um clienteId - navegar para tela de seleção de cliente
    // Por enquanto, usar string vazia que será tratada na tela de LocacaoForm
    if (!hasPermission('locacaoRelocacaoEstoque', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para criar locações');
      return;
    }
    navigation.navigate('LocacaoForm', {
      clienteId: '', // Será necessário selecionar o cliente
      produtoId,
      modo: 'criar',
    });
  }, [navigation, hasPermission, user]);

  const toEnviarEstoque = useCallback((locacaoId: string, produtoId: string) => {
    toEstoque(locacaoId, produtoId);
  }, [toEstoque]);

  return {
    toDetail,
    toForm,
    toAlterarRelogio,
    toLocar,
    toRelocar,
    toEstoque,
    toNovaLocacao,
    toEnviarEstoque,
    navigation,
  };
}

// ============================================================================
// FILTROS
// ============================================================================

export const PRODUTO_FILTROS = {
  STATUS: [
    { label: 'Todos', value: undefined },
    { label: 'Ativos', value: 'Ativo' as StatusProduto },
    { label: 'Inativos', value: 'Inativo' as StatusProduto },
    { label: 'Em Manutenção', value: 'Manutenção' as StatusProduto },
  ],
  CONSERVACAO: [
    { label: 'Todas', value: undefined },
    { label: 'Ótima', value: 'Ótima' as Conservacao },
    { label: 'Boa', value: 'Boa' as Conservacao },
    { label: 'Regular', value: 'Regular' as Conservacao },
    { label: 'Ruim', value: 'Ruim' as Conservacao },
    { label: 'Péssima', value: 'Péssima' as Conservacao },
  ],
  LOCACAO: [
    { label: 'Todos', value: 'todos' as const },
    { label: 'Locados', value: 'locados' as const },
    { label: 'Em Estoque', value: 'disponiveis' as const },
  ],
};

// Tipo para navigation prop
export type ProdutosStackNavigationProp = NativeStackNavigationProp<ProdutosStackParamList>;
