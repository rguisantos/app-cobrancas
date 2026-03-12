/**
 * config/branding.ts
 * Configurações de marca white label
 * 
 * Personalize este arquivo para cada cliente
 */

import { ENV } from './env';

// ============================================================================
// INTERFACES
// ============================================================================

export interface BrandingConfig {
  // Identidade Visual
  appName: string;
  appSlug: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  
  // Cores derivadas (calculadas)
  primaryLight: string;
  primaryDark: string;
  
  // Assets
  logoUrl?: string;
  iconUrl?: string;
  splashUrl?: string;
  
  // Textos
  welcomeMessage: string;
  supportEmail: string;
  supportPhone?: string;
  companyName?: string;
  companyWebsite?: string;
  
  // Funcionalidades
  enableWhatsApp: boolean;
  enableMaps: boolean;
  enablePrint: boolean;
  enableSync: boolean;
}

// ============================================================================
// CONFIGURAÇÃO PADRÃO
// ============================================================================

export const DEFAULT_BRANDING: BrandingConfig = {  // Identidade Visual
  appName: ENV.APP_NAME,
  appSlug: 'app-cobrancas',
  primaryColor: '#2563EB', // Azul
  secondaryColor: '#16A34A', // Verde
  accentColor: '#DC2626', // Vermelho
  backgroundColor: '#F8FAFC',
  
  // Cores derivadas
  primaryLight: '#DBEAFE',
  primaryDark: '#1E40AF',
  
  // Assets (caminhos relativos)
  logoUrl: undefined, // './assets/logo.png',
  iconUrl: undefined, // './assets/icon.png',
  splashUrl: undefined, // './assets/splash.png',
  
  // Textos
  welcomeMessage: 'Bem-vindo ao sistema de gestão',
  supportEmail: 'suporte@suaempresa.com.br',
  supportPhone: undefined,
  companyName: 'Sua Empresa',
  companyWebsite: 'https://suaempresa.com.br',
  
  // Funcionalidades
  enableWhatsApp: true,
  enableMaps: true,
  enablePrint: true,
  enableSync: true,
};

// ============================================================================
// CONFIGURAÇÕES POR CLIENTE (exemplos)
// ============================================================================

export const CLIENT_BRANDING: Record<string, BrandingConfig> = {
  // Cliente 1
  'cliente1': {
    ...DEFAULT_BRANDING,
    appName: 'Cliente 1 Cobranças',
    primaryColor: '#7C3AED', // Roxo
    secondaryColor: '#059669', // Verde escuro
    accentColor: '#DC2626',
    companyName: 'Cliente 1 LTDA',
    supportEmail: 'suporte@cliente1.com.br',
  },
  
  // Cliente 2
  'cliente2': {
    ...DEFAULT_BRANDING,    appName: 'Cliente 2 Gestão',
    primaryColor: '#0891B2', // Ciano
    secondaryColor: '#7C3AED', // Roxo
    accentColor: '#EA580C', // Laranja
    companyName: 'Cliente 2 S.A.',
    supportEmail: 'ti@cliente2.com.br',
  },
  
  // Adicione mais clientes conforme necessário
};

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém configuração de branding por ID do cliente
 */
export const getBrandingConfig = (clientId?: string): BrandingConfig => {
  if (clientId && CLIENT_BRANDING[clientId]) {
    return CLIENT_BRANDING[clientId];
  }
  return DEFAULT_BRANDING;
};

/**
 * Obtém cor primária
 */
export const getPrimaryColor = (clientId?: string): string => {
  return getBrandingConfig(clientId).primaryColor;
};

/**
 * Obtém cor secundária
 */
export const getSecondaryColor = (clientId?: string): string => {
  return getBrandingConfig(clientId).secondaryColor;
};

/**
 * Obtém nome do aplicativo
 */
export const getAppName = (): string => {
  return ENV.APP_NAME;
};

// ============================================================================
// EXPORTAÇÃO
// ============================================================================
export default {
  DEFAULT_BRANDING,
  CLIENT_BRANDING,
  getBrandingConfig,
  getPrimaryColor,
  getSecondaryColor,
  getAppName,
};