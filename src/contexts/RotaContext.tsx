/**
 * RotaContext.tsx
 * Contexto para gerenciamento de estado de Rotas
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
}

export interface RotaContextData extends RotaState {
  carregarRotas: (filters?: RotaFilters) => Promise<void>;
  selecionarRota: (id: string) => Promise<void>;
  limparSelecao: () => void;
  salvarRota: (dados: Partial<Rota>) => Promise<Rota | null>;
  excluirRota: (id: string) => Promise<boolean>;
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
  // TODO: Add operation-specific loading (operacoes / isOperacao) like ClienteContext/ProdutoContext
  const [erro, setErro] = useState<string | null>(null);

  const carregarRotas = useCallback(async (filters?: RotaFilters) => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = filters
        ? await rotaRepository.getFiltered(filters)
        : await rotaRepository.getAtivas();
      setRotas(lista);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar rotas');
    } finally {
      setCarregando(false);
    }
  }, []);

  const selecionarRota = useCallback(async (id: string) => {
    setCarregando(true);
    try {
      const rota = await rotaRepository.getById(id);
      setRotaSelecionada(rota);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar rota');
    } finally {
      setCarregando(false);
    }
  }, []);

  const limparSelecao = useCallback(() => {
    setRotaSelecionada(null);
  }, []);

  const salvarRota = useCallback(async (dados: Partial<Rota>): Promise<Rota | null> => {
    if (!isAdmin()) {
      setErro('Apenas administradores podem gerenciar rotas');
      return null;
    }
    setCarregando(true);
    try {
      let rota: Rota | null;

      if (dados.id) {
        // Atualizar rota existente
        rota = await rotaRepository.update(dados as Partial<Rota> & { id: string });
      } else {
        // Criar nova rota — valores default para novos campos
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
    }
  }, [carregarRotas, isAdmin]);

  const excluirRota = useCallback(async (id: string): Promise<boolean> => {
    if (!isAdmin()) {
      setErro('Apenas administradores podem excluir rotas');
      return false;
    }
    try {
      const ok = await rotaRepository.delete(id);
      if (ok) {
        await carregarRotas();
        // Limpar seleção se a rota excluída estava selecionada
        if (rotaSelecionada && String(rotaSelecionada.id) === String(id)) {
          setRotaSelecionada(null);
        }
      }
      return ok;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao excluir rota';
      setErro(msg);
      return false;
    }
  }, [carregarRotas, isAdmin, rotaSelecionada]);

  const refresh = useCallback(async () => {
    await carregarRotas();
  }, [carregarRotas]);

  useEffect(() => {
    if (isReady) {
      carregarRotas();
    }
  }, [carregarRotas, isReady]);

  const contextValue: RotaContextData = {
    rotas,
    rotaSelecionada,
    carregando,
    erro,
    carregarRotas,
    selecionarRota,
    limparSelecao,
    salvarRota,
    excluirRota,
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
