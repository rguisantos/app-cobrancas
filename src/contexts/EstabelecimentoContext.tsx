/**
 * EstabelecimentoContext.tsx
 * Contexto para gerenciamento de estado de Estabelecimentos
 * Integração: AtributosRepository (estabelecimentos) + DatabaseContext
 *
 * Follows the operacoes/isOperacao pattern from ClienteContext/ManutencaoContext
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Estabelecimento } from '../types';
import atributosRepository, { AtributoItem } from '../repositories/AtributosRepository';
import { useDatabase } from './DatabaseContext';

// ============================================================================
// INTERFACES
// ============================================================================

export interface EstabelecimentoState {
  estabelecimentos: AtributoItem[];
  estabelecimentoSelecionado: AtributoItem | null;
  carregando: boolean;
  erro: string | null;
  totalEstabelecimentos: number;
  /** Operation-specific loading flags */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface EstabelecimentoContextData extends EstabelecimentoState {
  // Carregamento
  carregar: () => Promise<void>;
  
  // Seleção
  selecionar: (id: string) => void;
  limparSelecao: () => void;
  
  // CRUD
  salvar: (dados: AtributoItem) => Promise<boolean>;
  adicionar: (nome: string, endereco?: string, observacao?: string) => Promise<AtributoItem | null>;
  atualizar: (id: string, nome: string, endereco?: string, observacao?: string) => Promise<boolean>;
  remover: (id: string) => Promise<boolean>;
  
  // Verificações
  nomeExiste: (nome: string, excludeId?: string) => Promise<boolean>;
  
  // Refresh
  refresh: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const EstabelecimentoContext = createContext<EstabelecimentoContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface EstabelecimentoProviderProps {
  children: ReactNode;
}

export function EstabelecimentoProvider({ children }: EstabelecimentoProviderProps) {
  const { isReady } = useDatabase();

  const [estabelecimentos, setEstabelecimentos] = useState<AtributoItem[]>([]);
  const [estabelecimentoSelecionado, setEstabelecimentoSelecionado] = useState<AtributoItem | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalEstabelecimentos, setTotalEstabelecimentos] = useState(0);

  // Operation-specific loading
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregar = useCallback(async () => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const lista = await atributosRepository.getEstabelecimentos();
      setEstabelecimentos(lista);
      setTotalEstabelecimentos(lista.length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar estabelecimentos';
      setErro(mensagem);
      console.error('[EstabelecimentoContext] Erro ao carregar:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  // ==========================================================================
  // SELEÇÃO
  // ==========================================================================

  const selecionar = useCallback((id: string) => {
    const item = estabelecimentos.find(e => e.id === id) || null;
    setEstabelecimentoSelecionado(item);
  }, [estabelecimentos]);

  const limparSelecao = useCallback(() => {
    setEstabelecimentoSelecionado(null);
  }, []);

  // ==========================================================================
  // CRUD
  // ==========================================================================

  const salvar = useCallback(async (dados: AtributoItem): Promise<boolean> => {
    setCarregando(true);
    setOperacao('salvar', true);
    setErro(null);

    try {
      await atributosRepository.salvarEstabelecimento(dados);
      await carregar();
      console.log('[EstabelecimentoContext] Estabelecimento salvo:', dados.id);
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao salvar estabelecimento';
      setErro(mensagem);
      console.error('[EstabelecimentoContext] Erro ao salvar:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('salvar', false);
    }
  }, [carregar, setOperacao]);

  const adicionar = useCallback(async (nome: string, endereco?: string, observacao?: string): Promise<AtributoItem | null> => {
    setCarregando(true);
    setOperacao('adicionar', true);
    setErro(null);

    try {
      const item = await atributosRepository.adicionarEstabelecimento(nome, endereco, observacao);
      await carregar();
      console.log('[EstabelecimentoContext] Estabelecimento adicionado:', item.id);
      return item;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao adicionar estabelecimento';
      setErro(mensagem);
      console.error('[EstabelecimentoContext] Erro ao adicionar:', error);
      return null;
    } finally {
      setCarregando(false);
      setOperacao('adicionar', false);
    }
  }, [carregar, setOperacao]);

  const atualizar = useCallback(async (id: string, nome: string, endereco?: string, observacao?: string): Promise<boolean> => {
    setCarregando(true);
    setOperacao('atualizar', true);
    setErro(null);

    try {
      const sucesso = await atributosRepository.atualizarEstabelecimento(id, nome, endereco, observacao);
      if (sucesso) {
        await carregar();
        console.log('[EstabelecimentoContext] Estabelecimento atualizado:', id);
      }
      return sucesso;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao atualizar estabelecimento';
      setErro(mensagem);
      console.error('[EstabelecimentoContext] Erro ao atualizar:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('atualizar', false);
    }
  }, [carregar, setOperacao]);

  const remover = useCallback(async (id: string): Promise<boolean> => {
    setCarregando(true);
    setOperacao('remover', true);
    setErro(null);

    try {
      const sucesso = await atributosRepository.remover('estabelecimento', id);
      if (sucesso) {
        await carregar();
        // Limpar seleção se o item removido estava selecionado
        if (estabelecimentoSelecionado?.id === id) {
          setEstabelecimentoSelecionado(null);
        }
        console.log('[EstabelecimentoContext] Estabelecimento removido:', id);
      }
      return sucesso;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao remover estabelecimento';
      setErro(mensagem);
      console.error('[EstabelecimentoContext] Erro ao remover:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('remover', false);
    }
  }, [carregar, estabelecimentoSelecionado, setOperacao]);

  // ==========================================================================
  // VERIFICAÇÕES
  // ==========================================================================

  const nomeExiste = useCallback(async (nome: string, excludeId?: string): Promise<boolean> => {
    return atributosRepository.nomeExiste('estabelecimento', nome, excludeId);
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

  const contextValue: EstabelecimentoContextData = {
    estabelecimentos,
    estabelecimentoSelecionado,
    carregando,
    erro,
    totalEstabelecimentos,
    operacoes,
    isOperacao,

    carregar,
    selecionar,
    limparSelecao,
    salvar,
    adicionar,
    atualizar,
    remover,
    nomeExiste,
    refresh,
  };

  return (
    <EstabelecimentoContext.Provider value={contextValue}>
      {children}
    </EstabelecimentoContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useEstabelecimento(): EstabelecimentoContextData {
  const context = useContext(EstabelecimentoContext);

  if (context === undefined) {
    throw new Error('useEstabelecimento deve ser usado dentro de um EstabelecimentoProvider');
  }

  return context;
}

export default EstabelecimentoContext;
