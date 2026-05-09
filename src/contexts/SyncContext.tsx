/**
 * SyncContext.tsx
 * Contexto para gerenciamento de sincronização offline-first
 * Integração: DatabaseService + ApiService + SyncService
 *
 * REWRITE NOTES:
 * - Removed syncEvents dependency — ONLY syncVersion is the data reload trigger
 * - Increment syncVersion after EVERY successful sync (push or pull)
 * - Simplified initialization (no race with isOnline)
 * - Added lastSyncResult object for UI feedback
 * - Robust error serialization (no more `{}` errors)
 * - Auto-sync managed here (removed from SyncService)
 * - Offline-first: skip sync silently when offline
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  SyncMetadata,
  SyncStatus,
  SyncConflict,
  ChangeLog,
  ConflictResolutionStrategy,
  Equipamento,
  DeviceActivationRequest,
  DeviceActivationResponse,
} from '../types';
import { databaseService } from '../services/DatabaseService';
import { apiService } from '../services/ApiService';
import { syncService, SyncResult } from '../services/SyncService';
import { secureStorage } from '../services/SecureStorage';
import logger from '../utils/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Interval (ms) after which we re-verify device activation with the server. */
const ACTIVATION_RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// ERROR SERIALIZATION
// ============================================================================

/**
 * Robust error serialization — never produces empty `{}` strings.
 * Duplicated here (also in SyncService) to keep SyncContext self-contained.
 */
function serializeError(error: unknown): string {
  if (error === null || error === undefined) {
    return 'Erro desconhecido (null/undefined)';
  }

  if (error instanceof Error) {
    return error.message || error.name || 'Erro desconhecido (Error sem mensagem)';
  }

  if (typeof error === 'string') {
    return error || 'Erro desconhecido (string vazia)';
  }

  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }

  if (typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    const message =
      errObj.message ||
      errObj.error ||
      errObj.statusText ||
      (errObj.data as Record<string, unknown>)?.error ||
      (errObj.data as Record<string, unknown>)?.message ||
      errObj.detail ||
      errObj.description ||
      null;

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }

    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}' && json !== '""') {
        return json;
      }
    } catch {
      // circular ref
    }

    const str = String(error);
    if (str && str !== '[object Object]') {
      return str;
    }

    const ctorName = (error as object)?.constructor?.name;
    if (ctorName && ctorName !== 'Object') {
      return `Erro do tipo ${ctorName} (sem mensagem)`;
    }

    return 'Erro inesperado (objeto sem propriedades serializáveis)';
  }

  return `Erro inesperado: ${String(error)}`;
}

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface SyncState {
  // Status
  status: SyncStatus;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncMessage: string;

  // Progress
  progress: {
    current: number;
    total: number;
    stage: 'push' | 'pull' | 'complete';
    message: string;
  } | null;

  // Conflicts
  conflitosPendentes: SyncConflict[];
  totalConflitos: number;

  // Pending changes
  mudancasPendentes: number;

  // Device
  dispositivo: {
    id: string;
    nome: string;
    chave: string;
    registrado: boolean;
  } | null;

  // Device activation
  needsDeviceActivation: boolean;
  dispositivoPendenteId: string | null;
  ativacaoErro: string | null;

  // Connectivity
  isOnline: boolean;

  // Errors
  erro: string | null;
  ultimoErro: string | null;
}

/** Result of the last sync operation — useful for UI feedback. */
export interface LastSyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: number;
  timestamp: string;
}

export interface SyncContextData extends SyncState {
  // Initialization
  inicializar: () => Promise<void>;

  // Sync
  sincronizar: (forca?: boolean) => Promise<void>;
  cancelarSincronizacao: () => void;
  syncNow: () => Promise<void>;

  // Device
  atualizarDispositivo: (dados: Partial<Equipamento>) => Promise<void>;
  ativarDispositivo: (dispositivoId: string, senhaNumerica: string) => Promise<boolean>;
  verificarAtivacao: () => Promise<void>;

