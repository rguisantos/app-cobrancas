/**
 * config/env.ts
 * Configurações de ambiente do aplicativo com validação Zod
 * 
 * Variáveis de ambiente (.env):
 * EXPO_PUBLIC_API_URL=https://api.suaempresa.com.br
 * EXPO_PUBLIC_USE_MOCK=true
 * EXPO_PUBLIC_APP_VERSION=1.0.0
 * EXPO_PUBLIC_APP_NAME=Nome do App
 */

import { z } from 'zod';
import Constants from 'expo-constants';

// ============================================================================
// SCHEMA DE VALIDAÇÃO COM ZOD
// ============================================================================

const envSchema = z.object({
  // API
  API_URL: z.string().default('https://api.seuservidor.com.br'),
  
  // Mock (desenvolvimento) - FALSE por padrão para evitar confusão em produção
  // IMPORTANTE: Se não configurar .env, o app não conectará ao backend!
  USE_MOCK: z.boolean().default(false),
  
  // App Info
  APP_VERSION: z.string().default('1.0.0'),
  APP_NAME: z.string().default('App Cobranças'),
  
  // Debug
  DEBUG: z.boolean().default(false),
  
  // Sync
  SYNC_INTERVAL: z.number().int().positive().default(15),
  MAX_RECORDS_PER_SYNC: z.number().int().positive().default(100),
  
  // Timeout
  TIMEOUT: z.number().int().positive().default(30000),
  
  // Credenciais Mock (apenas para desenvolvimento)
  MOCK_EMAIL: z.string().email().optional(),
  MOCK_PASSWORD: z.string().optional(),
  MOCK_PERMISSION: z.enum(['Administrador', 'Secretario', 'AcessoControlado']).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

// ============================================================================
// FUNÇÕES AUXILIARES
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
  const value = getEnvValue(key, '');
  // Se valor vazio, usar default
  if (value === '' || value === undefined) {
    return defaultValue;
  }
  // Aceitar 'true', '1', ou converter explicitamente
  return value === 'true' || value === '1';
};

const getNumberValue = (key: string, defaultValue: number = 0): number => {
  const value = getEnvValue(key, defaultValue.toString());
  return parseInt(value, 10) || defaultValue;
};

// ============================================================================
// PARSE E VALIDAÇÃO
// ============================================================================

const parseEnvConfig = (): EnvConfig => {
  const rawConfig = {
    API_URL: getEnvValue('API_URL', 'https://api.seuservidor.com.br'),
    USE_MOCK: getBoolValue('USE_MOCK', false), // FALSE por padrão - precisa configurar .env
    APP_VERSION: getEnvValue('APP_VERSION', '1.0.0'),
    APP_NAME: getEnvValue('APP_NAME', 'App Cobranças'),
    DEBUG: getBoolValue('DEBUG', false),
    SYNC_INTERVAL: getNumberValue('SYNC_INTERVAL', 15),
    MAX_RECORDS_PER_SYNC: getNumberValue('MAX_RECORDS_PER_SYNC', 100),
    TIMEOUT: getNumberValue('TIMEOUT', 30000),
    MOCK_EMAIL: getEnvValue('MOCK_EMAIL', '') || undefined,
    MOCK_PASSWORD: getEnvValue('MOCK_PASSWORD', '') || undefined,
    MOCK_PERMISSION: (getEnvValue('MOCK_PERMISSION', 'Administrador') as any) || undefined,
  };

  try {
    const config = envSchema.parse(rawConfig);
    
    // AVISO CRÍTICO: Se USE_MOCK está true mas sem credenciais mock
    if (config.USE_MOCK && !config.MOCK_EMAIL) {
      console.warn('⚠️ AVISO: USE_MOCK=true mas MOCK_EMAIL não configurado!');
      console.warn('   Configure MOCK_EMAIL e MOCK_PASSWORD no .env para usar modo mock.');
    }
    
    // AVISO CRÍTICO: Se USE_MOCK está false mas API_URL é o fallback
    if (!config.USE_MOCK && config.API_URL === 'https://api.seuservidor.com.br') {
      console.error('⚠️⚠️⚠️ CONFIGURAÇÃO CRÍTICA ⚠️⚠️⚠️');
      console.error('USE_MOCK=false mas API_URL não está configurado!');
      console.error('Configure EXPO_PUBLIC_API_URL no arquivo .env');
      console.error('Exemplo: EXPO_PUBLIC_API_URL=https://seu-servidor.com.br');
    }
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[ENV] Erro de validação das variáveis de ambiente:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    // Retornar config com defaults em caso de erro
    return envSchema.parse({});
  }
};

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const ENV: EnvConfig = parseEnvConfig();

// ============================================================================
// LOG EM DESENVOLVIMENTO
// ============================================================================

if (__DEV__ && ENV.DEBUG) {
  console.log('[ENV] Configuração carregada:', {
    ...ENV,
    // Ocultar senha em logs
    MOCK_PASSWORD: ENV.MOCK_PASSWORD ? '***' : undefined,
  });
}

export default ENV;
