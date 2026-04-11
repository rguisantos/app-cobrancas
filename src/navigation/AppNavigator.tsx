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
import * as Device from 'expo-device';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';

// Services
import { apiService } from '../services/ApiService';
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
import RelatorioCobrancasScreen         from '../screens/RelatorioCobrancasScreen';
import RelatorioSaldoDevedorScreen      from '../screens/RelatorioSaldoDevedorScreen';
import UsuariosGerenciarScreen from '../screens/UsuariosGerenciarScreen';
import DeviceActivationScreen from '../screens/DeviceActivationScreen';

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
  Produtos: undefined;  Cobrancas: undefined;
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
      {(!user || user.tipoPermissao === 'Administrador' || hasPermission('todosCadastros', 'mobile')) && (
        <AppTabs.Screen 
          name="Clientes" 
          component={ClientesStack}
          options={{ title: 'Clientes' }}
        />
      )}
      
      {/* Produtos - com permissão */}
      {(!user || user.tipoPermissao === 'Administrador' || hasPermission('todosCadastros', 'mobile')) && (
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

  // Gerar chave única do dispositivo
  const generateDeviceKey = async (): Promise<string> => {
    try {
      const deviceId = Device.modelId || 
                       `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const manufacturer = Device.manufacturer || 'unknown';
      const model = Device.modelName || Device.modelId || 'unknown';
      const osVersion = Device.osVersion || 'unknown';
      
      const key = `${manufacturer}_${model}_${osVersion}_${deviceId}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .substring(0, 100);
      
      return key;
    } catch (error) {
      return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  };

  // Verificar se o dispositivo está ativado
  useEffect(() => {
    const checkDeviceActivation = async () => {
      if (!isAuthenticated || isSignout) {
        setCheckingDevice(false);
        setDeviceActivated(false);
        return;
      }
      
      logger.info('[AppNavigator] Verificando ativação do dispositivo...');
      
      try {
        // Verificar se já tem dados de ativação salvos localmente
        const [activated, savedDeviceId, savedDeviceKey] = await AsyncStorage.multiGet([
          '@device:activated',
          '@device:id',
          '@device:key'
        ]);
        
        logger.info('[AppNavigator] Dados locais:', {
          activated: activated[1],
          deviceId: savedDeviceId[1],
          deviceKey: savedDeviceKey[1]?.substring(0, 20) + '...'
        });
        
        // BUG FIX: Se já tem marcação de ativação E deviceKey, confiar no estado local
        // Só verificar servidor para detectar desativação pelo admin
        if (activated[1] === 'true' && savedDeviceKey[1]) {
          logger.info('[AppNavigator] Dispositivo já ativado localmente — verificando servidor...');
          
          // Tentar verificar no servidor (para detectar desativação pelo admin)
          try {
            const response = await apiService.verificarStatusDispositivo(savedDeviceKey[1]);
            
            if (response.success && response.data?.needsActivation === true) {
              // Admin desativou o dispositivo
              logger.warn('[AppNavigator] Dispositivo foi desativado pelo admin');
              await AsyncStorage.removeItem('@device:activated');
              setDeviceActivated(false);
            } else {
              // Dispositivo continua ativo
              logger.info('[AppNavigator] Dispositivo confirmado ativo no servidor');
              setDeviceActivated(true);
            }
          } catch (networkError) {
            // BUG FIX: Erro de rede — assumir que dispositivo está ativo (offline-first)
            logger.warn('[AppNavigator] Erro de rede ao verificar dispositivo — assumindo ativo (offline-first)');
            setDeviceActivated(true);
          }
          
          setCheckingDevice(false);
          return;
        }
        
        // Não tem marcação local — precisa verificar com o servidor
        const deviceKey = savedDeviceKey[1] || await generateDeviceKey();
        
        // Se não tem deviceKey, definitivamente precisa ativar
        if (!savedDeviceKey[1]) {
          logger.info('[AppNavigator] Sem deviceKey — precisa ativação');
          await AsyncStorage.setItem('@device:key', deviceKey);
          setDeviceActivated(false);
          setCheckingDevice(false);
          return;
        }
        
        logger.info('[AppNavigator] Verificando status no servidor...', { deviceKey: deviceKey.substring(0, 30) });
        
        // Fazer requisição para verificar status
        const response = await apiService.verificarStatusDispositivo(deviceKey);
        
        logger.info('[AppNavigator] Resposta do servidor:', response.data);
        
        if (response.success && response.data?.needsActivation === false) {
          // Dispositivo já está ativo no servidor
          logger.info('[AppNavigator] Dispositivo ativo no servidor');
          await AsyncStorage.setItem('@device:activated', 'true');
          setDeviceActivated(true);
        } else {
          // Dispositivo precisa de ativação
          logger.info('[AppNavigator] Dispositivo precisa de ativação');
          setDeviceActivated(false);
        }
      } catch (error) {
        logger.error('[AppNavigator] Erro ao verificar ativação:', error);
        // BUG FIX: Em caso de erro, NÃO bloquear o usuário
        // Verificar se tem marcação local de ativação
        const activated = await AsyncStorage.getItem('@device:activated');
        if (activated === 'true') {
          logger.info('[AppNavigator] Erro de rede mas dispositivo marcado como ativo localmente — permitindo acesso');
          setDeviceActivated(true);
        } else {
          // Sem marcação local e sem conexão — mostrar erro com opção de retry
          setCheckError(error instanceof Error ? error.message : 'Erro ao verificar dispositivo');
          setDeviceActivated(false);
        }
      } finally {
        setCheckingDevice(false);
      }
    };
    
    checkDeviceActivation();
  }, [isAuthenticated, isSignout, token]);
  
  // Listener para mudanças na ativação do dispositivo
  useEffect(() => {
    const checkActivation = async () => {
      const activated = await AsyncStorage.getItem('@device:activated');
      if (activated === 'true') {
        setDeviceActivated(true);
      }
    };
    
    // Verificar a cada vez que o app volta para primeiro plano
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkActivation();
      }
    });
    
    return () => subscription.remove();
  }, []);

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
    options?: { requirePermission?: boolean; rotaId?: string | number }
  ) => {
    // Verificar permissão se necessário
    if (options?.requirePermission && user?.tipoPermissao !== 'Administrador') {
      // Verificar permissão específica da tela
      const permissionMap: Record<string, keyof PermissoesUsuario['mobile']> = {        'ClienteForm': 'todosCadastros',
        'ProdutoForm': 'todosCadastros',
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

    // Navegar normalmente
    navigation.navigate(screen as any, params as any);
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