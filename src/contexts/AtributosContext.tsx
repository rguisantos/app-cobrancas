/**
 * AtributosContext.tsx
 * Contexto para gerenciamento de estado de Atributos de Produto
 * (Tipos, Descrições e Tamanhos)
 * Integração: AtributosRepository + DatabaseContext
 *
 * Follows the operacoes/isOperacao pattern from ClienteContext/ManutencaoContext
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import atributosRepository, { AtributoItem } from '../repositories/AtributosRepository';
import { useDatabase } from './DatabaseContext';

// ============================================================================
// TIPOS
// ============================================================================

export type TipoAtributo = 'tipo' | 'descricao' | 'tamanho';

// ============================================================================
// INTERFACES
// ============================================================================

export interface AtributosState {
  tipos: AtributoItem[];
  descricoes: AtributoItem[];
  tamanhos: AtributoItem[];
  carregando: boolean;
  erro: string | null;
  /** Operation-specific loading flags */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface AtributosContextData extends AtributosState {
  // Carregamento
  carregar: () => Promise<void>;
  carregarTipos: () => Promise<void>;
  carregarDescricoes: () => Promise<void>;
  carregarTamanhos: () => Promise<void>;

  // CRUD — Tipos
  salvarTipo: (item: AtributoItem) => Promise<void>;
  adicionarTipo: (nome: string) => Promise<AtributoItem | null>;
  atualizarTipo: (id: string, nome: string) => Promise<boolean>;
  removerTipo: (id: string) => Promise<boolean>;

  // CRUD — Descrições
  salvarDescricao: (item: AtributoItem) => Promise<void>;
  adicionarDescricao: (nome: string) => Promise<AtributoItem | null>;
  atualizarDescricao: (id: string, nome: string) => Promise<boolean>;
  removerDescricao: (id: string) => Promise<boolean>;

  // CRUD — Tamanhos
  salvarTamanho: (item: AtributoItem) => Promise<void>;
  adicionarTamanho: (nome: string) => Promise<AtributoItem | null>;
  atualizarTamanho: (id: string, nome: string) => Promise<boolean>;
  removerTamanho: (id: string) => Promise<boolean>;

  // Verificações
  nomeExiste: (tipo: TipoAtributo, nome: string, excludeId?: string) => Promise<boolean>;

  // Refresh
  refresh: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const AtributosContext = createContext<AtributosContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface AtributosProviderProps {
  children: ReactNode;
}

export function AtributosProvider({ children }: AtributosProviderProps) {
  const { isReady } = useDatabase();

  const [tipos, setTipos] = useState<AtributoItem[]>([]);
  const [descricoes, setDescricoes] = useState<AtributoItem[]>([]);
  const [tamanhos, setTamanhos] = useState<AtributoItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Operation-specific loading
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregarTipos = useCallback(async () => {
    try {
      const lista = await atributosRepository.getTipos();
      setTipos(lista);
    } catch (error) {
      console.error('[AtributosContext] Erro ao carregar tipos:', error);
    }
  }, []);

  const carregarDescricoes = useCallback(async () => {
    try {
      const lista = await atributosRepository.getDescricoes();
      setDescricoes(lista);
    } catch (error) {
      console.error('[AtributosContext] Erro ao carregar descrições:', error);
    }
  }, []);

  const carregarTamanhos = useCallback(async () => {
    try {
      const lista = await atributosRepository.getTamanhos();
      setTamanhos(lista);
    } catch (error) {
      console.error('[AtributosContext] Erro ao carregar tamanhos:', error);
    }
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      await Promise.all([carregarTipos(), carregarDescricoes(), carregarTamanhos()]);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar atributos';
      setErro(mensagem);
      console.error('[AtributosContext] Erro ao carregar:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [carregarTipos, carregarDescricoes, carregarTamanhos, setOperacao]);

  // ==========================================================================
  // CRUD — TIPOS
  // ==========================================================================

  const salvarTipo = useCallback(async (item: AtributoItem) => {
    setOperacao('salvarTipo', true);
    try {
      await atributosRepository.salvarTipos([item]);
      await carregarTipos();
    } catch (error) {
      console.error('[AtributosContext] Erro ao salvar tipo:', error);
      throw error;
    } finally {
      setOperacao('salvarTipo', false);
    }
  }, [carregarTipos, setOperacao]);

  const adicionarTipo = useCallback(async (nome: string): Promise<AtributoItem | null> => {
    setOperacao('adicionarTipo', true);
    try {
      const item = await atributosRepository.adicionar('tipo', nome);
      await carregarTipos();
      return item;
    } catch (error) {
      console.error('[AtributosContext] Erro ao adicionar tipo:', error);
      return null;
    } finally {
      setOperacao('adicionarTipo', false);
    }
  }, [carregarTipos, setOperacao]);

  const atualizarTipo = useCallback(async (id: string, nome: string): Promise<boolean> => {
    setOperacao('atualizarTipo', true);
    try {
      const sucesso = await atributosRepository.atualizar('tipo', id, nome);
      if (sucesso) await carregarTipos();
      return sucesso;
    } catch (error) {
      console.error('[AtributosContext] Erro ao atualizar tipo:', error);
      return false;
    } finally {
      setOperacao('atualizarTipo', false);
    }
  }, [carregarTipos, setOperacao]);

  const removerTipo = useCallback(async (id: string): Promise<boolean> => {
    setOperacao('removerTipo', true);
    try {
      const sucesso = await atributosRepository.remover('tipo', id);
      if (sucesso) await carregarTipos();
      return sucesso;
    } catch (error) {
      console.error('[AtributosContext] Erro ao remover tipo:', error);
      return false;
    } finally {
      setOperacao('removerTipo', false);
    }
  }, [carregarTipos, setOperacao]);

  // ==========================================================================
  // CRUD — DESCRIÇÕES
  // ==========================================================================

  const salvarDescricao = useCallback(async (item: AtributoItem) => {
    setOperacao('salvarDescricao', true);
    try {
      await atributosRepository.salvarDescricoes([item]);
      await carregarDescricoes();
    } catch (error) {
      console.error('[AtributosContext] Erro ao salvar descrição:', error);
      throw error;
    } finally {
      setOperacao('salvarDescricao', false);
    }
  }, [carregarDescricoes, setOperacao]);

  const adicionarDescricao = useCallback(async (nome: string): Promise<AtributoItem | null> => {
    setOperacao('adicionarDescricao', true);
    try {
      const item = await atributosRepository.adicionar('descricao', nome);
      await carregarDescricoes();
      return item;
    } catch (error) {
      console.error('[AtributosContext] Erro ao adicionar descrição:', error);
      return null;
    } finally {
      setOperacao('adicionarDescricao', false);
    }
  }, [carregarDescricoes, setOperacao]);

  const atualizarDescricao = useCallback(async (id: string, nome: string): Promise<boolean> => {
    setOperacao('atualizarDescricao', true);
    try {
      const sucesso = await atributosRepository.atualizar('descricao', id, nome);
      if (sucesso) await carregarDescricoes();
      return sucesso;
    } catch (error) {
      console.error('[AtributosContext] Erro ao atualizar descrição:', error);
      return false;
    } finally {
      setOperacao('atualizarDescricao', false);
    }
  }, [carregarDescricoes, setOperacao]);

  const removerDescricao = useCallback(async (id: string): Promise<boolean> => {
    setOperacao('removerDescricao', true);
    try {
      const sucesso = await atributosRepository.remover('descricao', id);
      if (sucesso) await carregarDescricoes();
      return sucesso;
    } catch (error) {
      console.error('[AtributosContext] Erro ao remover descrição:', error);
      return false;
    } finally {
      setOperacao('removerDescricao', false);
    }
  }, [carregarDescricoes, setOperacao]);

  // ==========================================================================
  // CRUD — TAMANHOS
  // ==========================================================================

  const salvarTamanho = useCallback(async (item: AtributoItem) => {
    setOperacao('salvarTamanho', true);
    try {
      await atributosRepository.salvarTamanhos([item]);
      await carregarTamanhos();
    } catch (error) {
      console.error('[AtributosContext] Erro ao salvar tamanho:', error);
      throw error;
    } finally {
      setOperacao('salvarTamanho', false);
    }
  }, [carregarTamanhos, setOperacao]);

  const adicionarTamanho = useCallback(async (nome: string): Promise<AtributoItem | null> => {
    setOperacao('adicionarTamanho', true);
    try {
      const item = await atributosRepository.adicionar('tamanho', nome);
      await carregarTamanhos();
      return item;
    } catch (error) {
      console.error('[AtributosContext] Erro ao adicionar tamanho:', error);
      return null;
    } finally {
      setOperacao('adicionarTamanho', false);
    }
  }, [carregarTamanhos, setOperacao]);

  const atualizarTamanho = useCallback(async (id: string, nome: string): Promise<boolean> => {
    setOperacao('atualizarTamanho', true);
    try {
      const sucesso = await atributosRepository.atualizar('tamanho', id, nome);
      if (sucesso) await carregarTamanhos();
      return sucesso;
    } catch (error) {
      console.error('[AtributosContext] Erro ao atualizar tamanho:', error);
      return false;
    } finally {
      setOperacao('atualizarTamanho', false);
    }
  }, [carregarTamanhos, setOperacao]);

  const removerTamanho = useCallback(async (id: string): Promise<boolean> => {
    setOperacao('removerTamanho', true);
    try {
      const sucesso = await atributosRepository.remover('tamanho', id);
      if (sucesso) await carregarTamanhos();
      return sucesso;
    } catch (error) {
      console.error('[AtributosContext] Erro ao remover tamanho:', error);
      return false;
    } finally {
      setOperacao('removerTamanho', false);
    }
  }, [carregarTamanhos, setOperacao]);

  // ==========================================================================
  // VERIFICAÇÕES
  // ==========================================================================

  const nomeExiste = useCallback(async (tipo: TipoAtributo, nome: string, excludeId?: string): Promise<boolean> => {
    return atributosRepository.nomeExiste(tipo, nome, excludeId);
  }, []);

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

  const contextValue: AtributosContextData = {
    tipos,
    descricoes,
    tamanhos,
    carregando,
    erro,
    operacoes,
    isOperacao,

    carregar,
    carregarTipos,
    carregarDescricoes,
    carregarTamanhos,

    salvarTipo,
    adicionarTipo,
    atualizarTipo,
    removerTipo,

    salvarDescricao,
    adicionarDescricao,
    atualizarDescricao,
    removerDescricao,

    salvarTamanho,
    adicionarTamanho,
    atualizarTamanho,
    removerTamanho,

    nomeExiste,
    refresh,
  };

  return (
    <AtributosContext.Provider value={contextValue}>
      {children}
    </AtributosContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useAtributos(): AtributosContextData {
  const context = useContext(AtributosContext);

  if (context === undefined) {
    throw new Error('useAtributos deve ser usado dentro de um AtributosProvider');
  }

  return context;
}

export default AtributosContext;
