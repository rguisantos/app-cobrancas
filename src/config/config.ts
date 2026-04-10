import Constants from 'expo-constants';

// URL da API - lê da variável de ambiente ou usa fallback
const getApiUrl = (): string => {
  // Tentar pegar do extra do expo config
  const extraUrl = (Constants.expoConfig as any)?.extra?.API_URL;
  if (extraUrl) return extraUrl;
  
  // Tentar pegar do process.env
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  
  // Fallback - AVISO: isso provavelmente não funcionará em produção!
  console.warn('⚠️ API_URL não configurado! Configure EXPO_PUBLIC_API_URL no .env');
  return 'https://api.seuservidor.com.br';
};

// Modo mock - lê da variável de ambiente
const getUseMock = (): boolean => {
  const mockEnv = process.env.EXPO_PUBLIC_USE_MOCK;
  // Se não definido, assume FALSE (precisa configurar .env)
  if (mockEnv === undefined) {
    console.warn('⚠️ USE_MOCK não configurado. Configure EXPO_PUBLIC_USE_MOCK=false no .env para conectar ao backend.');
    return false;
  }
  return mockEnv === 'true' || mockEnv === '1';
};

export const CONFIG = {
  // URL da API backend
  API_URL: getApiUrl(),
  
  // Chaves de armazenamento (DEVEM ser iguais às do AuthContext!)
  tokenStorageKey: '@cobrancas:token',
  userStorageKey: '@cobrancas:user',
  deviceKeyStorageKey: '@cobrancas:device',
  
  // Configurações de sincronização
  syncIntervalMs: 15 * 60 * 1000, // 15 minutos
  syncTimeout: 30000, // 30 segundos
  
  // Debug
  get debug() {
    const debugEnv = process.env.EXPO_PUBLIC_DEBUG;
    return debugEnv === 'true' || debugEnv === '1';
  },
  
  // Modo mock
  get useMock() {
    return getUseMock();
  },
};
