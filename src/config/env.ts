/**
 * config/env.ts
 * Configurações de ambiente do aplicativo
 * 
 * Variáveis de ambiente (.env):
 * EXPO_PUBLIC_API_URL=https://api.suaempresa.com.br
 * EXPO_PUBLIC_USE_MOCK=true
 * EXPO_PUBLIC_APP_VERSION=1.0.0
 * EXPO_PUBLIC_APP_NAME=Nome do App
 */

import Constants from 'expo-constants';

// ============================================================================
// INTERFACES
// ============================================================================

interface EnvConfig {
  API_URL: string;
  USE_MOCK: boolean;
  APP_VERSION: string;
  APP_NAME: string;
  DEBUG: boolean;
  SYNC_INTERVAL: number;
  MAX_RECORDS_PER_SYNC: number;
  TIMEOUT: number;
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const getEnvValue = (key: string, defaultValue: string = ''): string => {
  // Tentar pegar do extra do expo config
  const extraValue = (Constants.expoConfig as any)?.extra?.[key];
  if (extraValue !== undefined && extraValue !== null) {
    return String(extraValue);
  }
  
  // Tentar pegar do process.env
  const envValue = process.env[`EXPO_PUBLIC_${key}`];
  if (envValue !== undefined && envValue !== null) {
    return envValue;
  }
  
  return defaultValue;
};

const getBoolValue = (key: string, defaultValue: boolean = false): boolean => {
  const value = getEnvValue(key, defaultValue.toString());
  return value === 'true' || value === '1';
};

const getNumberValue = (key: string, defaultValue: number = 0): number => {
  const value = getEnvValue(key, defaultValue.toString());
  return parseInt(value, 10) || defaultValue;
};

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

// IMPORTANTE: USE_MOCK deve ser true por padrão para o app funcionar offline
export const ENV: EnvConfig = {
  // API
  API_URL: getEnvValue('API_URL', 'https://api.diamondsistemas.com.br'),
  
  // Mock (desenvolvimento) - TRUE por padrão para funcionar offline
  USE_MOCK: true, // Sempre usar mock para demonstração
  
  // App Info
  APP_VERSION: getEnvValue('APP_VERSION', '1.0.0'),
  APP_NAME: getEnvValue('APP_NAME', 'App Cobranças'),
  
  // Debug
  DEBUG: getBoolValue('DEBUG', true),
  
  // Sync
  SYNC_INTERVAL: getNumberValue('SYNC_INTERVAL', 15), // minutos
  MAX_RECORDS_PER_SYNC: getNumberValue('MAX_RECORDS_PER_SYNC', 100),
  
  // Timeout
  TIMEOUT: getNumberValue('TIMEOUT', 30000), // 30 segundos
};

// ============================================================================
// VALIDAÇÃO (opcional)
// ============================================================================

if (__DEV__ && ENV.DEBUG) {
  console.log('[ENV] Configuração:', ENV);
}

export default ENV;