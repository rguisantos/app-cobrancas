/**
 * AppProviders.tsx
 * Composite provider that wraps all app contexts in a clean, readable structure.
 *
 * Provider order matters — inner providers may depend on outer ones:
 *   AuthProvider → SyncProvider → DashboardProvider → ...
 *
 * NOTE: DatabaseProvider is NOT included here because it's provided at the
 * App level (needed by AppWithDatabase for the loading screen before other
 * providers mount).
 *
 * SyncProvider and DashboardProvider need auth info, so they have wrapper
 * components that read from AuthContext via useAuth().
 */

import React, { ReactNode } from 'react';

// Contexts
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SyncProvider, SyncConfig } from '../contexts/SyncContext';
import { DashboardProvider } from '../contexts/DashboardContext';
import { LocacaoProvider } from '../contexts/LocacaoContext';
import { ClienteProvider } from '../contexts/ClienteContext';
import { ProdutoProvider } from '../contexts/ProdutoContext';
import { CobrancaProvider } from '../contexts/CobrancaContext';
import { RotaProvider } from '../contexts/RotaContext';

// Config
import { ENV } from '../config/env';

// ============================================================================
// WRAPPERS FOR PROVIDERS THAT NEED CONTEXT DEPENDENCIES
// ============================================================================

/**
 * SyncProvider wrapper that reads auth state and passes config.
 * Must be rendered inside AuthProvider.
 */
function SyncProviderWrapper({ children }: { children: ReactNode }) {
  // SyncProvider needs config — currently static, but the wrapper
  // exists so we can inject auth-dependent config in the future
  // (e.g., disabling sync when not authenticated).
  const syncConfig: Partial<SyncConfig> = {
    autoSyncEnabled: true,
    autoSyncInterval: ENV.SYNC_INTERVAL,
    syncOnAppStart: true,
    syncOnAppResume: true,
    warnBeforeLargeSync: true,
    maxRecordsPerSync: ENV.MAX_RECORDS_PER_SYNC,
  };

  return <SyncProvider config={syncConfig}>{children}</SyncProvider>;
}

/**
 * DashboardProvider wrapper that reads auth state and passes usuario info.
 * Must be rendered inside AuthProvider.
 */
function DashboardProviderWrapper({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const usuarioNome = user?.nome || 'Usuário';
  const usuarioTipo = user?.tipoPermissao || 'Administrador';

  return (
    <DashboardProvider usuarioNome={usuarioNome} usuarioTipo={usuarioTipo}>
      {children}
    </DashboardProvider>
  );
}

// ============================================================================
// COMPOSITE PROVIDER
// ============================================================================

/**
 * Wraps all app contexts in the correct dependency order.
 *
 * Order (outer → inner):
 *   AuthProvider → SyncProvider → DashboardProvider →
 *   LocacaoProvider → ClienteProvider → ProdutoProvider → CobrancaProvider → RotaProvider
 *
 * DatabaseProvider is provided at the App level and is NOT included here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SyncProviderWrapper>
        <DashboardProviderWrapper>
          <LocacaoProvider>
            <ClienteProvider>
              <ProdutoProvider>
                <CobrancaProvider>
                  <RotaProvider>
                    {children}
                  </RotaProvider>
                </CobrancaProvider>
              </ProdutoProvider>
            </ClienteProvider>
          </LocacaoProvider>
        </DashboardProviderWrapper>
      </SyncProviderWrapper>
    </AuthProvider>
  );
}

export default AppProviders;