  // Conflicts
  resolverConflito: (conflitoId: string, estrategia: ConflictResolutionStrategy) => Promise<void>;
  resolverTodosConflitos: (estrategia: ConflictResolutionStrategy) => Promise<void>;
  ignorarConflitos: () => void;

  // Utilities
  verificarConexao: () => Promise<boolean>;
  getMudancasPendentes: () => Promise<ChangeLog[]>;
  limparErros: () => void;

  // Config
  ativarAutoSync: (ativo: boolean) => void;
  setAutoSyncInterval: (minutos: number) => void;
  syncConfig: SyncConfig;

  // Compatibility properties
  lastSync: string | null;
  pendingItems: {
    clientes: number;
    produtos: number;
    locacoes: number;
    cobrancas: number;
    manutencoes: number;
    metas: number;
  };

  /**
   * Version counter — incremented after EVERY successful sync.
   * Data contexts use this as a useEffect dependency to reload from SQLite.
   * This is the ONLY notification mechanism (syncEvents removed).
   */
  syncVersion: number;

  /** Result of the last sync for UI display */
  lastSyncResult: LastSyncResult | null;
}

export interface SyncConfig {
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // minutes
  syncOnAppStart: boolean;
  syncOnAppResume: boolean;
  warnBeforeLargeSync: boolean;
  maxRecordsPerSync: number;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSyncEnabled: true,
  autoSyncInterval: 15,
  syncOnAppStart: true,
  syncOnAppResume: true,
  warnBeforeLargeSync: true,
  maxRecordsPerSync: 100,
};

// ============================================================================
// CONTEXT
// ============================================================================

const SyncContext = createContext<SyncContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface SyncProviderProps {
  children: ReactNode;
  config?: Partial<SyncConfig>;
}

