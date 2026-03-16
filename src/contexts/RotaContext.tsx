/**
 * RotaContext.tsx
 * Contexto para gerenciamento de estado de Rotas
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Rota } from '../types';
import { rotaRepository } from '../repositories/RotaRepository';
import { useDatabase } from './DatabaseContext';

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
  carregarRotas: () => Promise<void>;
  selecionarRota: (id: string | number) => Promise<void>;
  limparSelecao: () => void;
  salvarRota: (dados: Partial<Rota>) => Promise<Rota | null>;
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
  // Verificar se o banco está pronto
  const { isReady } = useDatabase();
  
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarRotas = useCallback(async () => {
    setCarregando(true);    setErro(null);
    try {
      const lista = await rotaRepository.getAtivas();
      setRotas(lista);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar rotas');
    } finally {
      setCarregando(false);
  
  }
  }, []);

  const selecionarRota = useCallback(async (id: string | number) => {
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
    setCarregando(true);
    try {
      const rota = await rotaRepository.save(dados as Rota);
      await carregarRotas();
      return rota;
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar rota');
      return null;
    } finally {
      setCarregando(false);
  
  }
  }, [carregarRotas]);

  const refresh = useCallback(async () => {
    await carregarRotas();
  }, [carregarRotas]);

  useEffect(() => {
    // Só carregar dados quando o banco estiver pronto
    if (isReady) {
      carregarRotas();
    }
  }, [carregarRotas, isReady]);

  const contextValue: RotaContextData = {    rotas,
    rotaSelecionada,
    carregando,
    erro,
    carregarRotas,
    selecionarRota,
    limparSelecao,
    salvarRota,
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