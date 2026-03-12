/**
 * components/BrandingProvider.tsx
 * Provider para configurações de marca white label
 * 
 * Uso: Envolve o app e fornece configurações de branding para todos os componentes
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { DEFAULT_BRANDING, BrandingConfig, getBrandingConfig } from '../config/branding';

// ============================================================================
// INTERFACES
// ============================================================================

interface BrandingContextType {
  branding: BrandingConfig;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  appName: string;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface BrandingProviderProps {
  children: ReactNode;
  clientId?: string;
}

export function BrandingProvider({ children, clientId }: BrandingProviderProps) {
  const branding = getBrandingConfig(clientId);

  const contextValue: BrandingContextType = {
    branding,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    appName: branding.appName,
  };

  return (
    <BrandingContext.Provider value={contextValue}>
      {children}
    </BrandingContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useBranding(): BrandingContextType {
  const context = useContext(BrandingContext);

  if (context === undefined) {
    throw new Error('useBranding deve ser usado dentro de um BrandingProvider');
  }

  return context;
}

// ============================================================================
// HOOKS ESPECÍFICOS
// ============================================================================

export function usePrimaryColor(): string {
  const { primaryColor } = useBranding();
  return primaryColor;
}

export function useSecondaryColor(): string {
  const { secondaryColor } = useBranding();
  return secondaryColor;
}

export function useAccentColor(): string {
  const { accentColor } = useBranding();
  return accentColor;
}

export function useAppName(): string {
  const { appName } = useBranding();
  return appName;
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export default BrandingContext;