export function SyncProvider({ children, config }: SyncProviderProps) {
  // ── Config ────────────────────────────────────────────────────────────────
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    ...DEFAULT_SYNC_CONFIG,
    ...config,
  });

  // ── Core state ────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<SyncStatus>('pending');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncMessage, setLastSyncMessage] = useState('');
  const [lastSyncResult, setLastSyncResult] = useState<LastSyncResult | null>(null);

  const [progress, setProgress] = useState<SyncState['progress']>(null);
  const [conflitosPendentes, setConflitosPendentes] = useState<SyncConflict[]>([]);
  const [mudancasPendentes, setMudancasPendentes] = useState(0);
  const [pendingItemsState, setPendingItemsState] = useState<SyncContextData['pendingItems']>({
    clientes: 0,
    produtos: 0,
    locacoes: 0,
    cobrancas: 0,
    manutencoes: 0,
    metas: 0,
  });

  const [dispositivo, setDispositivo] = useState<SyncState['dispositivo']>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoErro, setUltimoErro] = useState<string | null>(null);

  /**
   * syncVersion — THE single notification mechanism for data reload.
   * Incremented after every successful sync (push or pull).
   * Other contexts watch this in their useEffect dependencies.
   */
  const [syncVersion, setSyncVersion] = useState(0);

  // ── Device activation state ───────────────────────────────────────────────
  const [needsDeviceActivation, setNeedsDeviceActivation] = useState(false);
  const [dispositivoPendenteId, setDispositivoPendenteId] = useState<string | null>(null);
  const [ativacaoErro, setAtivacaoErro] = useState<string | null>(null);

  // ── Connectivity ──────────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(true);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // ==========================================================================
  // NETINFO — CONNECTIVITY
  // ==========================================================================

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) {
        logger.info('[SyncContext] Connection restored — online');
      } else {
        logger.info('[SyncContext] No connection — offline');
      }
    });

    return () => unsubscribe();
  }, []);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /** Update pending item counts by entity type */
  const atualizarPendingItems = useCallback(async () => {
    try {
      const counts = await databaseService.getPendingChangesCountByEntity();
      setPendingItemsState({
        clientes: counts['cliente'] || 0,
        produtos: counts['produto'] || 0,
        locacoes: counts['locacao'] || 0,
        cobrancas: counts['cobranca'] || 0,
        manutencoes: counts['manutencao'] || 0,
        metas: counts['meta'] || 0,
      });
    } catch (error) {
      logger.error('[SyncContext] Pending items count error:', serializeError(error));
    }
  }, []);

  /** Refresh pending counts after any sync operation */
  const refreshPendingCounts = useCallback(async () => {
    const restantes = await databaseService.getPendingChanges();
    setMudancasPendentes(restantes.length);
    await atualizarPendingItems();
  }, [atualizarPendingItems]);

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initializes sync context — loads local state first, then optionally syncs.
   *
   * Simplified: No dependency on isOnline during init. We load local data
   * unconditionally and attempt sync only at the end if conditions are met.
   */
  const inicializar = useCallback(async () => {
    if (isInitializedRef.current) {
      logger.info('[SyncContext] Already initialized — skipping');
      return;
    }

    logger.info('[SyncContext] Initializing...');

    try {
      // Initialize database
      await databaseService.initialize();

      // Load sync metadata
      const metadata = await databaseService.getSyncMetadata();
      setLastSyncAt(metadata.lastSyncAt !== new Date(0).toISOString() ? metadata.lastSyncAt : null);

      // Load device info
      setDispositivo({
        id: metadata.deviceId || '',
        nome: metadata.deviceName || '',
        chave: metadata.deviceKey || '',
        registrado: !!metadata.deviceId,
      });

      // Count pending changes
      const changes = await databaseService.getPendingChanges();
      setMudancasPendentes(changes.length);
      await atualizarPendingItems();

      setStatus('synced');
      setLastSyncMessage('Sincronização inicializada');
      isInitializedRef.current = true;

      logger.info('[SyncContext] Initialized successfully');

      // Auto-sync on start (if configured, device registered, and online)
      if (syncConfig.syncOnAppStart && metadata.deviceId) {
        // Read NetInfo synchronously at this point
        const netState = await NetInfo.fetch();
        const online = netState.isConnected === true && netState.isInternetReachable !== false;

        if (online) {
          logger.info('[SyncContext] Online — starting auto-sync on start');
          // Use syncService directly here (not sincronizar) to avoid closure over stale isOnline
          try {
            const savedToken = await secureStorage.getAccessToken();
            if (savedToken) {
              apiService.setToken(savedToken);
              const result = await syncService.sync();
              // Process result the same way as sincronizar
              if (result.conflicts.length > 0) {
                setConflitosPendentes(result.conflicts);
                setLastSyncMessage(`${result.conflicts.length} conflitos detectados`);
                setStatus('conflict');
              } else {
                setLastSyncMessage(result.success
                  ? `Sincronização concluída: ${result.pushed} enviadas, ${result.pulled} recebidas`
                  : `Concluída com ${result.errors.length} erros`);
                setStatus(result.success ? 'synced' : 'error');
              }
              if (result.errors.length > 0) {
                setUltimoErro(result.errors[0]);
              }
              setLastSyncAt(result.lastSyncAt);
              setLastSyncResult({
                pushed: result.pushed,
                pulled: result.pulled,
                conflicts: result.conflicts.length,
                errors: result.errors.length,
                timestamp: result.lastSyncAt,
              });
              await refreshPendingCounts();
              // THE ONLY NOTIFICATION: increment syncVersion
              setSyncVersion(v => v + 1);
            } else {
              logger.warn('[SyncContext] No token — skipping auto-sync on start');
            }
          } catch (err) {
            logger.error('[SyncContext] Auto-sync on start failed:', serializeError(err));
          }
        } else {
          logger.info('[SyncContext] Offline — skipping auto-sync on start');
        }
      }
    } catch (error) {
      const mensagem = serializeError(error);
      setErro(mensagem);
      setUltimoErro(mensagem);
      setStatus('error');
      logger.error('[SyncContext] Initialization error:', mensagem);
    }
  }, [syncConfig.syncOnAppStart, atualizarPendingItems, refreshPendingCounts]);

  // ==========================================================================
  // SYNC
  // ==========================================================================

  /**
   * Executes full sync (push + pull) via SyncService.
   *
   * OFFLINE-FIRST: If offline, returns silently without changing status.
   * NOTIFICATION: Increments syncVersion after successful sync — this is the
   * ONLY way data contexts know to reload. No syncEvents.
   */
  const sincronizar = useCallback(async (forca: boolean = false) => {
    // OFFLINE-FIRST: Skip silently if no connectivity
    if (!isOnline) {
      logger.info('[SyncContext] Offline — sync skipped');
      return;
    }

    if (isSyncing) {
      logger.info('[SyncContext] Sync already in progress');
      return;
    }

    setIsSyncing(true);
    setStatus('syncing');
    setErro(null);
    setLastSyncMessage('Iniciando sincronização...');

    try {
      // Sync token from SecureStore to ApiService
      const savedToken = await secureStorage.getAccessToken();
      if (savedToken) {
        apiService.setToken(savedToken);
      } else {
        logger.warn('[SyncContext] No token found — aborting sync');
        setIsSyncing(false);
        setStatus('pending');
        return;
      }

      // Verify device registration
      let deviceId = dispositivo?.id;
      let deviceKey = dispositivo?.chave;

      if (!deviceId || !deviceKey) {
        setLastSyncMessage('Verificando registro do dispositivo...');
        const registrado = await syncService.ensureDeviceRegistered();
        if (!registrado) {
          throw new Error('Falha ao registrar dispositivo');
        }
        const metadata = await databaseService.getSyncMetadata();
        deviceId = metadata.deviceId;
        deviceKey = metadata.deviceKey;
        setDispositivo({
          id: deviceId || '',
          nome: metadata.deviceName || '',
          chave: deviceKey || '',
          registrado: true,
        });
      }

      // Delegate to SyncService.sync() which has:
      // - Mutex (prevents concurrent sync)
      // - Batch marking of changelogs
      // - Version updates via updatedVersions
      // - Pagination in pull
      // - Snapshot recovery for stale devices
      setProgress({ current: 0, total: 2, stage: 'push', message: 'Enviando mudanças locais...' });

      const result = await syncService.sync();

      setProgress({ current: 2, total: 2, stage: 'complete', message: 'Sincronização concluída' });

      // Process result
      if (result.conflicts.length > 0) {
        setConflitosPendentes(result.conflicts);
        setLastSyncMessage(`${result.conflicts.length} conflitos detectados`);
        setStatus('conflict');
      } else {
        setLastSyncMessage(result.success
          ? `Sincronização concluída: ${result.pushed} enviadas, ${result.pulled} recebidas`
          : `Concluída com ${result.errors.length} erros`);
        setStatus(result.success ? 'synced' : 'error');
      }

      if (result.errors.length > 0) {
        setUltimoErro(result.errors[0]);
      }

      // Update local metadata
      setLastSyncAt(result.lastSyncAt);

      // Update last sync result for UI
      setLastSyncResult({
        pushed: result.pushed,
        pulled: result.pulled,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
        timestamp: result.lastSyncAt,
      });

      // Refresh pending counts
      await refreshPendingCounts();

      // ── THE ONLY NOTIFICATION MECHANISM ──
      // Increment syncVersion so data contexts (ClienteContext, etc.) reload
      // from SQLite. This replaces the old syncEvents.emitSyncComplete().
      setSyncVersion(v => v + 1);

      // Clear progress after 2 seconds
      setTimeout(() => setProgress(null), 2000);

    } catch (error) {
      const mensagem = serializeError(error);
      setErro(mensagem);
      setUltimoErro(mensagem);
      setStatus('error');
      setLastSyncMessage(`Erro: ${mensagem}`);
      logger.error('[SyncContext] Sync error:', mensagem);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, dispositivo, isOnline, refreshPendingCounts]);

  /**
   * Cancel sync in progress
   */
  const cancelarSincronizacao = useCallback(() => {
    syncService.cancelSync();
    setIsSyncing(false);
    setStatus('pending');
    setProgress(null);
    setLastSyncMessage('Sincronização cancelada');
  }, []);

  // ==========================================================================
  // DEVICE
  // ==========================================================================

  /**
   * Atualiza informações do dispositivo (local only)
   */
  const atualizarDispositivo = useCallback(async (dados: Partial<Equipamento>) => {
    if (!dispositivo) return;

    try {
      setDispositivo({
        ...dispositivo,
        ...dados,
      });
      logger.info('[SyncContext] Device updated (local)');
    } catch (error) {
      logger.error('[SyncContext] Device update error:', serializeError(error));
    }
  }, [dispositivo]);

  // ==========================================================================
  // DEVICE ACTIVATION
  // ==========================================================================

  /**
   * Verifica se o dispositivo precisa de ativação.
   *
   * OFFLINE-FIRST:
   * 1. If local deviceId + deviceKey exist → trust it, no activation needed.
   * 2. If no local device data → needs activation.
   * 3. If online & >24h since last check → background API verification
   *    (failures don't override local state).
   */
  const verificarAtivacao = useCallback(async () => {
    logger.info('[SyncContext] Checking activation...');

    try {
      const metadata = await databaseService.getSyncMetadata();

      // ── 1. Local data exists → trust it (offline-first) ──
      if (metadata.deviceId && metadata.deviceKey) {
        setNeedsDeviceActivation(false);
        setDispositivo({
          id: metadata.deviceId,
          nome: metadata.deviceName || '',
          chave: metadata.deviceKey,
          registrado: true,
        });
        logger.info('[SyncContext] Device activated locally — trusting local state');

        // ── 3. Optional background API check (online & >24h) ──
        if (isOnline) {
          const lastCheck = (metadata as any).lastActivationCheck as string | undefined;
          const timeSinceLastCheck = lastCheck
            ? Date.now() - new Date(lastCheck).getTime()
            : Infinity;

          if (!lastCheck || timeSinceLastCheck > ACTIVATION_RECHECK_INTERVAL_MS) {
            logger.info('[SyncContext] Online & >24h — verifying with server');
            try {
              const response = await apiService.verificarStatusDispositivo(metadata.deviceKey);

              await databaseService.updateSyncMetadata({
                lastActivationCheck: new Date().toISOString(),
              } as any);

              if (response.success && response.data?.needsActivation) {
                setNeedsDeviceActivation(true);
                setDispositivoPendenteId(response.data.dispositivoId || metadata.deviceId);
                logger.info('[SyncContext] Server says device needs activation — overriding local');
              } else {
                logger.info('[SyncContext] Server confirmed device is active');
              }
            } catch {
              logger.info('[SyncContext] API verification failed — trusting local state');
            }
          } else {
            logger.info('[SyncContext] Recently verified (<24h) — skipping API check');
          }
        } else {
          logger.info('[SyncContext] Offline — skipping API verification, trusting local state');
        }

        return;
      }

      // ── 2. No local device data → needs activation ──
      setNeedsDeviceActivation(true);
      logger.info('[SyncContext] No device registered locally — activation required');

    } catch (error) {
      logger.error('[SyncContext] Activation check error:', serializeError(error));
      // Don't set needsDeviceActivation on error — trust local state
    }
  }, [isOnline]);

  /**
   * Ativa dispositivo com senha de 6 dígitos
   */
  const ativarDispositivo = useCallback(async (
    dispositivoId: string,
    senhaNumerica: string
  ): Promise<boolean> => {
    logger.info('[SyncContext] Activating device:', dispositivoId);
    setAtivacaoErro(null);

    try {
      const deviceKey = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const deviceName = `Dispositivo ${dispositivoId.substring(0, 8)}`;

      const response = await apiService.ativarDispositivo({
        dispositivoId,
        deviceKey,
        deviceName,
        senhaNumerica,
      });

      if (!response.success || !response.data?.success) {
        const errorMsg = response.error || 'Falha ao ativar dispositivo';
        setAtivacaoErro(errorMsg);
        logger.error('[SyncContext] Activation failed:', errorMsg);
        return false;
      }

      // Use server data as source of truth
      const serverDevice = response.data.dispositivo;
      const serverDeviceKey = serverDevice?.deviceKey || deviceKey;
      const serverChave = serverDevice?.chave || '';
      const serverId = serverDevice?.id || dispositivoId;

      await databaseService.setDeviceId(
        serverId,
        deviceName,
        serverDeviceKey,
        serverChave
      );

      await databaseService.updateSyncMetadata({
        lastActivationCheck: new Date().toISOString(),
      } as any);

      setDispositivo({
        id: serverId,
        nome: deviceName,
        chave: serverDeviceKey,
        registrado: true,
      });

      setNeedsDeviceActivation(false);
      setDispositivoPendenteId(null);
      setAtivacaoErro(null);

      logger.info('[SyncContext] Device activated successfully!');
      return true;

    } catch (error) {
      const errorMsg = serializeError(error);
      setAtivacaoErro(errorMsg);
      logger.error('[SyncContext] Device activation error:', errorMsg);
      return false;
    }
  }, []);

  // ==========================================================================
  // CONFLICTS
  // ==========================================================================

  /**
   * Resolve um conflito específico
   */
  const resolverConflito = useCallback(async (
    conflitoId: string,
    estrategia: ConflictResolutionStrategy
  ) => {
    try {
      const conflito = conflitosPendentes.find(c => c.entityId === conflitoId);
      if (!conflito) return;

      setLastSyncMessage(`Resolvendo conflito: ${estrategia}...`);
      setErro(null);

      let versaoFinal: any;

      switch (estrategia) {
        case 'local':
          versaoFinal = conflito.localVersion;
          break;
        case 'remote':
          versaoFinal = conflito.remoteVersion;
          break;
        case 'newest': {
          const localUpdatedAt = String((conflito.localVersion as any)?.updatedAt || 0);
          const remoteUpdatedAt = String((conflito.remoteVersion as any)?.updatedAt || 0);
          versaoFinal = new Date(localUpdatedAt) > new Date(remoteUpdatedAt)
            ? conflito.localVersion
            : conflito.remoteVersion;
          break;
        }
        case 'manual':
          setErro('Resolução manual ainda não possui editor no mobile');
          setStatus('conflict');
          return;
      }

      if (!versaoFinal?.id) {
        versaoFinal = { ...versaoFinal, id: conflito.entityId };
      }

      const resolvido = await syncService.resolveConflict(
        conflitoId,
        estrategia,
        versaoFinal
      );

      if (!resolvido) {
        throw new Error('Servidor recusou a resolução do conflito');
      }

      await databaseService.applyRemoteChanges({
        success: true,
        lastSyncAt: new Date().toISOString(),
        changes: {
          clientes: conflito.entityType === 'cliente' ? [versaoFinal] : [],
          produtos: conflito.entityType === 'produto' ? [versaoFinal] : [],
          locacoes: conflito.entityType === 'locacao' ? [versaoFinal] : [],
          cobrancas: conflito.entityType === 'cobranca' ? [versaoFinal] : [],
          rotas: conflito.entityType === 'rota' ? [versaoFinal] : [],
          usuarios: conflito.entityType === 'usuario' ? [versaoFinal] : [],
          manutencoes: conflito.entityType === 'manutencao' ? [versaoFinal] : [],
          metas: conflito.entityType === 'meta' ? [versaoFinal] : [],
        },
      });

      // Remove from conflict list
      setConflitosPendentes(prev => prev.filter(c => c.entityId !== conflitoId));

      setLastSyncMessage('Conflito resolvido');

      // If no more conflicts, mark as synced and trigger sync
      if (conflitosPendentes.length <= 1) {
        setStatus('synced');
        await sincronizar();
      }
    } catch (error) {
      const mensagem = serializeError(error);
      setErro(mensagem);
      logger.error('[SyncContext] Conflict resolution error:', mensagem);
    }
  }, [conflitosPendentes, sincronizar]);

  /**
   * Resolve todos os conflitos com uma estratégia
   */
  const resolverTodosConflitos = useCallback(async (estrategia: ConflictResolutionStrategy) => {
    for (const conflito of conflitosPendentes) {
      await resolverConflito(conflito.entityId, estrategia);
    }
  }, [conflitosPendentes, resolverConflito]);

  /**
   * Ignora conflitos (mantém versão local)
   */
  const ignorarConflitos = useCallback(() => {
    setConflitosPendentes([]);
    setStatus('synced');
    setLastSyncMessage('Conflitos ignorados (versão local mantida)');
  }, []);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  const verificarConexao = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiService.healthCheck();
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const getMudancasPendentes = useCallback(async (): Promise<ChangeLog[]> => {
    return await databaseService.getPendingChanges();
  }, []);

  const limparErros = useCallback(() => {
    setErro(null);
  }, []);

  // ==========================================================================
  // AUTO SYNC CONFIGURATION
  // ==========================================================================

  /**
   * Ativa ou desativa auto sync
   */
  const ativarAutoSync = useCallback((ativo: boolean) => {
    setSyncConfig(prev => ({
      ...prev,
      autoSyncEnabled: ativo,
    }));

    // Clear existing timer
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }

    // Create new timer if active
    if (ativo) {
      const timer = setInterval(() => {
        logger.info('[SyncContext] Auto-sync timer firing...');
        sincronizar();
      }, syncConfig.autoSyncInterval * 60 * 1000);

      autoSyncTimerRef.current = timer;
    }
  }, [syncConfig.autoSyncInterval, sincronizar]);

  /**
   * Define intervalo do auto sync
   */
  const setAutoSyncInterval = useCallback((minutos: number) => {
    setSyncConfig(prev => ({
      ...prev,
      autoSyncInterval: minutos,
    }));

    // Restart timer with new interval
    if (syncConfig.autoSyncEnabled) {
      ativarAutoSync(true);
    }
  }, [syncConfig.autoSyncEnabled, ativarAutoSync]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Initialize on mount
  useEffect(() => {
    inicializar();

    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [inicializar]);

  // Auto sync when config changes
  useEffect(() => {
    if (syncConfig.autoSyncEnabled && dispositivo?.registrado) {
      ativarAutoSync(true);
    }
  }, [syncConfig.autoSyncEnabled, dispositivo?.registrado, ativarAutoSync]);

  // Sync on app resume (background → active)
  useEffect(() => {
    if (!syncConfig.syncOnAppResume) return;

    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        // OFFLINE-FIRST: Skip sync if offline
        if (!isOnline) {
          logger.info('[SyncContext] App resumed but offline — skipping sync');
          return;
        }

        const token = await secureStorage.getAccessToken();
        if (!token) {
          logger.info('[SyncContext] App resumed but no token — skipping sync');
          return;
        }

        if (!dispositivo?.registrado) {
          logger.info('[SyncContext] App resumed but device not registered — skipping sync');
          return;
        }

        logger.info('[SyncContext] App resumed — starting sync');
        sincronizar();
      }
    });

    return () => subscription.remove();
  }, [syncConfig.syncOnAppResume, sincronizar, dispositivo?.registrado, isOnline]);

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: SyncContextData = {
    // State
    status,
    isSyncing,
    lastSyncAt,
    lastSyncMessage,
    progress,
    conflitosPendentes,
    totalConflitos: conflitosPendentes.length,
    mudancasPendentes,
    dispositivo,
    erro,
    ultimoErro,

    // Connectivity
    isOnline,

    // Activation
    needsDeviceActivation,
    dispositivoPendenteId,
    ativacaoErro,

    // Init
    inicializar,

    // Sync
    sincronizar,
    cancelarSincronizacao,
    syncNow: () => sincronizar(true),

    // Device
    atualizarDispositivo,
    ativarDispositivo,
    verificarAtivacao,

    // Conflicts
    resolverConflito,
    resolverTodosConflitos,
    ignorarConflitos,

    // Utilities
    verificarConexao,
    getMudancasPendentes,
    limparErros,

    // Config
    ativarAutoSync,
    setAutoSyncInterval,
    syncConfig,

    // Compatibility
    lastSync: lastSyncAt,
    pendingItems: pendingItemsState,

    // Version control — THE notification mechanism
    syncVersion,

    // Last sync result for UI
    lastSyncResult,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSync(): SyncContextData {
  const context = useContext(SyncContext);

  if (context === undefined) {
    throw new Error('useSync deve ser usado dentro de um SyncProvider');
  }

  return context;
}

// ============================================================================
// EXPORT
// ============================================================================

export default SyncContext;
