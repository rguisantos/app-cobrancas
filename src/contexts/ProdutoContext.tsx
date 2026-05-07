/**
 * ProdutoContext.tsx
 * Contexto para gerenciamento de estado de Produtos
 * 
 * Operação-specific loading: Each async operation tracks its own loading state
 * via `operacoes`, while `carregando` remains as a general "any operation active" flag.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Produto, ProdutoListItem, ProdutoFilters } from '../types';
import { produtoRepository } from '../repositories/ProdutoRepository';
import { useDatabase } from './DatabaseContext';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProdutoState {
  produtos: ProdutoListItem[];
  produtoSelecionado: Produto | null;
  carregando: boolean;
  erro: string | null;
  totalProdutos: number;
  /** Operation-specific loading flags (e.g., { carregar: true, salvar: false }) */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface ProdutoContextData extends ProdutoState {
  carregarProdutos: (filtros?: ProdutoFilters) => Promise<void>;
  carregarProduto: (id: string) => Promise<void>;
  selecionarProduto: (id: string) => Promise<void>;
  limparSelecao: () => void;
  salvarProduto: (dados: Partial<Produto>) => Promise<Produto | null>;
  atualizarProduto: (dados: Partial<Produto> & { id: string }) => Promise<boolean>;
  excluirProduto: (id: string) => Promise<boolean>;
  buscarProduto: (termo: string) => Promise<ProdutoListItem[]>;
  refresh: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const ProdutoContext = createContext<ProdutoContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface ProdutoProviderProps {
  children: React.ReactNode;
}

export function ProdutoProvider({ children }: ProdutoProviderProps) {
  // Verificar se o banco está pronto
  const { isReady } = useDatabase();
  
  const [produtos, setProdutos] = useState<ProdutoListItem[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalProdutos, setTotalProdutos] = useState(0);

  // Operation-specific loading — allows tracking individual operations
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  const carregarProdutos = useCallback(async (filtros?: ProdutoFilters) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);
    try {
      const lista = await produtoRepository.getAll(filtros);
      setProdutos(lista);
      setTotalProdutos(lista.length);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar produtos');
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  const carregarProduto = useCallback(async (id: string) => {
    setCarregando(true);
    setOperacao('carregar', true);
    try {
      const produto = await produtoRepository.getById(id);
      setProdutoSelecionado(produto);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar produto');
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  const selecionarProduto = useCallback(async (id: string) => {
    setCarregando(true);
    setOperacao('selecionar', true);
    try {
      const produto = await produtoRepository.getByIdWithLocacao(id);
      setProdutoSelecionado(produto);
    } catch (error) {
      console.error('[ProdutoContext] Erro ao selecionar produto:', error);
    } finally {
      setCarregando(false);
      setOperacao('selecionar', false);
    }
  }, [setOperacao]);

  const limparSelecao = useCallback(() => {
    setProdutoSelecionado(null);
  }, []);

  const salvarProduto = useCallback(async (dados: Partial<Produto>): Promise<Produto | null> => {
    setCarregando(true);
    setOperacao('salvar', true);
    try {
      const produto = await produtoRepository.save(dados as any);
      await carregarProdutos();
      return produto;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar produto');
      return null;
    } finally {
      setCarregando(false);
      setOperacao('salvar', false);
    }
  }, [carregarProdutos, setOperacao]);

  const atualizarProduto = useCallback(async (dados: Partial<Produto> & { id: string }): Promise<boolean> => {
    setCarregando(true);
    setOperacao('atualizar', true);
    try {
      const produto = await produtoRepository.update(dados);
      if (produto) {
        await carregarProdutos();
        return true;
      }
      return false;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar produto');
      return false;
    } finally {
      setCarregando(false);
      setOperacao('atualizar', false);
    }
  }, [carregarProdutos, setOperacao]);

  const excluirProduto = useCallback(async (id: string): Promise<boolean> => {
    setCarregando(true);
    setOperacao('excluir', true);
    try {
      const sucesso = await produtoRepository.delete(id);
      if (sucesso) await carregarProdutos();
      return sucesso;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao excluir produto');
      return false;
    } finally {
      setCarregando(false);
      setOperacao('excluir', false);
    }
  }, [carregarProdutos, setOperacao]);

  const buscarProduto = useCallback(async (termo: string): Promise<ProdutoListItem[]> => {
    try {
      return await produtoRepository.search(termo);
    } catch (error) {
      return [];
    }
  }, []);

  const refresh = useCallback(async () => {
    await carregarProdutos();
  }, [carregarProdutos]);

  useEffect(() => {
    // Só carregar dados quando o banco estiver pronto
    if (isReady) {
      carregarProdutos();
    }
  }, [carregarProdutos, isReady]);

  const contextValue: ProdutoContextData = {
    produtos,
    produtoSelecionado,
    carregando,
    erro,
    totalProdutos,
    operacoes,
    isOperacao,
    carregarProdutos,
    carregarProduto,
    selecionarProduto,
    limparSelecao,
    salvarProduto,
    atualizarProduto,
    excluirProduto,
    buscarProduto,
    refresh,
  };

  return <ProdutoContext.Provider value={contextValue}>{children}</ProdutoContext.Provider>;
}

export function useProduto(): ProdutoContextData {
  const context = useContext(ProdutoContext);
  if (context === undefined) {
    throw new Error('useProduto deve ser usado dentro de um ProdutoProvider');
  }
  return context;
}

export default ProdutoContext;
