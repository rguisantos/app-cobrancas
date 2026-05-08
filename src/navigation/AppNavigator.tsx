/**
 * AppNavigator.tsx
 * Navegação principal do aplicativo mobile
 * Integração: Auth + Permissões + Contexts + Tipos
 * 
 * Estrutura:
 * - AuthStack: Login, Recuperação de Senha
 * - AppTabs: Navegação principal (Home, Clientes, Produtos, Cobranças, Mais)
 * - ModalStack: Telas em modal (Detalhes, Formulários)
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, useColorScheme, Text, AppState, AppStateStatus, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

// Services
import { apiService } from '../services/ApiService';
import { databaseService } from '../services/DatabaseService';
import logger from '../utils/logger';

// Types
import { TipoPermissaoUsuario, PermissoesUsuario } from '../types';

// ============================================================================
// IMPORTS DAS SCREENS (substitua pelos paths reais)
// ============================================================================

// Auth
import LoginScreen from '../screens/LoginScreen';
import RecoverPasswordScreen from '../screens/RecoverPasswordScreen';

// Tabs - Principal
import HomeScreen from '../screens/HomeScreen';
import ClientesStack from './ClientesStack';
import ProdutosStack from './ProdutosStack';
import CobrancasStack from './CobrancasStack';
import MaisScreen from '../screens/MaisScreen';

// Modais / Detalhes
import ClienteDetailScreen from '../screens/ClienteDetailScreen';
import ClienteFormScreen from '../screens/ClienteFormScreen';
import ProdutoDetailScreen from '../screens/ProdutoDetailScreen';
import ProdutoFormScreen from '../screens/ProdutoFormScreen';
import ProdutoAlterarRelogioScreen from '../screens/ProdutoAlterarRelogioScreen';
import LocacoesListScreen from '../screens/LocacoesListScreen';
import LocacaoFormScreen from '../screens/LocacaoFormScreen';
import LocacaoDetailScreen from '../screens/LocacaoDetailScreen';
import EnviarEstoqueScreen from '../screens/EnviarEstoqueScreen';
import CobrancaConfirmScreen from '../screens/CobrancaConfirmScreen';
import CobrancaDetailScreen from '../screens/CobrancaDetailScreen';
import SyncStatusScreen from '../screens/SyncStatusScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RotasGerenciarScreen from '../screens/RotasGerenciarScreen';
import AtributosProdutoGerenciarScreen from '../screens/AtributosProdutoGerenciarScreen';
import RelatorioManutencaoScreen       from '../screens/RelatorioManutencaoScreen';
import ManutencoesListScreen from '../screens/ManutencoesListScreen';
import ManutencaoFormScreen from '../screens/ManutencaoFormScreen';
import RelatorioCobrancasScreen         from '../screens/RelatorioCobrancasScreen';
import RelatorioSaldoDevedorScreen      from '../screens/RelatorioSaldoDevedorScreen';
import RelatorioInadimplenciaScreen     from '../screens/RelatorioInadimplenciaScreen';
import RelatorioEstoqueScreen           from '../screens/RelatorioEstoqueScreen';
import RelatorioRecebimentosScreen      from '../screens/RelatorioRecebimentosScreen';
import BuscaGlobalScreen                from '../screens/BuscaGlobalScreen';
import UsuariosGerenciarScreen from '../screens/UsuariosGerenciarScreen';
import DeviceActivationScreen from '../screens/DeviceActivationScreen';
import NotificacoesScreen       from '../screens/NotificacoesScreen';
import AgendaScreen             from '../screens/AgendaScreen';
import HistoricoPagamentoScreen from '../screens/HistoricoPagamentoScreen';
import MetasListScreen from '../screens/MetasListScreen';
import MetaFormScreen from '../screens/MetaFormScreen';
import EstabelecimentosListScreen from '../screens/EstabelecimentosListScreen';
import RelatorioRotaDiariaScreen  from '../screens/RelatorioRotaDiariaScreen';
import RelatorioPeriodoScreen     from '../screens/RelatorioPeriodoScreen';
import RelatorioFinanceiroScreen  from '../screens/RelatorioFinanceiroScreen';
import RelatorioRotasScreen        from '../screens/RelatorioRotasScreen';
import RelatorioOperacionalScreen  from '../screens/RelatorioOperacionalScreen';
import RelatorioComparativoScreen  from '../screens/RelatorioComparativoScreen';
import EstabelecimentoFormScreen from '../screens/estabelecimentos/EstabelecimentoFormScreen';
import UsuarioFormScreen from '../screens/admin/UsuarioFormScreen';
import PerfilScreen from '../screens/perfil/PerfilScreen';
import ReciboScreen from '../screens/cobrancas/ReciboScreen';
import MapaClientesScreen from '../screens/mapa/MapaClientesScreen';

// ============================================================================
// CONFIGURAÇÃO DE TEMAS
// ============================================================================

const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2563EB', // Azul principal
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    border: '#E2E8F0',
    notification: '#EF4444',
  },
};

const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#3B82F6',
    background: '#0F172A',
    card: '#1E293B',
    text: '#F1F5F9',
    border: '#334155',
    notification: '#F87171',
  },
};

// ============================================================================
// TIPOS DE NAVEGAÇÃO
// ============================================================================

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  RecoverPassword: undefined;
};

// App Tabs
export type AppTabsParamList = {
  Home: undefined;
  Clientes: undefined;
  Produtos: undefined;
  Cobrancas: undefined;
  Mais: undefined;
};

// Modal Stack (telas em modal sobre as tabs)
export type ModalStackParamList = {
  AppTabs: undefined;
  ClienteDetail: { clienteId: string };
  ClienteForm: { clienteId?: string; modo: 'criar' | 'editar' };
  ProdutoDetail: { produtoId: string };
  ProdutoForm: { produtoId?: string; modo: 'criar' | 'editar' };
  ProdutoAlterarRelogio: { produtoId: string };
  LocacoesList: { clienteId: string };
  LocacaoForm: { clienteId: string; produtoId?: string; locacaoId?: string; modo: 'criar' | 'editar' | 'relocar' };
  LocacaoDetail: { locacaoId: string };
  EnviarEstoque: { locacaoId: string; produtoId: string };
  CobrancaConfirm: { locacaoId: string; cobrancaId?: string; modo?: 'nova' | 'editar' | 'parcial' };
  CobrancaDetail: { cobrancaId: string };
  SyncStatus: undefined;
  Settings: undefined;
  RotasGerenciar: undefined;
  AtributosProdutoGerenciar: undefined;
  UsuariosGerenciar: undefined;
  RelatorioManutencao:     undefined;
  RelatorioCobrancas:      undefined;
  RelatorioSaldoDevedor:   undefined;
  RelatorioInadimplencia:  undefined;
  RelatorioEstoque:        undefined;
  RelatorioRecebimentos:   undefined;
  RelatorioRotaDiaria:     undefined;
  RelatorioPeriodo:        undefined;
  RelatorioFinanceiro:     undefined;
  RelatorioRotas:          undefined;
  RelatorioOperacional:    undefined;
  RelatorioComparativo:    undefined;
  BuscaGlobal:             undefined;
  ManutencoesList: undefined;
  ManutencaoForm: { modo: 'criar' | 'editar'; produtoId?: string; manutencaoId?: string };
  MetasList: undefined;
  MetaForm: { modo: 'criar' | 'editar'; metaId?: string };
  EstabelecimentosList: undefined;
  EstabelecimentoForm: { modo: 'criar' | 'editar'; estabelecimentoId?: string; estabelecimentoNome?: string; estabelecimentoEndereco?: string; estabelecimentoObservacao?: string };
  UsuarioForm: { modo: 'criar' | 'editar'; usuarioId?: string; usuarioNome?: string; usuarioEmail?: string; usuarioCpf?: string; usuarioTelefone?: string; usuarioTipoPermissao?: string; usuarioStatus?: string };
  Perfil: undefined;
  Notificacoes: undefined;
  Agenda: undefined;
  HistoricoPagamento: { cobrancaId: string; clienteNome?: string };
  Recibo: { cobrancaId: string };
  MapaClientes: undefined;
};

// Root Stack (gerencia auth state)
export type RootStackParamList = {
  Auth: undefined;
  DeviceActivation: undefined;
  App: undefined;
  Modal: ModalStackParamList;
};

// ============================================================================
// STACKS
// ============================================================================

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabsParamList>();
const ModalStack = createNativeStackNavigator<ModalStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// ============================================================================
// AUTH STACK
// ============================================================================

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 200,
      }}    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen 
        name="RecoverPassword" 
        component={RecoverPasswordScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Recuperar Senha' }}
      />
    </AuthStack.Navigator>
  );
}

// ============================================================================
// APP TABS - NAVEGAÇÃO PRINCIPAL
// ============================================================================

function AppTabsNavigator() {
  const { user, hasPermission } = useAuth();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkNavTheme : LightNavTheme;

  return (
    <AppTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Clientes':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Produtos':
              iconName = focused ? 'cube' : 'cube-outline';
              break;
            case 'Cobrancas':
              iconName = focused ? 'cash' : 'cash-outline';
              break;            case 'Mais':
              iconName = focused ? 'menu' : 'menu-outline';
              break;
        
  }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <AppTabs.Screen name="Home" component={HomeScreen} />
      
      {/* Clientes - com permissão */}
      {(!user || user.tipoPermissao === 'Administrador' || hasPermission('clientes', 'mobile')) && (
        <AppTabs.Screen 
          name="Clientes" 
          component={ClientesStack}
          options={{ title: 'Clientes' }}
        />
      )}
      
      {/* Produtos - com permissão */}
      {(!user || user.tipoPermissao === 'Administrador' || hasPermission('produtos', 'mobile')) && (
        <AppTabs.Screen 
          name="Produtos" 
          component={ProdutosStack}
          options={{ title: 'Produtos' }}
        />
      )}
      
      {/* Cobranças - com permissão */}
      {(!user || user.tipoPermissao === 'Administrador' || hasPermission('cobrancasFaturas', 'mobile')) && (
        <AppTabs.Screen 
          name="Cobrancas" 
          component={CobrancasStack}
          options={{ 
            title: 'Cobranças',
            tabBarBadge: undefined, // Pode ser dinâmico com pendências
          }}
        />
      )}
      
      <AppTabs.Screen 
        name="Mais" 
        component={MaisScreen}
        options={{ title: 'Mais' }}
      />
    </AppTabs.Navigator>
  );
}
// ============================================================================
// MODAL STACK - TELAS EM MODAL
// ============================================================================

