/**
 * ProdutosStack.tsx
 * Navegação específica do módulo de Produtos
 * 
 * Fluxo:
 * ProdutosListScreen
 *   ├─> ProdutoDetailScreen (modal)
 *   │     ├─> ProdutoAlterarRelogioScreen (modal)
 *   │     ├─> ProdutoFormScreen (modal, editar)
 *   │     └─> LocacoesListScreen (modal, histórico do produto)
 *   └─> ProdutoFormScreen (modal, criar)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useColorScheme } from 'react-native';

// Types
import { Produto, StatusProduto, TipoPermissaoUsuario } from '../types';

// Screens
import ProdutosListScreen from '../screens/ProdutosListScreen';
import ProdutoDetailScreen from '../screens/ProdutoDetailScreen';
import ProdutoFormScreen from '../screens/ProdutoFormScreen';
import ProdutoAlterarRelogioScreen from '../screens/ProdutoAlterarRelogioScreen';
import LocacoesListScreen from '../screens/LocacoesListScreen';
import LocacaoFormScreen from '../screens/LocacaoFormScreen';
import LocacaoDetailScreen from '../screens/LocacaoDetailScreen';
import EnviarEstoqueScreen from '../screens/EnviarEstoqueScreen';

// ============================================================================
// TIPOS DE NAVEGAÇÃO ESPECÍFICOS DE PRODUTOS
// ============================================================================

export type ProdutosStackParamList = {
  ProdutosList: {
    filtroTipo?: string;
    filtroStatus?: StatusProduto;
    filtroLocacao?: 'todos' | 'locados' | 'disponiveis';
  };
  ProdutoDetail: { produtoId: string };
  ProdutoForm: { produtoId?: string; modo: 'criar' | 'editar' };
  ProdutoAlterarRelogio: { produtoId: string };
  LocacoesList: { produtoId: string; apenasHistorico?: boolean };
  LocacaoForm: { 
    produtoId: string; 
    clienteId?: string; 
    modo: 'criar' | 'editar' | 'relocar';    locacaoId?: string;
  };
  LocacaoDetail: { locacaoId: string };
  EnviarEstoque: { locacaoId: string; produtoId: string };
};

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const Stack = createNativeStackNavigator<ProdutosStackParamList>();

interface ProdutosStackProps {
  initialRouteName?: keyof ProdutosStackParamList;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ProdutosStack({ initialRouteName = 'ProdutosList' }: ProdutosStackProps) {
  const { user, hasPermission } = useAuth();
  const colorScheme = useColorScheme();
  
  const theme = {
    headerStyle: {
      backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
    },
    headerTintColor: colorScheme === 'dark' ? '#F1F5F9' : '#1E293B',
    headerTitleStyle: { fontWeight: '600' },
    contentStyle: {
      backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F8FAFC',
    },
  };

  // ==========================================================================
  // FUNÇÕES AUXILIARES DE PERMISSÃO
  // ==========================================================================

  /**
   * Verifica se usuário pode editar produto
   */
  const canEditProduto = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('todosCadastros', 'mobile');
  };

  /**
   * Verifica se usuário pode alterar número do relógio   */
  const canAlterarRelogio = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('alteracaoRelogio', 'mobile');
  };

  /**
   * Verifica se usuário pode gerenciar locações
   */
  const canManageLocacoes = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('locacaoRelocacaoEstoque', 'mobile');
  };

  // ==========================================================================
  // CONFIGURAÇÃO DAS ROTAS
  // ==========================================================================

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        ...theme,
        animation: 'slide_from_right',
        animationDuration: 200,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      {/* LISTA DE PRODUTOS - Tela principal */}
      <Stack.Screen
        name="ProdutosList"
        component={ProdutosListScreen}
        options={{
          headerShown: false, // Header customizado na screen
        }}
      />

      {/* DETALHES DO PRODUTO */}
      <Stack.Screen
        name="ProdutoDetail"
        component={ProdutoDetailScreen}
        options={({ route, navigation }) => ({
          title: 'Detalhes do Produto',
          headerRight: () => (
            <ProdutoDetailActions
              produtoId={route.params.produtoId}
              onEdit={() => navigation.navigate('ProdutoForm', {                produtoId: route.params.produtoId,
                modo: 'editar',
              })}
              onAlterarRelogio={() => navigation.navigate('ProdutoAlterarRelogio', {
                produtoId: route.params.produtoId,
              })}
              onHistorico={() => navigation.navigate('LocacoesList', {
                produtoId: route.params.produtoId,
                apenasHistorico: true,
              })}
            />
          ),
        })}
      />

      {/* FORMULÁRIO DE PRODUTO (Criar/Editar) */}
      <Stack.Screen
        name="ProdutoForm"
        component={ProdutoFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Produto' : 'Editar Produto',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureDirection: 'vertical',
        })}
        // Guard de permissão para edição
        listeners={({ navigation, route }) => ({
          beforeRemove: (e) => {
            if (!canEditProduto() && route.params?.modo === 'editar') {
              e.preventDefault();
              navigation.goBack();
              return false;
            }
            return true;
          },
        })}
      />

      {/* ALTERAR NÚMERO DO RELÓGIO */}
      <Stack.Screen
        name="ProdutoAlterarRelogio"
        component={ProdutoAlterarRelogioScreen}
        options={{
          title: 'Alterar Número do Relógio',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureDirection: 'vertical',
        }}
        // Guard de permissão específico para alteração de relógio
        listeners={({ navigation }) => ({          beforeRemove: (e) => {
            if (!canAlterarRelogio()) {
              e.preventDefault();
              navigation.goBack();
              alert('Você não tem permissão para alterar número do relógio');
              return false;
            }
            return true;
          },
        })}
      />

      {/* LISTA DE LOCAÇÕES DO PRODUTO (Histórico) */}
      <Stack.Screen
        name="LocacoesList"
        component={LocacoesListScreen}
        options={({ route }) => ({
          title: route.params.apenasHistorico ? 'Histórico de Locações' : 'Locações',
          headerBackTitle: 'Voltar',
        })}
      />

      {/* FORMULÁRIO DE LOCAÇÃO (Criar/Editar/Relocar) */}
      <Stack.Screen
        name="LocacaoForm"
        component={LocacaoFormScreen}
        options={({ route }) => {
          const titles: Record<string, string> = {
            criar: 'Nova Locação',
            editar: 'Editar Locação',
            relocar: 'Relocar Produto',
          };
          
          return {
            title: titles[route.params.modo] || 'Locação',
            presentation: 'modal',
            animation: 'slide_from_bottom',
            gestureDirection: 'vertical',
          };
        }}
        // Guard de permissão para gestão de locações
        listeners={({ navigation }) => ({
          beforeRemove: (e) => {
            if (!canManageLocacoes()) {
              e.preventDefault();
              navigation.goBack();
              return false;
            }
            return true;
          },        })}
      />

      {/* DETALHES DA LOCAÇÃO */}
      <Stack.Screen
        name="LocacaoDetail"
        component={LocacaoDetailScreen}
        options={{
          title: 'Detalhes da Locação',
          headerRight: () => canManageLocacoes() && <LocacaoActions />,
        }}
      />

      {/* ENVIAR PARA ESTOQUE */}
      <Stack.Screen
        name="EnviarEstoque"
        component={EnviarEstoqueScreen}
        options={{
          title: 'Enviar para Estoque',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
        // Apenas usuários com permissão de estoque
        listeners={({ navigation }) => ({
          beforeRemove: (e) => {
            if (!canManageLocacoes()) {
              e.preventDefault();
              navigation.goBack();
              return false;
            }
            return true;
          },
        })}
      />
    </Stack.Navigator>
  );
}

