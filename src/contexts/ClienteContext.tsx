/**
 * ClienteContext.tsx
 * Contexto para gerenciamento de estado de Clientes
 * Integração: Repositórios + Types + DatabaseContext
 * 
 * Operação-specific loading: Each async operation tracks its own loading state
 * via `operacoes`, while `carregando` remains as a general "any operation active" flag.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Cliente, ClienteListItem, ClienteFilters } from '../types';
import { clienteRepository } from '../repositories/ClienteRepository';
import { useDatabase } from './DatabaseContext';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ClienteState {
  clientes: ClienteListItem[];
  clienteSelecionado: Cliente | null;
  carregando: boolean;
  erro: string | null;
  totalClientes: number;
  /** Operation-specific loading flags (e.g., { carregar: true, salvar: false }) */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface ClienteContextData extends ClienteState {
  // Carregamento
  carregarClientes: (filtros?: ClienteFilters) => Promise<void>;
  carregarCliente: (id: string) => Promise<void>;
  
  // Seleção
  selecionarCliente: (id: string) => Promise<void>;
  limparSelecao: () => void;
  
  // Ações de Negócio
  salvarCliente: (dados: Partial<Cliente>) => Promise<Cliente | null>;
  atualizarCliente: (dados: Partial<Cliente> & { id: string }) => Promise<boolean>;
  excluirCliente: (id: string) => Promise<boolean>;
  
  // Busca
  buscarCliente: (termo: string) => Promise<ClienteListItem[]>;
  
  // Refresh
  refresh: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const ClienteContext = createContext<ClienteContextData | undefined>(undefined);

// ============================================================================// PROVIDER
// ============================================================================

interface ClienteProviderProps {
  children: ReactNode;
}

export function ClienteProvider({ children }: ClienteProviderProps) {
  // Verificar se o banco está pronto
  const { isReady } = useDatabase();
  
  // Estado
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalClientes, setTotalClientes] = useState(0);

  // Operation-specific loading — allows tracking individual operations
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregarClientes = useCallback(async (filtros?: ClienteFilters) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const lista = await clienteRepository.getAll(filtros);
      setClientes(lista);
      setTotalClientes(lista.length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar clientes';
      setErro(mensagem);
      console.error('[ClienteContext] Erro ao carregar clientes:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  const carregarCliente = useCallback(async (id: string) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const cliente = await clienteRepository.getById(id);
      if (cliente) {
        setClienteSelecionado(cliente);
      } else {
        setErro('Cliente não encontrado');
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar cliente';
      setErro(mensagem);
      console.error('[ClienteContext] Erro ao carregar cliente:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  // ==========================================================================
  // SELEÇÃO
  // ==========================================================================

  const selecionarCliente = useCallback(async (id: string) => {
    setCarregando(true);
    setOperacao('selecionar', true);
    try {
      const cliente = await clienteRepository.getByIdWithLocacoes(id);
      setClienteSelecionado(cliente);
    } catch (error) {
      console.error('[ClienteContext] Erro ao selecionar cliente:', error);
    } finally {
      setCarregando(false);
      setOperacao('selecionar', false);
    }
  }, [setOperacao]);

  const limparSelecao = useCallback(() => {
    setClienteSelecionado(null);
  }, []);

  // ==========================================================================
  // AÇÕES DE NEGÓCIO
  // ==========================================================================

  const salvarCliente = useCallback(async (dados: Partial<Cliente>): Promise<Cliente | null> => {
    setCarregando(true);
    setOperacao('salvar', true);
    setErro(null);

    try {
      const cliente = await clienteRepository.save(dados as any);
      await carregarClientes();
      console.log('[ClienteContext] Cliente salvo:', cliente?.id);
      return cliente;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao salvar cliente';
      setErro(mensagem);
      console.error('[ClienteContext] Erro ao salvar cliente:', error);
      return null;
    } finally {
      setCarregando(false);
      setOperacao('salvar', false);
    }
  }, [carregarClientes, setOperacao]);

  const atualizarCliente = useCallback(async (dados: Partial<Cliente> & { id: string }): Promise<boolean> => {
    setCarregando(true);
    setOperacao('atualizar', true);
    setErro(null);

    try {
      const cliente = await clienteRepository.update(dados);
      if (cliente) {
        await carregarClientes();
        console.log('[ClienteContext] Cliente atualizado:', dados.id);
        return true;
      }
      return false;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao atualizar cliente';
      setErro(mensagem);
      console.error('[ClienteContext] Erro ao atualizar cliente:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('atualizar', false);
    }
  }, [carregarClientes, setOperacao]);

  const excluirCliente = useCallback(async (id: string): Promise<boolean> => {
    setCarregando(true);
    setOperacao('excluir', true);
    setErro(null);

    try {
      const sucesso = await clienteRepository.delete(id);
      if (sucesso) {
        await carregarClientes();
        console.log('[ClienteContext] Cliente excluído:', id);
        return true;
      }
      return false;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao excluir cliente';
      setErro(mensagem);
      console.error('[ClienteContext] Erro ao excluir cliente:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('excluir', false);
    }
  }, [carregarClientes, setOperacao]);

  // ==========================================================================
  // BUSCA
  // ==========================================================================

  const buscarCliente = useCallback(async (termo: string): Promise<ClienteListItem[]> => {
    try {
      return await clienteRepository.search(termo);
    } catch (error) {
      console.error('[ClienteContext] Erro ao buscar cliente:', error);
      return [];
    }
  }, []);

  // ==========================================================================
  // REFRESH
  // ==========================================================================

  const refresh = useCallback(async () => {
    await carregarClientes();
  }, [carregarClientes]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    // Só carregar dados quando o banco estiver pronto
    if (isReady) {
      carregarClientes();
    }
  }, [carregarClientes, isReady]);

  // ==========================================================================
  // ESTADO DO CONTEXT
  // ==========================================================================

  const contextValue: ClienteContextData = {
    // Estado
    clientes,
    clienteSelecionado,
    carregando,
    erro,
    totalClientes,
    operacoes,
    isOperacao,

    // Carregamento
    carregarClientes,
    carregarCliente,

    // Seleção
    selecionarCliente,
    limparSelecao,

    // Ações de Negócio
    salvarCliente,
    atualizarCliente,
    excluirCliente,

    // Busca
    buscarCliente,
    // Refresh
    refresh,
  };

  return (
    <ClienteContext.Provider value={contextValue}>
      {children}
    </ClienteContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useCliente(): ClienteContextData {
  const context = useContext(ClienteContext);

  if (context === undefined) {
    throw new Error('useCliente deve ser usado dentro de um ClienteProvider');
  }

  return context;
}

// ============================================================================
// EXPORTAÇÃO PADRÃO
// ============================================================================

export default ClienteContext;