function ModalNavigator() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkNavTheme : LightNavTheme;

  return (
    <ModalStack.Navigator
      screenOptions={{
        presentation: 'modal',
        headerStyle: {
          backgroundColor: theme.colors.card,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '600' },
        animation: 'slide_from_bottom',
        animationDuration: 250,
      }}
    >
      <ModalStack.Screen 
        name="AppTabs" 
        component={AppTabsNavigator}
        options={{ headerShown: false }}
      />
      
      {/* Clientes */}
      <ModalStack.Screen 
        name="ClienteDetail" 
        component={ClienteDetailScreen}
        options={{ title: 'Detalhes do Cliente' }}
      />
      <ModalStack.Screen 
        name="ClienteForm" 
        component={ClienteFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Cliente' : 'Editar Cliente',
        })}
      />
      
      {/* Produtos */}
      <ModalStack.Screen 
        name="ProdutoDetail" 
        component={ProdutoDetailScreen}
        options={{ title: 'Detalhes do Produto' }}
      />
      <ModalStack.Screen 
        name="ProdutoForm"         component={ProdutoFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Produto' : 'Editar Produto',
        })}
      />
      <ModalStack.Screen 
        name="ProdutoAlterarRelogio" 
        component={ProdutoAlterarRelogioScreen}
        options={{ title: 'Alterar Número do Relógio' }}
      />
      
      {/* Locações */}
      <ModalStack.Screen 
        name="LocacoesList" 
        component={LocacoesListScreen}
        options={{ title: 'Locações do Cliente' }}
      />
      <ModalStack.Screen 
        name="LocacaoForm" 
        component={LocacaoFormScreen}
        options={({ route }) => {
          const titles: Record<string, string> = {
            criar: 'Nova Locação',
            editar: 'Editar Locação',
            relocar: 'Relocar Produto',
          };
          return { title: titles[route.params.modo] || 'Locação' };
        }}
      />
      <ModalStack.Screen 
        name="LocacaoDetail" 
        component={LocacaoDetailScreen}
        options={{ title: 'Detalhes da Locação' }}
      />
      <ModalStack.Screen 
        name="EnviarEstoque" 
        component={EnviarEstoqueScreen}
        options={{ title: 'Enviar para Estoque' }}
      />
      
      {/* Cobranças */}
      <ModalStack.Screen 
        name="CobrancaConfirm" 
        component={CobrancaConfirmScreen}
        options={{ 
          title: 'Confirmar Cobrança',
          gestureEnabled: false, // Impedir fechar sem confirmar
        }}
      />
      <ModalStack.Screen         name="CobrancaDetail" 
        component={CobrancaDetailScreen}
        options={{ title: 'Detalhes da Cobrança' }}
      />
      
      {/* Configurações */}
      <ModalStack.Screen 
        name="SyncStatus" 
        component={SyncStatusScreen}
        options={{ title: 'Sincronização' }}
      />
      <ModalStack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Configurações' }}
      />
      <ModalStack.Screen 
        name="RotasGerenciar" 
        component={RotasGerenciarScreen}
        options={{ title: 'Gerenciar Rotas' }}
      />
      <ModalStack.Screen 
        name="AtributosProdutoGerenciar" 
        component={AtributosProdutoGerenciarScreen}
        options={{ title: 'Atributos de Produto' }}
      />
      <ModalStack.Screen 
        name="UsuariosGerenciar" 
        component={UsuariosGerenciarScreen}
        options={{ title: 'Gerenciar Usuários' }}
      />

      <ModalStack.Screen
        name="RelatorioManutencao"
        component={RelatorioManutencaoScreen}
        options={{ title: 'Relatório de Manutenções' }}
      />
      <ModalStack.Screen
        name="RelatorioCobrancas"
        component={RelatorioCobrancasScreen}
        options={{ title: 'Relatório de Cobranças' }}
      />
      <ModalStack.Screen
        name="RelatorioSaldoDevedor"
        component={RelatorioSaldoDevedorScreen}
        options={{ title: 'Saldo Devedor' }}
      />
      <ModalStack.Screen
        name="RelatorioInadimplencia"
        component={RelatorioInadimplenciaScreen}
        options={{ title: 'Inadimplência' }}
      />
      <ModalStack.Screen
        name="RelatorioEstoque"
        component={RelatorioEstoqueScreen}
        options={{ title: 'Estoque' }}
      />
      <ModalStack.Screen
        name="RelatorioRecebimentos"
        component={RelatorioRecebimentosScreen}
        options={{ title: 'Recebimentos' }}
      />
      <ModalStack.Screen
        name="BuscaGlobal"
        component={BuscaGlobalScreen}
        options={{ title: 'Busca Global' }}
      />
      <ModalStack.Screen
        name="RelatorioRotaDiaria"
        component={RelatorioRotaDiariaScreen}
        options={{ title: 'Rota Diária' }}
      />
      <ModalStack.Screen
        name="RelatorioPeriodo"
        component={RelatorioPeriodoScreen}
        options={{ title: 'Relatório por Período' }}
      />
      <ModalStack.Screen
        name="RelatorioFinanceiro"
        component={RelatorioFinanceiroScreen}
        options={{ title: 'Relatório Financeiro' }}
      />
      <ModalStack.Screen
        name="RelatorioRotas"
        component={RelatorioRotasScreen}
        options={{ title: 'Desempenho por Rota' }}
      />
      <ModalStack.Screen
        name="RelatorioOperacional"
        component={RelatorioOperacionalScreen}
        options={{ title: 'Resumo Operacional' }}
      />
      <ModalStack.Screen
        name="RelatorioComparativo"
        component={RelatorioComparativoScreen}
        options={{ title: 'Comparativo de Períodos' }}
      />

      {/* Manutenções */}
      <ModalStack.Screen
        name="ManutencoesList"
        component={ManutencoesListScreen}
        options={{ title: 'Manutenções' }}
      />
      <ModalStack.Screen
        name="ManutencaoForm"
        component={ManutencaoFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Nova Manutenção' : 'Editar Manutenção',
        })}
      />

      {/* Metas */}
      <ModalStack.Screen
        name="MetasList"
        component={MetasListScreen}
        options={{ title: 'Metas' }}
      />
      <ModalStack.Screen
        name="MetaForm"
        component={MetaFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Nova Meta' : 'Editar Meta',
        })}
      />

      {/* Estabelecimentos */}
      <ModalStack.Screen
        name="EstabelecimentosList"
        component={EstabelecimentosListScreen}
        options={{ title: 'Estabelecimentos' }}
      />
      <ModalStack.Screen
        name="EstabelecimentoForm"
        component={EstabelecimentoFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Estabelecimento' : 'Editar Estabelecimento',
        })}
      />

      {/* Usuários - Form */}
      <ModalStack.Screen
        name="UsuarioForm"
        component={UsuarioFormScreen}
        options={({ route }) => ({
          title: route.params.modo === 'criar' ? 'Novo Usuário' : 'Editar Usuário',
        })}
      />

      {/* Perfil */}
      <ModalStack.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{ title: 'Meu Perfil' }}
      />

      {/* Notificações, Agenda e Histórico de Pagamentos */}
      <ModalStack.Screen
        name="Notificacoes"
        component={NotificacoesScreen}
        options={{ title: 'Notificações' }}
      />
      <ModalStack.Screen
        name="Agenda"
        component={AgendaScreen}
        options={{ title: 'Agenda' }}
      />
      <ModalStack.Screen
        name="HistoricoPagamento"
        component={HistoricoPagamentoScreen}
        options={{ title: 'Histórico de Pagamentos' }}
      />

      {/* Recibo */}
      <ModalStack.Screen
        name="Recibo"
        component={ReciboScreen}
        options={{ title: 'Recibo' }}
      />

      {/* Mapa de Clientes */}
      <ModalStack.Screen
        name="MapaClientes"
        component={MapaClientesScreen}
        options={{ title: 'Mapa de Clientes' }}
      />
    </ModalStack.Navigator>
  );
}

