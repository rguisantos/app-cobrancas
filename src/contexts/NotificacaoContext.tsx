/**
 * NotificacaoContext.tsx
 * Contexto para gerenciamento de estado de Notificações
 * Integração: ApiService (notification endpoints) + local state
 *
 * OFFLINE-FIRST pattern (same as DashboardContext):
 * - Try API first; if offline/unavailable, fall back gracefully
 * - Optimistic UI updates for mark-as-read (no revert on failure)
 * - Notifications are transient — empty state is acceptable when offline
 * - isOffline flag lets consumers show appropriate UI
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
  /** Whether we're operating in offline mode (API unavailable) */
  isOffline: boolean;
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
  const [isOffline, setIsOffline] = useState(false);

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
  // CARREGAMENTO (OFFLINE-FIRST)
  // ==========================================================================

  /**
   * Carrega notificações — offline-first pattern:
   * 1. Try API first (if online)
   * 2. If API fails, use empty state (notifications are transient, no local SQLite)
   * 3. Set isOffline flag so consumers can adapt UI
   */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      // 1. Try API first (if online)
      try {
        const response = await apiService.getNotificacoes();
        if (response.success && response.data) {
          const lista = response.data as Notificacao[];
          setNotificacoes(lista);
          updateCounts(lista);
          setIsOffline(false);
          return; // API succeeded, done
        }
        // API responded but not success — still try to use data if available
        if (response.data) {
          const lista = response.data as Notificacao[];
          setNotificacoes(lista);
          updateCounts(lista);
          setIsOffline(false);
          return;
        }
      } catch {
        // API failed — continue to offline fallback
        console.log('[NotificacaoContext] API indisponível — modo offline');
      }

      // 2. Offline or API failed — notifications are transient, empty state is OK
      setNotificacoes([]);
      updateCounts([]);
      setIsOffline(true);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [updateCounts, setOperacao]);

  // ==========================================================================
  // AÇÕES (OFFLINE-FIRST — OPTIMISTIC, NO REVERT)
  // ==========================================================================

  /**
   * Marca uma notificação como lida — offline-first:
   * - Optimistic: update local state immediately
   * - Try API in background; if it fails, keep the optimistic state
   * - No revert on failure (user expectation: "I marked it as read")
   */
  const marcarComoLida = useCallback(async (id: string): Promise<boolean> => {
    setOperacao('marcarLida', true);

    // Optimistic: update UI immediately
    setNotificacoes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, lida: true } : n);
      updateCounts(updated);
      return updated;
    });

    try {
      await apiService.marcarNotificacaoLida(id);
      setIsOffline(false);
      return true;
    } catch (error) {
      // OFFLINE-FIRST: Do NOT revert — keep the optimistic state
      // The user marked it as read, we'll sync later when back online
      setIsOffline(true);
      console.log('[NotificacaoContext] Erro ao marcar como lida (offline):', error);
      return true; // Return true because optimistic update succeeded locally
    } finally {
      setOperacao('marcarLida', false);
    }
  }, [updateCounts, setOperacao]);

  /**
   * Marca todas as notificações como lidas — offline-first:
   * - Optimistic: update all to lida immediately
   * - Try API in background; if it fails, keep the optimistic state
   * - No revert on failure
   */
  const marcarTodasComoLidas = useCallback(async (): Promise<boolean> => {
    setOperacao('marcarTodasLidas', true);

    // Capture unread IDs before optimistic update
    const unreadIds = notificacoes.filter(n => !n.lida).map(n => n.id);

    // Optimistic: update UI immediately — mark ALL as read
    setNotificacoes(prev => {
      const updated = prev.map(n => ({ ...n, lida: true }));
      updateCounts(updated);
      return updated;
    });

    try {
      // Mark each unread notification via API
      await Promise.all(unreadIds.map(id => apiService.marcarNotificacaoLida(id)));
      setIsOffline(false);
      return true;
    } catch (error) {
      // OFFLINE-FIRST: Do NOT revert — keep the optimistic state
      // We'll sync later when back online
      setIsOffline(true);
      console.log('[NotificacaoContext] Erro ao marcar todas como lidas (offline):', error);
      return true; // Return true because optimistic update succeeded locally
    } finally {
      setOperacao('marcarTodasLidas', false);
    }
  }, [notificacoes, updateCounts, setOperacao]);

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
    isOffline,
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
