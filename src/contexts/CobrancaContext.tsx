/**
 * CobrancaContext.tsx
 * Contexto para gerenciamento de estado de Cobranças
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { HistoricoCobranca, CobrancaFilters } from '../types';
import { cobrancaRepository } from '../repositories/CobrancaRepository';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CobrancaState {
  cobrancas: HistoricoCobranca[];
  cobrancaSelecionada: HistoricoCobranca | null;
  carregando: boolean;
  erro: string | null;
  totalCobrancas: number;
  totalPendentes: number;
}

export interface CobrancaContextData extends CobrancaState {
  carregarCobrancas: (filtros?: CobrancaFilters) => Promise<void>;
  carregarCobranca: (id: string) => Promise<void>;
  selecionarCobranca: (id: string) => Promise<void>;
  limparSelecao: () => void;
  registrarCobranca: (dados: any) => Promise<HistoricoCobranca | null>;
  atualizarCobranca: (dados: Partial<HistoricoCobranca> & { id: string }) => Promise<boolean>;
  refresh: () => Promise<void>;
  // Propriedades adicionais para compatibilidade
  cobrancasPendentes: HistoricoCobranca[];
  fetchCobracas: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const CobrancaContext = createContext<CobrancaContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface CobrancaProviderProps {
  children: React.ReactNode;
}

export function CobrancaProvider({ children }: CobrancaProviderProps) {
  const [cobrancas, setCobrancas] = useState<HistoricoCobranca[]>([]);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<HistoricoCobranca | null>(null);
  const [carregando, setCarregando] = useState(false);  const [erro, setErro] = useState<string | null>(null);
  const [totalCobrancas, setTotalCobrancas] = useState(0);
  const [totalPendentes, setTotalPendentes] = useState(0);

  const carregarCobrancas = useCallback(async (filtros?: CobrancaFilters) => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await cobrancaRepository.getAll(filtros);
      setCobrancas(lista);
      setTotalCobrancas(lista.length);
      setTotalPendentes(lista.filter(c => c.status === 'Pendente').length);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar cobranças');
    } finally {
      setCarregando(false);
  
  }
  }, []);

  const carregarCobranca = useCallback(async (id: string) => {
    setCarregando(true);
    try {
      const cobranca = await cobrancaRepository.getById(id);
      setCobrancaSelecionada(cobranca);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar cobrança');
    } finally {
      setCarregando(false);
  
  }
  }, []);

  const selecionarCobranca = useCallback(async (id: string) => {
    setCarregando(true);
    try {
      const cobranca = await cobrancaRepository.getById(id);
      setCobrancaSelecionada(cobranca);
    } catch (error) {
      console.error('[CobrancaContext] Erro ao selecionar cobrança:', error);
    } finally {
      setCarregando(false);
  
  }
  }, []);

  const limparSelecao = useCallback(() => {
    setCobrancaSelecionada(null);
  }, []);

  const registrarCobranca = useCallback(async (dados: any): Promise<HistoricoCobranca | null> => {
    setCarregando(true);
    try {      const cobranca = await cobrancaRepository.registrarCobranca(dados);
      await carregarCobrancas();
      return cobranca;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao registrar cobrança');
      return null;
    } finally {
      setCarregando(false);
  
  }
  }, [carregarCobrancas]);

  const atualizarCobranca = useCallback(async (dados: Partial<HistoricoCobranca> & { id: string }): Promise<boolean> => {
    setCarregando(true);
    try {
      const cobranca = await cobrancaRepository.update(dados);
      if (cobranca) {
        await carregarCobrancas();
        return true;
    
  }
      return false;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar cobrança');
      return false;
    } finally {
      setCarregando(false);
  
  }
  }, [carregarCobrancas]);

  const refresh = useCallback(async () => {
    await carregarCobrancas();
  }, [carregarCobrancas]);

  useEffect(() => {
    carregarCobrancas();
  }, [carregarCobrancas]);

  const contextValue: CobrancaContextData = {
    cobrancas,
    cobrancaSelecionada,
    carregando,
    erro,
    totalCobrancas,
    totalPendentes,
    carregarCobrancas,
    carregarCobranca,
    selecionarCobranca,
    limparSelecao,
    registrarCobranca,
    atualizarCobranca,
    refresh,
    // Propriedades adicionais para compatibilidade
    cobrancasPendentes: cobrancas.filter(c => c.status === 'Pendente'),
    fetchCobracas: carregarCobrancas,
  };

  return <CobrancaContext.Provider value={contextValue}>{children}</CobrancaContext.Provider>;
}

export function useCobranca(): CobrancaContextData {
  const context = useContext(CobrancaContext);
  if (context === undefined) {
    throw new Error('useCobranca deve ser usado dentro de um CobrancaProvider');

  }
  return context;
}

export default CobrancaContext;