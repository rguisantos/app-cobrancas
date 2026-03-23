import Constants from 'expo-constants';

// URL da API - lê da variável de ambiente ou usa fallback
const getApiUrl = (): string => {
  // Tentar pegar do extra do expo config
  const extraUrl = (Constants.expoConfig as any)?.extra?.API_URL;
  if (extraUrl) return extraUrl;
  
  // Tentar pegar do process.env
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  
  // Fallback para desenvolvimento local
  return 'http://localhost:3000';
};

export const CONFIG = {
  // URL da API backend
  API_URL: getApiUrl(),
  
  // Chaves de armazenamento
  tokenStorageKey: '@app_cobrancas:token',
  userStorageKey: '@app_cobrancas:user',
  deviceKeyStorageKey: '@app_cobrancas:device',
  
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
    const mockEnv = process.env.EXPO_PUBLIC_USE_MOCK;
    // Se não definido, assume true para compatibilidade
    if (mockEnv === undefined) return true;
    return mockEnv === 'true' || mockEnv === '1';
  },
};