// ============================================================================
// COMPONENTES AUXILIARES DE UI
// ============================================================================

/**
 * Ações rápidas na tela de detalhe do produto
 */
function ProdutoDetailActions({
  produtoId,
  onEdit,
  onAlterarRelogio,
  onHistorico,}: {
  produtoId: string;
  onEdit: () => void;
  onAlterarRelogio: () => void;
  onHistorico: () => void;
}) {
  const { canEditProduto, canAlterarRelogio } = useAuth();

  // Renderizar menu de ações baseado em permissões
  // - Editar produto (canEditProduto)
  // - Alterar relógio (canAlterarRelogio)
  // - Ver histórico (todos)
  
  return null; // Placeholder - implementar conforme design system
}

/**
 * Ações rápidas na tela de detalhe da locação
 */
function LocacaoActions() {
  const { hasPermission } = useAuth();
  
  // Renderizar menu de ações baseado em permissões
  // - Editar locação
  // - Relocar produto  
  // - Enviar para estoque
  // - Finalizar locação
  
  return null; // Placeholder
}

// ============================================================================
// HOOK AUXILIAR PARA NAVEGAÇÃO DE PRODUTOS
// ============================================================================

/**
 * Hook para navegação segura no módulo de produtos
 * 
 * Uso:
 * const navigateProduto = useProdutoNavigate();
 * navigateProduto.toDetail('produto_123');
 * navigateProduto.toAlterarRelogio('produto_123');
 */