// ============================================================================
// ROOT NAVIGATOR - GERENCIAMENTO DE AUTH STATE
// ============================================================================

export function AppNavigator() {
  const { user, isLoading, isAuthenticated, isSignout, token, logout } = useAuth();
  const { status: syncStatus, dispositivo } = useSync();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? DarkNavTheme : LightNavTheme;
  
  // Estado para verificação de ativação do dispositivo
  const [checkingDevice, setCheckingDevice] = useState(true);
  const [deviceActivated, setDeviceActivated] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Ref para evitar re-verificação desnecessária e controlar fluxo de autenticação
  const lastAuthStateRef = useRef<string>('');
  const isCheckingRef = useRef(false);
  const DEVICE_ACTIVATED_KEY = '@cobrancas:deviceActivated';

  // Função para persistir estado de ativação
  const persistActivationState = useCallback(async (activated: boolean) => {
    try {
      await AsyncStorage.setItem(DEVICE_ACTIVATED_KEY, JSON.stringify(activated));
      logger.info(`[AppNavigator] Estado de ativação persistido: ${activated}`);
    } catch (e) {
      logger.warn('[AppNavigator] Falha ao persistir estado de ativação:', e);
    }
  }, []);

  // Função para restaurar estado de ativação do AsyncStorage
  const restoreActivationState = useCallback(async (): Promise<boolean | null> => {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_ACTIVATED_KEY);
      if (stored !== null) {
        return JSON.parse(stored) as boolean;
      }
    } catch (e) {
      logger.warn('[AppNavigator] Falha ao restaurar estado de ativação:', e);
    }
    return null;
  }, []);

  // Verificar se o dispositivo está ativado — rodar apenas uma vez por sessão autenticada
  useEffect(() => {
    const currentAuthState = `${isAuthenticated}-${isSignout}`;
    
    // Evitar re-verificação se o estado de auth não mudou significativamente
    if (currentAuthState === lastAuthStateRef.current) {
      return;
    }
    lastAuthStateRef.current = currentAuthState;

    // Evitar re-entrância (duas verificações rodando ao mesmo tempo)
    if (isCheckingRef.current) {
      return;
    }

    const checkDeviceActivation = async () => {
      if (!isAuthenticated || isSignout) {
        setCheckingDevice(false);
        setDeviceActivated(false);
        persistActivationState(false);
        return;
      }

      isCheckingRef.current = true;
      
      logger.info('[AppNavigator] Verificando ativação do dispositivo...');
      
      try {
        const metadata = await databaseService.getSyncMetadata();
        const savedDeviceKey = metadata.deviceKey;
        const savedDeviceId = metadata.deviceId;

        logger.info('[AppNavigator] Dados locais (sync_metadata):', {
          deviceId: savedDeviceId,
          deviceKey: savedDeviceKey?.substring(0, 20) + '...'
        });

        // Sem chave/ID local: precisa ativação
        if (!savedDeviceId || !savedDeviceKey) {
          logger.info('[AppNavigator] Sem metadados do dispositivo — precisa ativação');
          // Restaurar do AsyncStorage para caso de reinício do app
          const restoredState = await restoreActivationState();
          if (restoredState === false) {
            setDeviceActivated(false);
          } else if (restoredState === true) {
            // AsyncStorage diz ativado, mas não há metadados locais — provável erro
            // Não confiar no cache sem metadados locais
            setDeviceActivated(false);
            persistActivationState(false);
          } else {
            setDeviceActivated(false);
          }
          setCheckingDevice(false);
          return;
        }

        // Com metadados válidos: validar no servidor quando possível
        logger.info('[AppNavigator] Dispositivo com metadados locais — verificando servidor...');
          
        try {
          const response = await apiService.verificarStatusDispositivo(savedDeviceKey);
          
          logger.info('[AppNavigator] Resposta do servidor:', response.data);
          
          if (response.success && response.data?.needsActivation === true) {
            logger.warn('[AppNavigator] Dispositivo desativado pelo admin');
            setDeviceActivated(false);
            persistActivationState(false);
          } else {
            logger.info('[AppNavigator] Dispositivo confirmado ativo');
            setDeviceActivated(true);
            persistActivationState(true);
          }
        } catch (serverError) {
          // Erro de rede: confiar nos metadados locais (offline-first)
          logger.warn('[AppNavigator] Erro ao verificar servidor — usando metadados locais como fallback');
          setDeviceActivated(true);
          persistActivationState(true);
        }
      } catch (error) {
        logger.error('[AppNavigator] Erro ao verificar ativação:', error);
        // Offline-first: se já existe dispositivo registrado localmente, mantém acesso
        try {
          const metadata = await databaseService.getSyncMetadata();
          if (metadata.deviceId && metadata.deviceKey) {
            logger.info('[AppNavigator] Erro com metadados locais válidos — permitindo acesso');
            setDeviceActivated(true);
            persistActivationState(true);
            return;
          }
        } catch (metadataError) {
          logger.warn('[AppNavigator] Falha ao ler sync_metadata após erro de ativação', metadataError);
        }

        // Se não há metadados locais, precisa ativação
        setDeviceActivated(false);
        persistActivationState(false);
        setCheckError(error instanceof Error ? error.message : 'Erro ao verificar dispositivo');
      } finally {
        setCheckingDevice(false);
        isCheckingRef.current = false;
      }
    };
    
    checkDeviceActivation();
  }, [isAuthenticated, isSignout]); // Removido `token` das dependências para evitar re-verificação em refresh de token
  
  // Listener para mudanças de estado do app (background → foreground)
  useEffect(() => {
    const checkActivation = async () => {
      // Se já está ativado, não precisa re-verificar
      if (deviceActivated) {
        return;
      }
      
      // Verificar metadados locais e AsyncStorage
      try {
        const metadata = await databaseService.getSyncMetadata();
        if (metadata.deviceId && metadata.deviceKey) {
          // Tem metadados locais — marcar como ativado (offline-first)
          setDeviceActivated(true);
          persistActivationState(true);
          return;
        }
        
        // Sem metadados locais — verificar AsyncStorage
        const restoredState = await restoreActivationState();
        if (restoredState === true) {
          setDeviceActivated(true);
        }
        // Se restoredState === false ou null, permanece na tela de ativação
      } catch (e) {
        logger.warn('[AppNavigator] Erro ao verificar ativação no AppState:', e);
      }
    };
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkActivation();
      }
    });
    
    return () => subscription.remove();
  }, [deviceActivated]);

  // Enquanto carrega auth ou verifica dispositivo, mostra loading
  if (isLoading || checkingDevice) {
    return (
      <NavigationContainer theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.text, fontSize: 14 }}>
            {isLoading ? 'Carregando...' : 'Verificando dispositivo...'}
          </Text>
        </View>
      </NavigationContainer>
    );
  }
  
  // Mostrar erro se houver — com opções de retry e logout
  if (checkError && isAuthenticated && !isSignout) {
    return (
      <NavigationContainer theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, padding: 20 }}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={{ marginTop: 16, color: '#EF4444', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
            Erro ao verificar dispositivo
          </Text>
          <Text style={{ marginTop: 8, color: theme.colors.text, fontSize: 14, textAlign: 'center', opacity: 0.7 }}>
            {checkError}
          </Text>
          <View style={{ marginTop: 24, gap: 12, width: '100%', maxWidth: 280 }}>
            <TouchableOpacity
              onPress={() => {
                setCheckError(null);
                setCheckingDevice(true);
              }}
              style={{ backgroundColor: theme.colors.primary, borderRadius: 8, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Tentar novamente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await logout();
              }}
              style={{ borderWidth: 1, borderColor: '#EF4444', borderRadius: 8, padding: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>Sair da conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {/* Se não autenticado ou signout, mostra Auth */}
        {!isAuthenticated || isSignout ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : !deviceActivated ? (
          /* Dispositivo não ativado - mostrar tela de ativação */
          <RootStack.Screen name="DeviceActivation" component={DeviceActivationScreen} />
        ) : (
          /* App principal */
          <RootStack.Screen name="App" component={ModalNavigator} />
        )}
      </RootStack.Navigator>
      
      {/* Overlay de sincronização (opcional) */}
      {isAuthenticated && deviceActivated && syncStatus === 'syncing' && (
        <SyncOverlay />
      )}
    </NavigationContainer>
  );
}

// ============================================================================
// COMPONENTE AUXILIAR: OVERLAY DE SYNC
// ============================================================================

function SyncOverlay() {
  return (
    // Implementar um indicador visual discreto de sincronização
    // Ex: barra no topo ou toast
    null // Placeholder - implementar conforme design
  );
}

// ============================================================================
// HOOK AUXILIAR PARA NAVEGAÇÃO COM PERMISSÕES
// ============================================================================

/**
 * Hook para navegação segura com verificação de permissões
 * Uso: const navigate = useAuthNavigate();
 *      navigate('ClienteDetail', { clienteId: '123' });
 */
export function useAuthNavigate() {
  const navigation = useNavigation<ModalStackNavigationProp>();
  const { user, hasPermission, canAccessRota } = useAuth();

  const navigate = useCallback(<Screen extends keyof ModalStackParamList>(
    screen: Screen,
    params?: ModalStackParamList[Screen],
    options?: { requirePermission?: boolean; rotaId?: string }
  ) => {
    // Verificar permissão se necessário
    if (options?.requirePermission && user?.tipoPermissao !== 'Administrador') {
      // Verificar permissão específica da tela
      const permissionMap: Record<string, keyof PermissoesUsuario['mobile']> = {
        'ClienteForm': 'clientes',
        'ProdutoForm': 'produtos',
        'LocacaoForm': 'locacaoRelocacaoEstoque',
        'CobrancaConfirm': 'cobrancasFaturas',
        'ProdutoAlterarRelogio': 'alteracaoRelogio',
      };

      const requiredPerm = permissionMap[screen as string];
      if (requiredPerm && !hasPermission(requiredPerm, 'mobile')) {
        console.warn(`[Navigation] Permissão negada para ${screen}`);
        return;
    
  }
  
  }

    // Verificar acesso à rota se fornecido
    if (options?.rotaId && !canAccessRota(options.rotaId)) {
      console.warn(`[Navigation] Acesso à rota ${options.rotaId} negado`);
      return;
  
  }

    // Navegar com tipo seguro — o genérico <Screen> já restringe os tipos
    (navigation as any).navigate(screen, params);
  }, [navigation, user, hasPermission, canAccessRota]);

  return navigate;
}

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

export default AppNavigator;

// Types para navegação tipada
export type ModalStackNavigationProp = NativeStackNavigationProp<ModalStackParamList>;
export type AppTabsNavigationProp = BottomTabNavigationProp<AppTabsParamList>;
export type AuthStackNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
