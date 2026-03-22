/**
 * App.tsx
 * Ponto de entrada principal do aplicativo
 * 
 * Responsabilidades:
 * - Configurar todos os Providers (Contexts)
 * - Configurar Navigation
 * - Error Boundary
 * - Suporte white label via BrandingProvider
 */

import React from 'react';
import { StatusBar, LogBox, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Contexts
import { DatabaseProvider, useDatabase } from './src/contexts/DatabaseContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SyncProvider } from './src/contexts/SyncContext';
import { DashboardProvider } from './src/contexts/DashboardContext';
import { LocacaoProvider } from './src/contexts/LocacaoContext';
import { ClienteProvider } from './src/contexts/ClienteContext';
import { ProdutoProvider } from './src/contexts/ProdutoContext';
import { CobrancaProvider } from './src/contexts/CobrancaContext';
import { RotaProvider } from './src/contexts/RotaContext';

// White Label
import { BrandingProvider } from './src/components/BrandingProvider';
import { getBrandingConfig } from './src/config/branding';

// Services
import { apiService } from './src/services/ApiService';
import logger from './src/utils/logger';

// Config
import { ENV } from './src/config/env';

// ============================================================================
// CONFIGURAÇÕES GLOBAIS
// ============================================================================

// Ignorar warnings específicos do React Native em desenvolvimento
if (__DEV__) {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    'VirtualizedLists should never be nested',
  ]);
  logger.setEnabled(true);
}

// ============================================================================
// UTILITÁRIO: COMPOSE PROVIDERS
// ============================================================================

/**
 * Combina múltiplos providers em um único componente
 * Reduz o aninhamento excessivo de providers
 */
const composeProviders = (
  ...providers: Array<React.FC<{ children: React.ReactNode }>>
) => {
  return ({ children }: { children: React.ReactNode }) =>
    providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    );
};

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught error', { error, errorInfo }, 'App');
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// TELA DE ERRO (Componente único, sem duplicação)
// ============================================================================

interface ErrorScreenProps {
  error: Error | null;
  onRetry: () => void;
}

function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  const { primaryColor } = getBrandingConfig();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
      {/* Ícone de erro */}
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${primaryColor}1A`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <Ionicons name="alert-circle" size={40} color={primaryColor} />
      </View>

      {/* Título */}
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>
        Oops! Algo deu errado
      </Text>

      {/* Mensagem */}
      <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
        {__DEV__ && error?.message
          ? error.message
          : 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'}
      </Text>

      {/* Botão de retry */}
      <TouchableOpacity
        onPress={onRetry}
        style={{
          backgroundColor: primaryColor,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Ionicons name="refresh" size={20} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
          Tentar novamente
        </Text>
      </TouchableOpacity>

      {/* Debug info (apenas em dev) */}
      {__DEV__ && error && (
        <ScrollView style={{ marginTop: 24, maxHeight: 200 }}>
          <Text style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>
            {error.stack}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// TELA DE LOADING
// ============================================================================

function LoadingScreen() {
  const { primaryColor } = getBrandingConfig();
  
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color={primaryColor} />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#64748B' }}>
        Inicializando banco de dados...
      </Text>
    </View>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL DO APP
// ============================================================================

function AppContent() {
  return <AppNavigator />;
}

// ============================================================================
// DASHBOARD PROVIDER COM AUTENTICAÇÃO
// ============================================================================

/**
 * Wrapper do DashboardProvider que consome o AuthContext
 * para obter dados do usuário logado
 */
function DashboardProviderWithAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Usar dados do usuário logado ou defaults
  const usuarioNome = user?.nome || 'Usuário';
  const usuarioTipo = user?.tipoPermissao || 'Administrador';
  
  return (
    <DashboardProvider usuarioNome={usuarioNome} usuarioTipo={usuarioTipo}>
      {children}
    </DashboardProvider>
  );
}

// ============================================================================
// APP WRAPPER - AGUARDA BANCO PRONTO
// ============================================================================

function AppWithDatabase() {
  const { isReady, isLoading, error } = useDatabase();

  // Configurar API no início
  React.useEffect(() => {
    if (ENV.API_URL) {
      apiService.setBaseURL(ENV.API_URL);
      logger.info('API configurada', { url: ENV.API_URL }, 'App');
    }

    if (ENV.USE_MOCK) {
      logger.warn('Modo MOCK ativado - dados fictícios em uso', undefined, 'App');
    }

    logger.info('Aplicação configurada', {
      appName: ENV.APP_NAME,
      version: ENV.APP_VERSION,
      debug: ENV.DEBUG
    }, 'App');
  }, []);

  // Função para recarregar o app (multi-plataforma)
  const handleReload = React.useCallback(async () => {
    try {
      // Usar expo-updates para recarregar (funciona em nativo)
      await Updates.reloadAsync();
    } catch (e) {
      // Fallback: apenas logar o erro (em web ou se updates não disponível)
      logger.error('Não foi possível recarregar o app', e, 'App');
    }
  }, []);

  // Mostrar erro se houver
  if (error) {
    return (
      <ErrorScreen
        error={new Error(error)}
        onRetry={handleReload}
      />
    );
  }

  // Mostrar loading enquanto inicializa
  if (isLoading || !isReady) {
    return <LoadingScreen />;
  }

  // Compor todos os providers de forma limpa
  const AppProviders = composeProviders(
    RotaProvider,
    CobrancaProvider,
    ProdutoProvider,
    ClienteProvider,
    LocacaoProvider,
    DashboardProviderWithAuth,
    SyncProvider,
    AuthProvider,
  );

  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

// ============================================================================
// APP PRINCIPAL
// ============================================================================

export default function App() {
  return (
    <ErrorBoundary>
      <BrandingProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <StatusBar
              barStyle="dark-content"
              backgroundColor="#FFFFFF"
              translucent={false}
            />
            <DatabaseProvider>
              <AppWithDatabase />
            </DatabaseProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </BrandingProvider>
    </ErrorBoundary>
  );
}
