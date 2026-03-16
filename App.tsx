/**
 * App.tsx
 * Ponto de entrada principal do aplicativo
 * 
 * Responsabilidades:
 * - Configurar todos os Providers (Contexts)
 * - Configurar Navigation
 * - Configurar StatusBar
 * - Error Boundary
 * - Deep Linking (opcional)
 * - Suporte white label via BrandingProvider
 */

import React from 'react';
import { StatusBar, LogBox, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Contexts
import { DatabaseProvider, useDatabase } from './src/contexts/DatabaseContext';
import { AuthProvider } from './src/contexts/AuthContext';
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
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <ErrorScreen
            error={this.state.error}
            onRetry={this.handleRetry}
          />
        </SafeAreaProvider>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// TELA DE ERRO (Componente simples)
// ============================================================================

interface ErrorScreenProps {
  error: Error | null;
  onRetry: () => void;
}

function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ErrorScreenContent error={error} onRetry={onRetry} />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function ErrorScreenContent({ error, onRetry }: ErrorScreenProps) {
  const { primaryColor } = getBrandingConfig();

  return (
    <GestureHandlerRootView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
    </GestureHandlerRootView>
  );
}

// ============================================================================
// TELA DE LOADING
// ============================================================================

function LoadingScreen() {
  const { primaryColor } = getBrandingConfig();
  
  return (
    <GestureHandlerRootView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ActivityIndicator size="large" color={primaryColor} />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#64748B' }}>
        Inicializando banco de dados...
      </Text>
    </GestureHandlerRootView>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL DO APP
// ============================================================================

function AppContent() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFFFF"
          translucent={false}
        />
        {/* Navegação Principal */}
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
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

  // Mostrar erro se houver
  if (error) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ErrorScreen
          error={new Error(error)}
          onRetry={() => window.location?.reload?.()}
        />
      </SafeAreaProvider>
    );
  }

  // Mostrar loading enquanto inicializa
  if (isLoading || !isReady) {
    return <LoadingScreen />;
  }

  // App pronto
  return (
    <AuthProvider>
      <SyncProvider
        config={{
          autoSyncEnabled: true,
          autoSyncInterval: ENV.SYNC_INTERVAL,
          syncOnAppStart: true,
          syncOnAppResume: true,
          warnBeforeLargeSync: true,
          maxRecordsPerSync: ENV.MAX_RECORDS_PER_SYNC,
        }}
      >
        <DashboardProvider
          usuarioNome="Usuário"
          usuarioTipo="Administrador"
        >
          <LocacaoProvider>
            <ClienteProvider>
              <ProdutoProvider>
                <CobrancaProvider>
                  <RotaProvider>
                    <AppContent />
                  </RotaProvider>
                </CobrancaProvider>
              </ProdutoProvider>
            </ClienteProvider>
          </LocacaoProvider>
        </DashboardProvider>
      </SyncProvider>
    </AuthProvider>
  );
}

// ============================================================================
// APP PRINCIPAL
// ============================================================================

export default function App() {
  const clientId = undefined;

  return (
    <ErrorBoundary>
      <BrandingProvider clientId={clientId}>
        <DatabaseProvider>
          <AppWithDatabase />
        </DatabaseProvider>
      </BrandingProvider>
    </ErrorBoundary>
  );
}
