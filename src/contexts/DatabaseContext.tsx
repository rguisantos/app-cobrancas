/**
 * DatabaseContext.tsx
 * Contexto para gerenciar estado de inicialização do banco de dados
 * 
 * IMPORTANTE: Este contexto garante que o banco esteja pronto antes de
 * qualquer operação ser realizada.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { databaseService } from '../services/DatabaseService';
import AuthService from '../services/AuthService';
import logger from '../utils/logger';

// ============================================================================
// INTERFACES
// ============================================================================

interface DatabaseContextData {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  reinitialize: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const DatabaseContext = createContext<DatabaseContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface DatabaseProviderProps {
  children: React.ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // Timeout de segurança: se demorar mais de 30s, mostrar erro
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout: inicialização do banco demorou mais de 30 segundos')), 30000);
    });
    
    try {
      logger.info('[DatabaseContext] Inicializando banco de dados...');
      
      await Promise.race([
        (async () => {
          // 1. Inicializar banco
          await databaseService.initialize();
          logger.info('[DatabaseContext] Banco inicializado');
          
          // 2. Inicializar dados padrão
          await databaseService.inicializarAtributosPadrao();
          await databaseService.inicializarRotasPadrao();
          logger.info('[DatabaseContext] Dados padrão inicializados');
          
          // 3. Inicializar usuário admin
          await AuthService.inicializar();
          logger.info('[DatabaseContext] Auth inicializado');
          
          // 4. Diagnóstico
          await databaseService.diagnosticar();
        })(),
        timeoutPromise
      ]);
      
      setIsReady(true);
      logger.info('[DatabaseContext] ✅ Pronto para uso');
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao inicializar banco';
      setError(errorMsg);
      logger.error('[DatabaseContext] ❌ Erro na inicialização:', err);
      setIsReady(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const reinitialize = useCallback(async () => {
    setIsReady(false);
    await initialize();
  }, [initialize]);

  const contextValue: DatabaseContextData = {
    isReady,
    isLoading,
    error,
    reinitialize,
  };

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useDatabase(): DatabaseContextData {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase deve ser usado dentro de um DatabaseProvider');
  }
  return context;
}

// ============================================================================
// HOOK PARA AGUARDAR BANCO PRONTO
// ============================================================================

/**
 * Hook que aguarda o banco estar pronto antes de executar uma operação
 * Retorna null enquanto o banco não está pronto
 */
export function useWaitForDatabase<T>(
  operation: () => Promise<T>,
  deps: React.DependencyList = []
): { data: T | null; loading: boolean; error: Error | null } {
  const { isReady } = useDatabase();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isReady) {
      setData(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    operation()
      .then((result) => {
        if (mounted) {
          setData(result);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, ...deps]);

  return { data, loading, error };
}

export default DatabaseContext;
