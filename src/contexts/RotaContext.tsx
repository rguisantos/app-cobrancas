/**
 * RotaContext.tsx
 * Contexto para gerenciamento de estado de Rotas
 *
 * Enhanced with operacoes/isOperacao pattern like ClienteContext/ManutencaoContext
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Rota } from '../types';
import { rotaRepository, RotaFilters } from '../repositories/RotaRepository';
import { useDatabase } from './DatabaseContext';
import { useAuth } from './AuthContext';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RotaState {
  rotas: Rota[];
  rotaSelecionada: Rota | null;
  carregando: boolean;
  erro: string | null;
  totalRotas: number;
  /** Operation-specific loading flags */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface RotaContextData extends RotaState {
  carregarRotas: (filters?: RotaFilters) => Promise<void>;
  selecionarRota: (id: string) => Promise<void>;
  limparSelecao: () => void;
  salvarRota: (dados: Partial<Rota>) => Promise<Rota | null>;
  excluirRota: (id: string) => Promise<boolean>;
  getAtivas: () => Rota[];
  count: () => Promise<number>;
  refresh: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const RotaContext = createContext<RotaContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface RotaProviderProps {
  children: React.ReactNode;
}

export function RotaProvider({ children }: RotaProviderProps) {
  const { isAdmin } = useAuth();
  const { isReady } = useDatabase();
  
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalRotas, setTotalRotas] = useState(0);

  // Operation-specific loading
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregarRotas = useCallback(async (filters?: RotaFilters) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);
    try {
      const lista = filters
        ? await rotaRepository.getFiltered(filters)
        : await rotaRepository.getAtivas();
      setRotas(lista);
      setTotalRotas(lista.length);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar rotas');
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  // ==========================================================================
  // SELEÇÃO
  // ==========================================================================

  const selecionarRota = useCallback(async (id: string) => {
    setCarregando(true);
    setOperacao('selecionar', true);
    try {
      const rota = await rotaRepository.getById(id);
      setRotaSelecionada(rota);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar rota');
    } finally {
      setCarregando(false);
      setOperacao('selecionar', false);
    }
  }, [setOperacao]);

  const limparSelecao = useCallback(() => {
    setRotaSelecionada(null);
  }, []);

  // ==========================================================================
  // AÇÕES DE NEGÓCIO
  // ==========================================================================

  const salvarRota = useCallback(async (dados: Partial<Rota>): Promise<Rota | null> => {
    if (!isAdmin()) {
      setErro('Apenas administradores podem gerenciar rotas');
      return null;
    }
    setCarregando(true);
    setOperacao('salvar', true);
    try {
      let rota: Rota | null;

      if (dados.id) {
        rota = await rotaRepository.update(dados as Partial<Rota> & { id: string });
      } else {
        rota = await rotaRepository.save({
          ...dados,
          cor: dados.cor || '#2563EB',
          ordem: dados.ordem ?? 0,
        });
      }

      await carregarRotas();
      return rota;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar rota';
      setErro(msg);
      return null;
    } finally {
      setCarregando(false);
      setOperacao('salvar', false);
    }
  }, [carregarRotas, isAdmin, setOperacao]);

  const excluirRota = useCallback(async (id: string): Promise<boolean> => {
    if (!isAdmin()) {
      setErro('Apenas administradores podem excluir rotas');
      return false;
    }
    setCarregando(true);
    setOperacao('excluir', true);
    try {
      const ok = await rotaRepository.delete(id);
      if (ok) {
        await carregarRotas();
        if (rotaSelecionada && String(rotaSelecionada.id) === String(id)) {
          setRotaSelecionada(null);
        }
      }
      return ok;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao excluir rota';
      setErro(msg);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('excluir', false);
    }
  }, [carregarRotas, isAdmin, rotaSelecionada, setOperacao]);

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  const getAtivas = useCallback((): Rota[] => {
    return rotas.filter(r => r.status === 'Ativo');
  }, [rotas]);

  const count = useCallback(async (): Promise<number> => {
    return rotaRepository.count();
  }, []);

  const refresh = useCallback(async () => {
    await carregarRotas();
  }, [carregarRotas]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    if (isReady) {
      carregarRotas();
    }
  }, [carregarRotas, isReady]);

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: RotaContextData = {
    rotas,
    rotaSelecionada,
    carregando,
    erro,
    totalRotas,
    operacoes,
    isOperacao,
    carregarRotas,
    selecionarRota,
    limparSelecao,
    salvarRota,
    excluirRota,
    getAtivas,
    count,
    refresh,
  };

  return <RotaContext.Provider value={contextValue}>{children}</RotaContext.Provider>;
}

export function useRota(): RotaContextData {
  const context = useContext(RotaContext);
  if (context === undefined) {
    throw new Error('useRota deve ser usado dentro de um RotaProvider');
  }
  return context;
}

export default RotaContext;
