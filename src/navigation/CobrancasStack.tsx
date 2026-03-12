/**
 * CobrancasStack.tsx
 * Navegação específica do módulo de Cobranças
 * 
 * Fluxo:
 * CobrancasListScreen (por rota ou cliente)
 *   ├─> CobrancaDetailScreen (modal)
 *   │     └─> HistoricoCobrancaScreen (modal)
 *   ├─> CobrancaConfirmScreen (modal)
 *   │     └─> CobrancaDetailScreen (confirmado)
 *   └─> RotasCobrancaScreen (selecionar rota)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useColorScheme } from 'react-native';

// Types
import { StatusPagamento, TipoPermissaoUsuario } from '../types';

// Screens
import CobrancasListScreen from '../screens/CobrancasListScreen';
import RotasCobrancaScreen from '../screens/RotasCobrancaScreen';
import CobrancaDetailScreen from '../screens/CobrancaDetailScreen';
import CobrancaConfirmScreen from '../screens/CobrancaConfirmScreen';
import HistoricoCobrancaScreen from '../screens/HistoricoCobrancaScreen';
import ClienteDetailScreen from '../screens/ClienteDetailScreen';

// ============================================================================
// TIPOS DE NAVEGAÇÃO ESPECÍFICOS DE COBRANÇAS
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
    cobrancaId?: string; // Se existir, é edição de cobrança existente
    modo: 'nova' | 'editar' | 'parcial';
  };
  HistoricoCobranca: { clienteId: string; produtoId?: string };
  ClienteDetail: { clienteId: string };
};
// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const Stack = createNativeStackNavigator<CobrancasStackParamList>();

interface CobrancasStackProps {
  initialRouteName?: keyof CobrancasStackParamList;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CobrancasStack({ initialRouteName = 'CobrancasList' }: CobrancasStackProps) {
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
   * Verifica se usuário pode realizar cobranças
   */
  const canCobrar = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('cobrancasFaturas', 'mobile');
  };

  /**
   * Verifica se usuário pode editar cobrança
   */
  const canEditarCobranca = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    // Pode exigir permissão adicional    return hasPermission('cobrancasFaturas', 'mobile');
  };

  /**
   * Verifica se usuário pode ver histórico completo
   */
  const canVerHistorico = (): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;
    return hasPermission('relatorios', 'web') || hasPermission('cobrancasFaturas', 'mobile');
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
      {/* LISTA DE COBRANÇAS - Tela principal */}
      <Stack.Screen
        name="CobrancasList"
        component={CobrancasListScreen}
        options={{
          headerShown: false, // Header customizado na screen
        }}
      />

      {/* SELEÇÃO DE ROTAS PARA COBRANÇA */}
      <Stack.Screen
        name="RotasCobranca"
        component={RotasCobrancaScreen}
        options={{
          title: 'Cobranças por Rota',
          headerBackTitle: 'Voltar',
        }}
      />

      {/* DETALHES DA COBRANÇA */}
      <Stack.Screen
        name="CobrancaDetail"
        component={CobrancaDetailScreen}        options={({ route, navigation }) => ({
          title: 'Detalhes da Cobrança',
          headerRight: () => canEditarCobranca() && (
            <CobrancaActions
              cobrancaId={route.params.cobrancaId}
              onEditar={() => {}}
              onImprimir={() => {}}
            />
          ),
        })}
      />

      {/* CONFIRMAÇÃO DE COBRANÇA (Fluxo principal) */}
      <Stack.Screen
        name="CobrancaConfirm"
        component={CobrancaConfirmScreen}
        options={({ route }) => {
          const titles: Record<string, string> = {
            nova: 'Confirmar Cobrança',
            editar: 'Editar Cobrança',
            parcial: 'Registrar Pagamento Parcial',
          };
          
          return {
            title: titles[route.params.modo] || 'Cobrança',
            presentation: 'modal',
            animation: 'slide_from_bottom',
            gestureDirection: 'vertical',
            // Impedir fechar sem confirmar (importante para fluxo de cobrança)
            gestureEnabled: route.params.modo !== 'nova',
          };
        }}
        // Guard de permissão para cobranças
        listeners={({ navigation }) => ({
          beforeRemove: (e) => {
            if (!canCobrar()) {
              e.preventDefault();
              navigation.goBack();
              alert('Você não tem permissão para realizar cobranças');
              return false;
            }
            return true;
          },
        })}
      />

      {/* HISTÓRICO DE COBRANÇAS */}
      <Stack.Screen
        name="HistoricoCobranca"
        component={HistoricoCobrancaScreen}        options={({ route }) => ({
          title: 'Histórico de Cobranças',
          headerBackTitle: 'Voltar',
        })}
        // Guard de permissão para histórico
        listeners={({ navigation }) => ({
          beforeRemove: (e) => {
            if (!canVerHistorico()) {
              e.preventDefault();
              navigation.goBack();
              return false;
            }
            return true;
          },
        })}
      />

      {/* DETALHES DO CLIENTE (acesso rápido da cobrança) */}
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
// COMPONENTES AUXILIARES DE UI
// ============================================================================

