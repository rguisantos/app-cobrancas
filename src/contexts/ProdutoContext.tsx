/**
 * ProdutoContext.tsx
 * Contexto para gerenciamento de estado de Produtos
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Produto, ProdutoListItem, ProdutoFilters } from '../types';
import { produtoRepository } from '../repositories/ProdutoRepository';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProdutoState {
  produtos: ProdutoListItem[];
  produtoSelecionado: Produto | null;
  carregando: boolean;
  erro: string | null;
  totalProdutos: number;
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
  const [produtos, setProdutos] = useState<ProdutoListItem[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalProdutos, setTotalProdutos] = useState(0);

  const carregarProdutos = useCallback(async (filtros?: ProdutoFilters) => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await produtoRepository.getAll(filtros);
      setProdutos(lista);
      setTotalProdutos(lista.length);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar produtos');
    } finally {
      setCarregando(false);
  
  }
  }, []);

  const carregarProduto = useCallback(async (id: string) => {
    setCarregando(true);
    try {
      const produto = await produtoRepository.getById(id);
      setProdutoSelecionado(produto);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar produto');
    } finally {
      setCarregando(false);
  
  }
  }, []);

  const selecionarProduto = useCallback(async (id: string) => {
    setCarregando(true);
    try {
      const produto = await produtoRepository.getByIdWithLocacao(id);
      setProdutoSelecionado(produto);
    } catch (error) {
      console.error('[ProdutoContext] Erro ao selecionar produto:', error);
    } finally {
      setCarregando(false);
  
  }
  }, []);

  const limparSelecao = useCallback(() => {
    setProdutoSelecionado(null);
  }, []);

  const salvarProduto = useCallback(async (dados: Partial<Produto>): Promise<Produto | null> => {
    setCarregando(true);
    try {
      const produto = await produtoRepository.save(dados as any);      await carregarProdutos();
      return produto;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar produto');
      return null;
    } finally {
      setCarregando(false);
  
  }
  }, [carregarProdutos]);

  const atualizarProduto = useCallback(async (dados: Partial<Produto> & { id: string }): Promise<boolean> => {
    setCarregando(true);
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
  
  }
  }, [carregarProdutos]);

  const excluirProduto = useCallback(async (id: string): Promise<boolean> => {
    setCarregando(true);
    try {
      const sucesso = await produtoRepository.delete(id);
      if (sucesso) await carregarProdutos();
      return sucesso;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao excluir produto');
      return false;
    } finally {
      setCarregando(false);
  
  }
  }, [carregarProdutos]);

  const buscarProduto = useCallback(async (termo: string): Promise<ProdutoListItem[]> => {
    try {
      return await produtoRepository.search(termo);
    } catch (error) {
      return [];
  
  }
  }, []);

  const refresh = useCallback(async () => {    await carregarProdutos();
  }, [carregarProdutos]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  const contextValue: ProdutoContextData = {
    produtos,
    produtoSelecionado,
    carregando,
    erro,
    totalProdutos,
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