export function useProdutoNavigate() {
  const navigation = useNavigation<NativeStackNavigationProp<ProdutosStackParamList>>();
  const { user, hasPermission } = useAuth();

  /**
   * Navega para detalhes do produto
   */  const toDetail = useCallback((produtoId: string) => {
    navigation.navigate('ProdutoDetail', { produtoId });
  }, [navigation]);

  /**
   * Navega para formulário de produto
   */
  const toForm = useCallback((modo: 'criar' | 'editar', produtoId?: string) => {
    navigation.navigate('ProdutoForm', { modo, produtoId });
  }, [navigation]);

  /**
   * Navega para tela de alterar relógio
   */
  const toAlterarRelogio = useCallback((produtoId: string) => {
    if (!hasPermission('alteracaoRelogio', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      alert('Você não tem permissão para alterar número do relógio');
      return;
    }
    navigation.navigate('ProdutoAlterarRelogio', { produtoId });
  }, [navigation, hasPermission, user]);

  /**
   * Navega para histórico de locações do produto
   */
  const toHistorico = useCallback((produtoId: string) => {
    navigation.navigate('LocacoesList', { 
      produtoId, 
      apenasHistorico: true 
    });
  }, [navigation]);

  /**
   * Navega para nova locação de produto
   */
  const toNovaLocacao = useCallback((produtoId: string, clienteId?: string) => {
    if (!hasPermission('locacaoRelocacaoEstoque', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      alert('Você não tem permissão para criar locações');
      return;
    }
    navigation.navigate('LocacaoForm', {
      produtoId,
      clienteId,
      modo: 'criar',
    });
  }, [navigation, hasPermission, user]);

  /**
   * Navega para enviar produto para estoque
   */  const toEnviarEstoque = useCallback((locacaoId: string, produtoId: string) => {
    if (!hasPermission('locacaoRelocacaoEstoque', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      alert('Você não tem permissão para enviar para estoque');
      return;
    }
    navigation.navigate('EnviarEstoque', { locacaoId, produtoId });
  }, [navigation, hasPermission, user]);

  return {
    toDetail,
    toForm,
    toAlterarRelogio,
    toHistorico,
    toNovaLocacao,
    toEnviarEstoque,
    // Expõe navigation direto para casos avançados
    navigation,
  };
}

// ============================================================================
// UTILITÁRIOS DE FILTRO
// ============================================================================

/**
 * Filtros disponíveis para a lista de produtos
 */
export const PRODUTO_FILTROS = {
  STATUS: [
    { label: 'Todos', value: 'todos' },
    { label: 'Ativos', value: 'Ativo' },
    { label: 'Inativos', value: 'Inativo' },
    { label: 'Manutenção', value: 'Manutenção' },
  ] as const,
  
  LOCACAO: [
    { label: 'Todos', value: 'todos' },
    { label: 'Locados', value: 'locados' },
    { label: 'Disponíveis', value: 'disponiveis' },
  ] as const,
  
  TIPO: [
    { label: 'Todos', value: 'todos' },
    { label: 'Bilhar', value: 'Bilhar' },
    { label: 'Jukebox', value: 'Jukebox' },
    { label: 'Mesa', value: 'Mesa' },
    { label: 'Grua', value: 'Grua' },
  ] as const,
} as const;
// ============================================================================
// EXPORTAÇÕES
// ============================================================================

export default ProdutosStack;
export type { ProdutosStackParamList };
export { useProdutoNavigate, PRODUTO_FILTROS };