/**
 * Ações rápidas na tela de detalhe da cobrança
 */
function CobrancaActions({
  cobrancaId,
  onEditar,
  onImprimir,
}: {
  cobrancaId: string;
  onEditar: () => void;
  onImprimir: () => void;
}) {
  const { hasPermission } = useAuth();
  
  // Renderizar menu de ações baseado em permissões
  // - Editar cobrança (canEditarCobranca)  // - Imprimir recibo (todos)
  // - Ver histórico do cliente (canVerHistorico)
  
  return null; // Placeholder - implementar conforme design system
}

// ============================================================================
// HOOK AUXILIAR PARA NAVEGAÇÃO DE COBRANÇAS
// ============================================================================

/**
 * Hook para navegação segura no módulo de cobranças
 * 
 * Uso:
 * const navigateCobranca = useCobrancaNavigate();
 * navigateCobranca.toConfirm('locacao_123');
 * navigateCobranca.toHistorico('cliente_456');
 */
export function useCobrancaNavigate() {
  const navigation = useNavigation<NativeStackNavigationProp<CobrancasStackParamList>>();
  const { user, hasPermission, canAccessRota } = useAuth();

  /**
   * Navega para lista de cobranças com filtros
   */
  const toList = useCallback((filtros?: {
    rotaId?: string | number;
    status?: StatusPagamento;
    clienteId?: string;
  }) => {
    // Verificar acesso à rota se fornecida
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

  /**
   * Navega para tela de seleção de rotas
   */
  const toRotas = useCallback(() => {
    navigation.navigate('RotasCobranca');  }, [navigation]);

  /**
   * Navega para confirmação de cobrança (fluxo principal)
   */
  const toConfirm = useCallback((
    locacaoId: string, 
    modo: 'nova' | 'editar' | 'parcial' = 'nova',
    cobrancaId?: string
  ) => {
    if (!hasPermission('cobrancasFaturas', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      alert('Você não tem permissão para realizar cobranças');
      return;
    }

    navigation.navigate('CobrancaConfirm', {
      locacaoId,
      cobrancaId,
      modo,
    });
  }, [navigation, hasPermission, user]);

  /**
   * Navega para detalhes da cobrança
   */
  const toDetail = useCallback((cobrancaId: string) => {
    navigation.navigate('CobrancaDetail', { cobrancaId });
  }, [navigation]);

  /**
   * Navega para histórico de cobranças do cliente
   */
  const toHistorico = useCallback((clienteId: string, produtoId?: string) => {
    if (!hasPermission('cobrancasFaturas', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      alert('Você não tem permissão para ver histórico de cobranças');
      return;
    }

    navigation.navigate('HistoricoCobranca', {
      clienteId,
      produtoId,
    });
  }, [navigation, hasPermission, user]);

  /**
   * Navega para detalhes do cliente (acesso rápido)
   */
  const toCliente = useCallback((clienteId: string) => {
    navigation.navigate('ClienteDetail', { clienteId });
  }, [navigation]);
  /**
   * Navega para cobrança parcial
   */
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
    // Expõe navigation direto para casos avançados
    navigation,
  };
}

// ============================================================================
// UTILITÁRIOS DE FILTRO
// ============================================================================

/**
 * Filtros disponíveis para a lista de cobranças
 */
export const COBRANCA_FILTROS = {
  STATUS: [
    { label: 'Todas', value: 'todas' },
    { label: 'Pendentes', value: 'Pendente' },
    { label: 'Pagas', value: 'Pago' },
    { label: 'Parciais', value: 'Parcial' },
    { label: 'Atrasadas', value: 'Atrasado' },
  ] as const,
  
  PERIODO: [
    { label: 'Hoje', value: 'hoje' },
    { label: 'Esta Semana', value: 'semana' },
    { label: 'Este Mês', value: 'mes' },
    { label: 'Personalizado', value: 'personalizado' },
  ] as const,
  
  ORDENACAO: [
    { label: 'Mais Recentes', value: 'recentes' },    { label: 'Mais Antigas', value: 'antigas' },
    { label: 'Maior Valor', value: 'maior_valor' },
    { label: 'Menor Valor', value: 'menor_valor' },
    { label: 'Mais Atrasadas', value: 'atrasadas' },
  ] as const,
} as const;

// ============================================================================
// COMPONENTE DE RESUMO DE COBRANÇAS (para HomeScreen)
// ============================================================================

/**
 * Componente para exibir resumo de cobranças pendentes na Home
 * Pode ser usado como widget no dashboard
 */
export function CobrancasResumoWidget({ onPress }: { onPress: () => void }) {
  const { canCobrar } = useAuth();
  
  // Buscar contagem de cobranças pendentes do DashboardContext
  // Exibir badge com quantidade
  // Clicar abre a lista de cobranças
  
  return null; // Placeholder - implementar na HomeScreen
}

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

export default CobrancasStack;
export type { CobrancasStackParamList };
export { useCobrancaNavigate, COBRANCA_FILTROS, CobrancasResumoWidget };