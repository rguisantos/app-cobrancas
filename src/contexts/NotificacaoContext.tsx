/**
 * NotificacaoContext.tsx
 * Contexto para gerenciamento de estado de Notificações
 * Integração: ApiService (notification endpoints) + local state
 *
 * Follows the operacoes/isOperacao pattern from ClienteContext/ManutencaoContext
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { apiService } from '../services/ApiService';

// ============================================================================
// TIPOS
// ============================================================================

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: string;
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface NotificacaoState {
  notificacoes: Notificacao[];
  unreadCount: number;
  carregando: boolean;
  erro: string | null;
  totalNotificacoes: number;
  /** Operation-specific loading flags */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface NotificacaoContextData extends NotificacaoState {
  // Carregamento
  carregar: () => Promise<void>;
  
  // Ações
  marcarComoLida: (id: string) => Promise<boolean>;
  marcarTodasComoLidas: () => Promise<boolean>;
  
  // Refresh
  refresh: () => Promise<void>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const NotificacaoContext = createContext<NotificacaoContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface NotificacaoProviderProps {
  children: ReactNode;
}

export function NotificacaoProvider({ children }: NotificacaoProviderProps) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalNotificacoes, setTotalNotificacoes] = useState(0);

  // Operation-specific loading
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const updateCounts = useCallback((items: Notificacao[]) => {
    setTotalNotificacoes(items.length);
    setUnreadCount(items.filter(n => !n.lida).length);
  }, []);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregar = useCallback(async () => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const response = await apiService.getNotificacoes();
      if (response.success && response.data) {
        const lista = response.data as Notificacao[];
        setNotificacoes(lista);
        updateCounts(lista);
      } else {
        setErro(response.error || 'Erro ao carregar notificações');
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar notificações';
      setErro(mensagem);
      console.error('[NotificacaoContext] Erro ao carregar:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [updateCounts, setOperacao]);

  // ==========================================================================
  // AÇÕES
  // ==========================================================================

  const marcarComoLida = useCallback(async (id: string): Promise<boolean> => {
    setOperacao('marcarLida', true);

    // Otimista: atualizar UI imediatamente
    setNotificacoes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, lida: true } : n);
      updateCounts(updated);
      return updated;
    });

    try {
      await apiService.marcarNotificacaoLida(id);
      return true;
    } catch (error) {
      // Reverter em caso de erro
      setNotificacoes(prev => {
        const reverted = prev.map(n => n.id === id ? { ...n, lida: false } : n);
        updateCounts(reverted);
        return reverted;
      });
      console.error('[NotificacaoContext] Erro ao marcar como lida:', error);
      return false;
    } finally {
      setOperacao('marcarLida', false);
    }
  }, [updateCounts, setOperacao]);

  const marcarTodasComoLidas = useCallback(async (): Promise<boolean> => {
    setOperacao('marcarTodasLidas', true);

    const unreadIds = notificacoes.filter(n => !n.lida).map(n => n.id);

    // Otimista: atualizar UI imediatamente
    setNotificacoes(prev => {
      const updated = prev.map(n => ({ ...n, lida: true }));
      updateCounts(updated);
      return updated;
    });

    try {
      // Mark each unread notification
      await Promise.all(unreadIds.map(id => apiService.marcarNotificacaoLida(id)));
      return true;
    } catch (error) {
      // Reverter — reload from server
      console.error('[NotificacaoContext] Erro ao marcar todas como lidas:', error);
      await carregar();
      return false;
    } finally {
      setOperacao('marcarTodasLidas', false);
    }
  }, [notificacoes, carregar, updateCounts, setOperacao]);

  // ==========================================================================
  // REFRESH
  // ==========================================================================

  const refresh = useCallback(async () => {
    await carregar();
  }, [carregar]);

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: NotificacaoContextData = {
    notificacoes,
    unreadCount,
    carregando,
    erro,
    totalNotificacoes,
    operacoes,
    isOperacao,

    carregar,
    marcarComoLida,
    marcarTodasComoLidas,
    refresh,
  };

  return (
    <NotificacaoContext.Provider value={contextValue}>
      {children}
    </NotificacaoContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useNotificacao(): NotificacaoContextData {
  const context = useContext(NotificacaoContext);

  if (context === undefined) {
    throw new Error('useNotificacao deve ser usado dentro de um NotificacaoProvider');
  }

  return context;
}

export default NotificacaoContext;
