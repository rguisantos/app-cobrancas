/**
 * MetaContext.tsx
 * Contexto para gerenciamento de estado de Metas
 * Persistência via DatabaseService (CRUD genérico)
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Meta, TipoMeta, StatusMeta } from '../types';
import { databaseService } from '../services/DatabaseService';
import { useDatabase } from './DatabaseContext';
import { useAuth } from './AuthContext';
import { generateId } from '../utils/database';

// ============================================================================
// INTERFACES
// ============================================================================

export interface MetaContextData {
  metas: Meta[];
  carregando: boolean;
  erro: string | null;
  carregar(): Promise<void>;
  salvar(meta: Omit<Meta, 'id' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Meta>;
  atualizar(meta: Meta): Promise<void>;
  remover(id: string): Promise<void>;
  refresh(): Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const MetaContext = createContext<MetaContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface MetaProviderProps {
  children: ReactNode;
}

export function MetaProvider({ children }: MetaProviderProps) {
  const { isReady } = useDatabase();
  const { user } = useAuth();

  const [metas, setMetas] = useState<Meta[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await databaseService.getAll<Meta>('meta');
      setMetas(lista);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao carregar metas';
      setErro(msg);
      console.error('[MetaContext] Erro ao carregar metas:', error);
    } finally {
      setCarregando(false);
    }
  }, []);

  // ==========================================================================
  // SALVAR (CRIAR)
  // ==========================================================================

  const salvar = useCallback(async (
    dados: Omit<Meta, 'id' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'createdAt' | 'updatedAt' | 'deletedAt'>
  ): Promise<Meta> => {
    setCarregando(true);
    setErro(null);

    try {
      const now = new Date().toISOString();
      const novaMeta: Meta = {
        ...dados,
        id: generateId('meta'),
        syncStatus: 'pending',
        needsSync: 1 as any,
        version: 1,
        deviceId: '', // será preenchido pelo DatabaseService
        createdAt: now,
        updatedAt: now,
        criadoPor: user?.id,
      };

      await databaseService.save('meta', {
        ...novaMeta,
        syncStatus: novaMeta.syncStatus || 'pending',
        createdAt: novaMeta.createdAt || new Date().toISOString(),
        updatedAt: novaMeta.updatedAt || new Date().toISOString(),
      } as any);
      await carregar();
      console.log('[MetaContext] Meta salva:', novaMeta.id);
      return novaMeta;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar meta';
      setErro(msg);
      console.error('[MetaContext] Erro ao salvar meta:', error);
      throw error;
    } finally {
      setCarregando(false);
    }
  }, [carregar, user]);

  // ==========================================================================
  // ATUALIZAR
  // ==========================================================================

  const atualizar = useCallback(async (meta: Meta): Promise<void> => {
    setCarregando(true);
    setErro(null);

    try {
      await databaseService.update('meta', {
        ...meta,
        syncStatus: meta.syncStatus || 'pending',
        createdAt: meta.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      await carregar();
      console.log('[MetaContext] Meta atualizada:', meta.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar meta';
      setErro(msg);
      console.error('[MetaContext] Erro ao atualizar meta:', error);
      throw error;
    } finally {
      setCarregando(false);
    }
  }, [carregar]);

  // ==========================================================================
  // REMOVER (SOFT DELETE)
  // ==========================================================================

  const remover = useCallback(async (id: string): Promise<void> => {
    setCarregando(true);
    setErro(null);

    try {
      await databaseService.delete('meta', id);
      await carregar();
      console.log('[MetaContext] Meta removida:', id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao remover meta';
      setErro(msg);
      console.error('[MetaContext] Erro ao remover meta:', error);
      throw error;
    } finally {
      setCarregando(false);
    }
  }, [carregar]);

  // ==========================================================================
  // REFRESH
  // ==========================================================================

  const refresh = useCallback(async () => {
    await carregar();
  }, [carregar]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    if (isReady) {
      carregar();
    }
  }, [carregar, isReady]);

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: MetaContextData = {
    metas,
    carregando,
    erro,
    carregar,
    salvar,
    atualizar,
    remover,
    refresh,
  };

  return (
    <MetaContext.Provider value={contextValue}>
      {children}
    </MetaContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useMeta(): MetaContextData {
  const context = useContext(MetaContext);
  if (context === undefined) {
    throw new Error('useMeta deve ser usado dentro de um MetaProvider');
  }
  return context;
}

export default MetaContext;
