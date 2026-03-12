/**
 * ClientesStack.tsx
 * Navegação específica do módulo de Clientes
 * 
 * Fluxo:
 * ClientesListScreen
 *   ├─> ClienteDetailScreen (modal)
 *   │     ├─> LocacoesListScreen (modal)
 *   │     │     ├─> LocacaoFormScreen (modal)
 *   │     │     └─> LocacaoDetailScreen (modal)
 *   │     └─> ClienteFormScreen (modal, editar)
 *   └─> ClienteFormScreen (modal, criar)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useColorScheme } from 'react-native';

// Types
import { Cliente, TipoPermissaoUsuario } from '../types';
import { ModalStackParamList } from './AppNavigator';

// Screens
import ClientesListScreen from '../screens/ClientesListScreen';
import ClienteDetailScreen from '../screens/ClienteDetailScreen';
import ClienteFormScreen from '../screens/ClienteFormScreen';
import LocacoesListScreen from '../screens/LocacoesListScreen';
import LocacaoFormScreen from '../screens/LocacaoFormScreen';
import LocacaoDetailScreen from '../screens/LocacaoDetailScreen';
import EnviarEstoqueScreen from '../screens/EnviarEstoqueScreen';

// ============================================================================
// TIPOS DE NAVEGAÇÃO ESPECÍFICOS DE CLIENTES
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
// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const Stack = createNativeStackNavigator<ClientesStackParamList>();

interface ClientesStackProps {
  // Props opcionais para customização
  initialRouteName?: keyof ClientesStackParamList;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ClientesStack({ initialRouteName = 'ClientesList' }: ClientesStackProps) {
  const { user, hasPermission, canAccessRota } = useAuth();
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
   * Verifica se usuário pode editar cliente
   */
  const canEditCliente = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('todosCadastros', 'mobile');
  };

  /**
   * Verifica se usuário pode gerenciar locações
   */
  const canManageLocacoes = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;    return hasPermission('locacaoRelocacaoEstoque', 'mobile');
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
      {/* LISTA DE CLIENTES - Tela principal */}
      <Stack.Screen
        name="ClientesList"
        component={ClientesListScreen}
        options={{
          headerShown: false, // Header customizado na screen
        }}
      />

      {/* DETALHES DO CLIENTE */}
      <Stack.Screen
        name="ClienteDetail"
        component={ClienteDetailScreen}
        options={({ route, navigation }) => ({
          title: 'Detalhes do Cliente',
          headerRight: () => canEditCliente() && (
            <EditButton 
              onPress={() => navigation.navigate('ClienteForm', {
                clienteId: route.params.clienteId,
                modo: 'editar',
              })}
            />
          ),
        })}
      />

      {/* FORMULÁRIO DE CLIENTE (Criar/Editar) */}
      <Stack.Screen
        name="ClienteForm"
        component={ClienteFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Cliente' : 'Editar Cliente',          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureDirection: 'vertical',
          // Bloquear se não tiver permissão de edição
          beforeRemove: (e) => {
            if (!canEditCliente() && route.params.modo === 'editar') {
              e.preventDefault();
              alert('Você não tem permissão para editar clientes');
              return false;
            }
            return true;
          },
        })}
        // Guard de rota: verifica permissão ao entrar
        listeners={({ navigation, route }) => ({
          beforeRemove: (e) => {
            if (!canEditCliente() && route.params?.modo === 'editar') {
              e.preventDefault();
              navigation.goBack();
              return false;
            }
          },
        })}
      />

      {/* LISTA DE LOCAÇÕES DO CLIENTE */}
      <Stack.Screen
        name="LocacoesList"
        component={LocacoesListScreen}
        options={({ route }) => ({
          title: 'Locações',
          headerTitle: `Locações do Cliente`,
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
            presentation: 'modal',            animation: 'slide_from_bottom',
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
          },
        })}
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
  );}

// ============================================================================
// COMPONENTES AUXILIARES DE UI
// ============================================================================

/**
 * Botão de Editar no header
 */
function EditButton({ onPress }: { onPress: () => void }) {
  return (
    // Implementar botão com ícone de lápis
    // Ex: <TouchableOpacity onPress={onPress}><Ionicons name="create" size={24} /></TouchableOpacity>
    null // Placeholder - implementar conforme design system
  );
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
// HOOK AUXILIAR PARA NAVEGAÇÃO DE CLIENTES
// ============================================================================

/**
 * Hook para navegação segura no módulo de clientes
 * 
 * Uso:
 * const navigateCliente = useClienteNavigate();
 * navigateCliente.toDetail('cliente_123');
 * navigateCliente.toLocacoes('cliente_123', { onlyAtivas: true });
 */
export function useClienteNavigate() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientesStackParamList>>();
  const { user, canAccessRota } = useAuth();

  /**
   * Navega para detalhes do cliente com verificação de acesso à rota   */
  const toDetail = useCallback((clienteId: string, cliente?: Partial<Cliente>) => {
    // Verificar acesso à rota do cliente se fornecida
    if (cliente?.rotaId && user?.tipoPermissao !== 'Administrador') {
      if (!canAccessRota(cliente.rotaId)) {
        console.warn('[ClientesNav] Acesso negado à rota do cliente');
        return;
      }
    }

    navigation.navigate('ClienteDetail', { clienteId });
  }, [navigation, user, canAccessRota]);

  /**
   * Navega para formulário de cliente
   */
  const toForm = useCallback((modo: 'criar' | 'editar', clienteId?: string) => {
    navigation.navigate('ClienteForm', { modo, clienteId });
  }, [navigation]);

  /**
   * Navega para lista de locações do cliente
   */
  const toLocacoes = useCallback((clienteId: string) => {
    navigation.navigate('LocacoesList', { clienteId });
  }, [navigation]);

  /**
   * Navega para formulário de nova locação
   */
  const toNovaLocacao = useCallback((clienteId: string, produtoId?: string) => {
    navigation.navigate('LocacaoForm', {
      clienteId,
      produtoId,
      modo: 'criar',
    });
  }, [navigation]);

  /**
   * Navega para relocação de produto
   */
  const toRelocar = useCallback((produtoId: string, clienteId: string) => {
    navigation.navigate('LocacaoForm', {
      clienteId,
      produtoId,
      modo: 'relocar',
    });
  }, [navigation]);

  return {    toDetail,
    toForm,
    toLocacoes,
    toNovaLocacao,
    toRelocar,
    // Expõe navigation direto para casos avançados
    navigation,
  };
}

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

export default ClientesStack;
export type { ClientesStackParamList };
export { useClienteNavigate };