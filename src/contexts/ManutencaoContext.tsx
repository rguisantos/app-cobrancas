/**
 * ManutencaoContext.tsx
 * Contexto para gerenciamento de estado de Manutenções
 * Integração: ManutencaoRepository + Types + DatabaseContext
 *
 * Operação-specific loading: Each async operation tracks its own loading state
 * via `operacoes`, while `carregando` remains as a general "any operation active" flag.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Manutencao, ManutencaoFilters } from '../types';
import { manutencaoRepository, ManutencaoFilters as RepoFilters } from '../repositories/ManutencaoRepository';
import { useDatabase } from './DatabaseContext';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ManutencaoFiltersLocal {
  tipo?: 'trocaPano' | 'manutencao';
  produtoId?: string;
  clienteId?: string;
  termoBusca?: string;
}

export interface ManutencaoState {
  manutencoes: Manutencao[];
  carregando: boolean;
  erro: string | null;
  totalManutencoes: number;
  /** Operation-specific loading flags (e.g., { carregar: true, registrar: false }) */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface ManutencaoContextData extends ManutencaoState {
  // Carregamento
  carregar: (filtros?: ManutencaoFiltersLocal) => Promise<void>;

  // Ações de Negócio
  registrar: (dados: Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'>) => Promise<Manutencao | null>;
  atualizar: (id: string, data: Partial<Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'>>) => Promise<Manutencao | null>;
  remover: (id: string) => Promise<boolean>;

  // Filtros in-memory
  filtrar: (filters: ManutencaoFiltersLocal) => Manutencao[];

  // Refresh
  refresh: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const ManutencaoContext = createContext<ManutencaoContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface ManutencaoProviderProps {
  children: ReactNode;
}

export function ManutencaoProvider({ children }: ManutencaoProviderProps) {
  // Verificar se o banco está pronto
  const { isReady } = useDatabase();

  // Estado
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalManutencoes, setTotalManutencoes] = useState(0);

  // Operation-specific loading — allows tracking individual operations
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregar = useCallback(async (filtros?: ManutencaoFiltersLocal) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const repoFiltros: RepoFilters = {};
      if (filtros?.tipo) repoFiltros.tipo = filtros.tipo;
      if (filtros?.produtoId) repoFiltros.produtoId = filtros.produtoId;

      const lista = await manutencaoRepository.getAll(repoFiltros);
      setManutencoes(lista);
      setTotalManutencoes(lista.length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar manutenções';
      setErro(mensagem);
      console.error('[ManutencaoContext] Erro ao carregar manutenções:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  // ==========================================================================
  // AÇÕES DE NEGÓCIO
  // ==========================================================================

  const registrar = useCallback(async (
    dados: Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'>
  ): Promise<Manutencao | null> => {
    setCarregando(true);
    setOperacao('registrar', true);
    setErro(null);

    try {
      const registro = await manutencaoRepository.registrar(dados);
      await carregar();
      console.log('[ManutencaoContext] Manutenção registrada:', registro.id);
      return registro;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao registrar manutenção';
      setErro(mensagem);
      console.error('[ManutencaoContext] Erro ao registrar manutenção:', error);
      return null;
    } finally {
      setCarregando(false);
      setOperacao('registrar', false);
    }
  }, [carregar, setOperacao]);

  const atualizar = useCallback(async (
    id: string,
    data: Partial<Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'>>
  ): Promise<Manutencao | null> => {
    setCarregando(true);
    setOperacao('atualizar', true);
    setErro(null);

    try {
      const resultado = await manutencaoRepository.update(id, data);
      await carregar();
      console.log('[ManutencaoContext] Manutenção atualizada:', id);
      return resultado;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao atualizar manutenção';
      setErro(mensagem);
      console.error('[ManutencaoContext] Erro ao atualizar manutenção:', error);
      return null;
    } finally {
      setCarregando(false);
      setOperacao('atualizar', false);
    }
  }, [carregar, setOperacao]);

  const remover = useCallback(async (
    id: string
  ): Promise<boolean> => {
    setCarregando(true);
    setOperacao('remover', true);
    setErro(null);

    try {
      const sucesso = await manutencaoRepository.delete(id);
      await carregar();
      console.log('[ManutencaoContext] Manutenção removida:', id);
      return sucesso;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao remover manutenção';
      setErro(mensagem);
      console.error('[ManutencaoContext] Erro ao remover manutenção:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('remover', false);
    }
  }, [carregar, setOperacao]);

  // ==========================================================================
  // FILTROS IN-MEMORY
  // ==========================================================================

  const filtrar = useCallback((filters: ManutencaoFiltersLocal): Manutencao[] => {
    let resultado = [...manutencoes];

    if (filters.tipo) {
      resultado = resultado.filter(m => m.tipo === filters.tipo);
    }

    if (filters.produtoId) {
      resultado = resultado.filter(m => m.produtoId === filters.produtoId);
    }

    if (filters.clienteId) {
      resultado = resultado.filter(m => m.clienteId === filters.clienteId);
    }

    if (filters.termoBusca) {
      const termo = filters.termoBusca.toLowerCase();
      resultado = resultado.filter(m =>
        (m.produtoIdentificador && m.produtoIdentificador.toLowerCase().includes(termo)) ||
        (m.clienteNome && m.clienteNome.toLowerCase().includes(termo)) ||
        (m.descricao && m.descricao.toLowerCase().includes(termo))
      );
    }

    return resultado;
  }, [manutencoes]);

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
    // Só carregar dados quando o banco estiver pronto
    if (isReady) {
      carregar();
    }
  }, [carregar, isReady]);

  // ==========================================================================
  // ESTADO DO CONTEXT
  // ==========================================================================

  const contextValue: ManutencaoContextData = {
    // Estado
    manutencoes,
    carregando,
    erro,
    totalManutencoes,
    operacoes,
    isOperacao,

    // Carregamento
    carregar,

    // Ações de Negócio
    registrar,
    atualizar,
    remover,

    // Filtros
    filtrar,

    // Refresh
    refresh,
  };

  return (
    <ManutencaoContext.Provider value={contextValue}>
      {children}
    </ManutencaoContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useManutencao(): ManutencaoContextData {
  const context = useContext(ManutencaoContext);

  if (context === undefined) {
    throw new Error('useManutencao deve ser usado dentro de um ManutencaoProvider');
  }

  return context;
}

// ============================================================================
// EXPORTAÇÃO PADRÃO
// ============================================================================

export default ManutencaoContext;
