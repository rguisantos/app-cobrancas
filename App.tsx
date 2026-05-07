/**
 * App.tsx
 * Ponto de entrada principal do aplicativo
 * 
 * Responsabilidades:
 * - Configurar todos os Providers via AppProviders
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

// Composite Provider (replaces 11 levels of inline nesting)
import { AppProviders } from './src/providers/AppProviders';
import { DatabaseProvider, useDatabase } from './src/contexts/DatabaseContext';

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

  handleRetry = async () => {
    // Primeiro tenta apenas limpar o estado — se o erro voltar imediatamente,
    // o ErrorBoundary capturará novamente. Para erros graves, força reload completo.
    try {
      await Updates.reloadAsync();
    } catch {
      // Se não for possível recarregar (ex: desenvolvimento), apenas limpa o estado
      this.setState({ hasError: false, error: null });
    }
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
// TELA DE ERRO
// ============================================================================

interface ErrorScreenProps {
  error: Error | null;
  onRetry: () => void;
}

function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  const { primaryColor } = getBrandingConfig();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
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

      <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>
        Oops! Algo deu errado
      </Text>

      <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
        {__DEV__ && error?.message
          ? error.message
          : 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'}
      </Text>

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

  const handleReload = React.useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      logger.error('Não foi possível recarregar o app', e, 'App');
    }
  }, []);

  if (error) {
    return (
      <ErrorScreen
        error={new Error(error)}
        onRetry={handleReload}
      />
    );
  }

  if (isLoading || !isReady) {
    return <LoadingScreen />;
  }

  // AppProviders handles all context nesting cleanly
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
