/**
 * SyncContext.tsx
 * Contexto para gerenciamento de sincronização offline-first
 * Integração: DatabaseService + ApiService + Tipos
 *
 * OFFLINE-FIRST PRINCIPLES:
 * - verificarAtivacao() trusts local device data first; API is only a
 *   background verification (and only when online).
 * - sincronizar() silently skips when offline (no error state).
 * - inicializar() loads local state and sets 'synced' without auto-sync
 *   if offline.
 * - AppState resume sync only fires when online.
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
  DeviceActivationResponse
} from '../types';
import { databaseService } from '../services/DatabaseService';
import { apiService } from '../services/ApiService';
import { syncService } from '../services/SyncService';
import { secureStorage } from '../services/SecureStorage';
import logger from '../utils/logger';
import syncEvents from '../utils/sync-events';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Interval (ms) after which we re-verify device activation with the server. */
const ACTIVATION_RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface SyncState {
  // Status atual
  status: SyncStatus;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncMessage: string;
  
  // Progresso
  progress: {
    current: number;
    total: number;
    stage: 'push' | 'pull' | 'complete';
    message: string;
  } | null;
  
  // Conflitos
  conflitosPendentes: SyncConflict[];
  totalConflitos: number;
  
  // Mudanças pendentes
  mudancasPendentes: number;
  
  // Dispositivo
  dispositivo: {
    id: string;
    nome: string;
    chave: string;
    registrado: boolean;
  } | null;
  
  // Ativação de dispositivo
  needsDeviceActivation: boolean;
  dispositivoPendenteId: string | null;
  ativacaoErro: string | null;
  
  // Conectividade
  isOnline: boolean;
  
  // Erros
  erro: string | null;
  ultimoErro: string | null;
}

export interface SyncContextData extends SyncState {
  // Inicialização
  inicializar: () => Promise<void>;
  
  // Sincronização
  sincronizar: (forca?: boolean) => Promise<void>;
  cancelarSincronizacao: () => void;
  syncNow: () => Promise<void>; // Alias para sincronizar
  
  // Dispositivo
  atualizarDispositivo: (dados: Partial<Equipamento>) => Promise<void>;
  ativarDispositivo: (dispositivoId: string, senhaNumerica: string) => Promise<boolean>;
  verificarAtivacao: () => Promise<void>;
  
  // Conflitos
  resolverConflito: (conflitoId: string, estrategia: ConflictResolutionStrategy) => Promise<void>;
  resolverTodosConflitos: (estrategia: ConflictResolutionStrategy) => Promise<void>;
  ignorarConflitos: () => void;
  
  // Utilitários
  verificarConexao: () => Promise<boolean>;
  getMudancasPendentes: () => Promise<ChangeLog[]>;
  limparErros: () => void;
  
  // Configurações
  ativarAutoSync: (ativo: boolean) => void;
  setAutoSyncInterval: (minutos: number) => void;
  syncConfig: SyncConfig;
  
  // Propriedades adicionais para compatibilidade
  lastSync: string | null;
  pendingItems: {
    clientes: number;
    produtos: number;
    locacoes: number;
    cobrancas: number;
    manutencoes: number;
    metas: number;
  };

  // Controle de versão — incrementado após cada sync bem-sucedido.
  // Usado como dependência em useEffect nos contexts de dados para
  // recarregar dados do SQLite após sync.
  syncVersion: number;
}

export interface SyncConfig {
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // minutos
  syncOnAppStart: boolean;
  syncOnAppResume: boolean;
  warnBeforeLargeSync: boolean;
  maxRecordsPerSync: number;
}

// ============================================================================
// CONFIGURAÇÃO PADRÃO
// ============================================================================

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSyncEnabled: true,
  autoSyncInterval: 15, // 15 minutos
  syncOnAppStart: true,
  syncOnAppResume: true,
  warnBeforeLargeSync: true,
  maxRecordsPerSync: 100,
};

// ============================================================================
// CRIAÇÃO DO CONTEXT
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
  // Configurações
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    ...DEFAULT_SYNC_CONFIG,
    ...config,
  });

  // Estado de sincronização
  const [status, setStatus] = useState<SyncStatus>('pending');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncMessage, setLastSyncMessage] = useState('');
  
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

  // Contador de versão de sync — incrementado após cada sync bem-sucedido.
  // Os contexts de dados usam isso como dependência de useEffect para
  // recarregar dados do SQLite após a sincronização.
  const [syncVersion, setSyncVersion] = useState(0);
  
  // Estados para ativação de dispositivo
  const [needsDeviceActivation, setNeedsDeviceActivation] = useState(false);
  const [dispositivoPendenteId, setDispositivoPendenteId] = useState<string | null>(null);
  const [ativacaoErro, setAtivacaoErro] = useState<string | null>(null);

  // Conectividade — rastreada via NetInfo
  const [isOnline, setIsOnline] = useState(true);

  // Timer para auto sync — useRef para evitar memory leak
  // (useState causaria re-render e não limparia o interval anterior corretamente)
  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================================================
  // NETINFO — CONECTIVIDADE
  // ==========================================================================

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) {
        logger.info('[SyncContext] Conexão restabelecida — online');
      } else {
        logger.info('[SyncContext] Sem conexão — offline');
      }
    });

    return () => unsubscribe();
  }, []);

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================

  /**   * Inicializa o contexto de sincronização
   */
  const inicializar = useCallback(async () => {
    console.log('[SyncContext] Inicializando...');
    
    try {
      // Inicializar banco de dados
      await databaseService.initialize();
      
      // Carregar metadata de sync
      const metadata = await databaseService.getSyncMetadata();
      
      setLastSyncAt(metadata.lastSyncAt !== new Date(0).toISOString() ? metadata.lastSyncAt : null);
      
      // Carregar informações do dispositivo
      setDispositivo({
        id: metadata.deviceId || '',
        nome: metadata.deviceName || '',
        chave: metadata.deviceKey || '',
        registrado: !!metadata.deviceId,
      });
      
      // Contar mudanças pendentes
      const changes = await databaseService.getPendingChanges();
      setMudancasPendentes(changes.length);
      
      // Contar mudanças pendentes por tipo de entidade
      await atualizarPendingItems();
      
      setStatus('synced');
      setLastSyncMessage('Sincronização inicializada');
      
      console.log('[SyncContext] Inicializado com sucesso');
      
      // Sync automático ao iniciar (se configurado) — apenas se online
      if (syncConfig.syncOnAppStart && metadata.deviceId && isOnline) {
        console.log('[SyncContext] Online — iniciando sync automático');
        await sincronizar();
      } else if (syncConfig.syncOnAppStart && metadata.deviceId && !isOnline) {
        console.log('[SyncContext] Offline — pulando sync automático ao iniciar');
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao inicializar sync';
      setErro(mensagem);
      setUltimoErro(mensagem);
      setStatus('error');
      console.error('[SyncContext] Erro na inicialização:', error);
  
  }
  }, [syncConfig.syncOnAppStart, isOnline]);

  // ==========================================================================
  // SINCRONIZAÇÃO
  // ==========================================================================

/**
   * Executa sincronização completa (push + pull)
   * CORREÇÃO: Delega para SyncService.sync() que possui mutex, batch marking,
   * version updates, paginação e snapshot recovery. Antes este método
   * duplicava toda a lógica de push/pull diretamente via ApiService,
   * causando race conditions e perda de dados.
   *
   * OFFLINE-FIRST: Se offline, retorna silenciosamente sem alterar o status.
   */
  const sincronizar = useCallback(async (forca: boolean = false) => {
    // OFFLINE-FIRST: Se não há conectividade, pular silenciosamente
    if (!isOnline) {
      console.log('[SyncContext] Offline — sincronização pulada');
      return;
    }

    if (isSyncing) {
      console.log('[SyncContext] Sincronização já em andamento');
      return;
    }

    setIsSyncing(true);
    setStatus('syncing');
    setErro(null);
    setLastSyncMessage('Iniciando sincronização...');

    try {
      // IMPORTANTE: Sincronizar token do AsyncStorage com ApiService
      const savedToken = await secureStorage.getAccessToken();
      if (savedToken) {
        apiService.setToken(savedToken);
      } else {
        console.warn('[SyncContext] Nenhum token encontrado — abortando sync');
        setIsSyncing(false);
        setStatus('pending');
        return;
      }

      // Verificar dispositivo
      let deviceId = dispositivo?.id;
      let deviceKey = dispositivo?.chave;

      if (!deviceId || !deviceKey) {
        setLastSyncMessage('Registrando dispositivo...');
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

      // Delegar para SyncService.sync() que tem:
      // - Mutex (evita sync concorrente)
      // - Batch marking de changelogs
      // - Version updates via updatedVersions
      // - Paginação no pull
      // - Snapshot recovery para stale devices
      setProgress({ current: 0, total: 2, stage: 'push', message: 'Enviando mudanças locais...' });

      const result = await syncService.sync();

      setProgress({ current: 2, total: 2, stage: 'complete', message: 'Sincronização concluída' });

      // Processar resultado
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

      // Atualizar metadata local
      setLastSyncAt(result.lastSyncAt);

      // Atualizar contagem de mudanças pendentes
      const restantes = await databaseService.getPendingChanges();
      setMudancasPendentes(restantes.length);
      await atualizarPendingItems();

      // CORREÇÃO: Notificar todos os contextos para recarregar dados do SQLite.
      // Sem isso, os contextos (ClienteContext, etc.) continuam com dados antigos
      // na memória mesmo após o sync ter escrito novos dados no banco.
      syncEvents.emitSyncComplete();

      // Incrementar syncVersion para que useEffects nos contexts de dados
      // disparem e recarreguem os dados do SQLite.
      setSyncVersion(v => v + 1);

      // Limpar progresso após 2 segundos
      setTimeout(() => setProgress(null), 2000);

    } catch (error) {
      // Serialização robusta de erros — evita "Erro: {}" quando o objeto
      // tem propriedades não-enumeráveis (comum em erros de rede/API)
      let mensagem = 'Erro durante sincronização';
      if (error instanceof Error) {
        mensagem = error.message;
      } else if (typeof error === 'string') {
        mensagem = error;
      } else if (error && typeof error === 'object') {
        // Tenta extrair message/status/data de objetos de erro HTTP
        const errObj = error as any;
        mensagem = errObj.message || errObj.error || errObj.statusText
          || (errObj.data?.error) || (errObj.data?.message)
          || JSON.stringify(error);
        if (mensagem === '{}' || mensagem === '') {
          mensagem = `Erro inesperado: ${String(error)}`;
        }
      }
      setErro(mensagem);
      setUltimoErro(mensagem);
      setStatus('error');
      setLastSyncMessage(`Erro: ${mensagem}`);
      logger.error('[SyncContext] Erro na sincronização:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, dispositivo, lastSyncAt, isOnline]);

  /**
   * Cancela sincronização em andamento
   */
  const cancelarSincronizacao = useCallback(() => {
    syncService.cancelSync();
    setIsSyncing(false);
    setStatus('pending');
    setProgress(null);
    setLastSyncMessage('Sincronização cancelada');
  }, []);

  // ==========================================================================
  // DISPOSITIVO
  // ==========================================================================

  /**
   * Atualiza informações do dispositivo
   */
  const atualizarDispositivo = useCallback(async (dados: Partial<Equipamento>) => {
    if (!dispositivo) return;

    try {
      // Atualizar apenas o estado local — a API não possui mais atualizarEquipamento
      // O dispositivo será sincronizado via fluxo de ativação
      setDispositivo({
        ...dispositivo,
        ...dados,
      });

      console.log('[SyncContext] Dispositivo atualizado (local)');
    } catch (error) {
      console.error('[SyncContext] Erro ao atualizar dispositivo:', error);
    }
  }, [dispositivo]);

  // ==========================================================================
  // ATIVAÇÃO DE DISPOSITIVO COM SENHA
  // ==========================================================================

  /**
   * Verifica se o dispositivo precisa de ativação.
   *
   * OFFLINE-FIRST STRATEGY:
   * 1. If we have deviceId + deviceKey in local sync metadata, trust it.
   *    The device was previously activated — set needsDeviceActivation=false
   *    immediately without requiring an API call.
   * 2. If no local device data exists, the device truly needs activation.
   * 3. If online AND we have local data, optionally verify with the API
   *    but ONLY if it's been more than 24 hours since the last check.
   *    This is a background check — failures don't override local state.
   */
  const verificarAtivacao = useCallback(async () => {
    console.log('[SyncContext] Verificando necessidade de ativação...');
    
    try {
      const metadata = await databaseService.getSyncMetadata();
      
      // ── 1. If we have local device data, trust it (offline-first) ──
      if (metadata.deviceId && metadata.deviceKey) {
        setNeedsDeviceActivation(false);
        setDispositivo({
          id: metadata.deviceId,
          nome: metadata.deviceName || '',
          chave: metadata.deviceKey,
          registrado: true,
        });
        console.log('[SyncContext] Device already activated locally — trusting local state');

        // ── 3. Optional background API check (only if online & >24h since last check) ──
        if (isOnline) {
          const lastCheck = (metadata as any).lastActivationCheck as string | undefined;
          const timeSinceLastCheck = lastCheck
            ? Date.now() - new Date(lastCheck).getTime()
            : Infinity;

          if (!lastCheck || timeSinceLastCheck > ACTIVATION_RECHECK_INTERVAL_MS) {
            console.log('[SyncContext] Online & >24h since last API check — verifying with server');
            try {
              const response = await apiService.verificarStatusDispositivo(metadata.deviceKey);

              // Persist the timestamp of this check (stored as extra key in sync_metadata)
              await databaseService.updateSyncMetadata({
                lastActivationCheck: new Date().toISOString(),
              } as any);

              if (response.success && response.data?.needsActivation) {
                // Server says device needs re-activation — honor it
                setNeedsDeviceActivation(true);
                setDispositivoPendenteId(response.data.dispositivoId || metadata.deviceId);
                console.log('[SyncContext] Server reports device needs activation — overriding local');
              } else {
                console.log('[SyncContext] Server confirmed device is active');
              }
            } catch {
              // API error — trust local state, don't change anything
              console.log('[SyncContext] API verification failed — trusting local state');
            }
          } else {
            console.log('[SyncContext] Recently verified (<24h) — skipping API check');
          }
        } else {
          console.log('[SyncContext] Offline — skipping API verification, trusting local state');
        }

        return;
      }

      // ── 2. No local device data — needs activation regardless ──
      setNeedsDeviceActivation(true);
      console.log('[SyncContext] No device registered locally — activation required');
      
    } catch (error) {
      console.error('[SyncContext] Erro ao verificar ativação:', error);
      // Don't set needsDeviceActivation on error — trust local state
      // (avoid blocking the user when the DB read itself fails)
    }
  }, [isOnline]);

  /**
   * Ativa dispositivo com senha de 6 dígitos
   * @param dispositivoId ID do dispositivo cadastrado no painel web
   * @param senhaNumerica Senha de 6 dígitos fornecida pelo admin
   */
  const ativarDispositivo = useCallback(async (
    dispositivoId: string,
    senhaNumerica: string
  ): Promise<boolean> => {
    console.log('[SyncContext] Ativando dispositivo:', dispositivoId);
    setAtivacaoErro(null);
    
    try {
      // Gerar chave única para este dispositivo
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
        console.error('[SyncContext] Erro na ativação:', errorMsg);
        return false;
      }
      
      // Usar dados do servidor como fonte única de verdade
      const serverDevice = response.data.dispositivo;
      const serverDeviceKey = serverDevice?.deviceKey || deviceKey;
      const serverChave = serverDevice?.chave || '';
      const serverId = serverDevice?.id || dispositivoId;
      
      // Salvar informações do dispositivo localmente usando dados do servidor
      await databaseService.setDeviceId(
        serverId,
        deviceName,
        serverDeviceKey,
        serverChave
      );

      // Persist activation check timestamp so verificarAtivacao won't
      // immediately re-verify with the server after activation.
      await databaseService.updateSyncMetadata({
        lastActivationCheck: new Date().toISOString(),
      } as any);
      
      // Atualizar estado
      setDispositivo({
        id: serverId,
        nome: deviceName,
        chave: serverDeviceKey,
        registrado: true,
      });
      
      setNeedsDeviceActivation(false);
      setDispositivoPendenteId(null);
      setAtivacaoErro(null);
      
      console.log('[SyncContext] Dispositivo ativado com sucesso!');
      return true;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro ao ativar dispositivo';
      setAtivacaoErro(errorMsg);
      console.error('[SyncContext] Erro ao ativar dispositivo:', error);
      return false;
    }
  }, []);
  // ==========================================================================
  // CONFLITOS
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

      // Aplicar estratégia de resolução
      let versaoFinal: any;
      
      switch (estrategia) {
        case 'local':
          versaoFinal = conflito.localVersion;
          break;
        case 'remote':
          versaoFinal = conflito.remoteVersion;
          break;
        case 'newest':
          const localUpdatedAt = String((conflito.localVersion as any)?.updatedAt || 0);
          const remoteUpdatedAt = String((conflito.remoteVersion as any)?.updatedAt || 0);
          const localDate = new Date(localUpdatedAt);
          const remoteDate = new Date(remoteUpdatedAt);
          versaoFinal = localDate > remoteDate ? conflito.localVersion : conflito.remoteVersion;
          break;
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

      // Remover da lista de conflitos
      setConflitosPendentes(prev => prev.filter(c => c.entityId !== conflitoId));

      setLastSyncMessage('Conflito resolvido');
      
      // Se não houver mais conflitos, marcar como synced
      if (conflitosPendentes.length <= 1) {
        setStatus('synced');
        await sincronizar();
    
  }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao resolver conflito';
      setErro(mensagem);
      console.error('[SyncContext] Erro ao resolver conflito:', error);
  
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
  // UTILITÁRIOS
  // ==========================================================================

  /**
   * Verifica se há conexão com a internet
   */
  const verificarConexao = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiService.healthCheck();
      return response.ok;
    } catch {
      return false;
  
  }
  }, []);
  /**
   * Busca mudanças pendentes do banco local
   */
  const getMudancasPendentes = useCallback(async (): Promise<ChangeLog[]> => {
    return await databaseService.getPendingChanges();
  }, []);

  /**
   * Limpa erros do estado
   */
  const limparErros = useCallback(() => {
    setErro(null);
  }, []);

  // ==========================================================================
  // CONFIGURAÇÕES DE AUTO SYNC
  // ==========================================================================

  /**
   * Atualiza contagem de mudanças pendentes por tipo de entidade
   */
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
      console.error('[SyncContext] Erro ao contar pending items:', error);
    }
  }, []);

  /**
   * Ativa ou desativa auto sync
   */
  const ativarAutoSync = useCallback((ativo: boolean) => {
    setSyncConfig(prev => ({
      ...prev,
      autoSyncEnabled: ativo,
    }));

    // Limpar timer existente via ref (evita memory leak)
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }

    // Criar novo timer se ativo
    if (ativo) {
      const timer = setInterval(() => {
        console.log('[SyncContext] Auto sync executando...');
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
      ...prev,      autoSyncInterval: minutos,
    }));

    // Reiniciar timer com novo intervalo
    if (syncConfig.autoSyncEnabled) {
      ativarAutoSync(true);
  
  }
  }, [syncConfig.autoSyncEnabled, ativarAutoSync]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Inicializar ao montar
  useEffect(() => {
    inicializar();

    // Cleanup — limpar timer via ref
    return () => {
      if (autoSyncTimerRef.current) {
        clearInterval(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [inicializar]);

  // Auto sync quando configuração mudar
  useEffect(() => {
    if (syncConfig.autoSyncEnabled && dispositivo?.registrado) {
      ativarAutoSync(true);
    }
  }, [syncConfig.autoSyncEnabled, dispositivo?.registrado, ativarAutoSync]);

  // Sync automático ao voltar do background (AppState: background → active)
  // IMPORTANTE: Não sincronizar se o dispositivo não está registrado/ativado
  // OFFLINE-FIRST: Não sincronizar se offline
  useEffect(() => {
    if (!syncConfig.syncOnAppResume) return;

    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        // OFFLINE-FIRST: Skip sync if offline
        if (!isOnline) {
          logger.info('[SyncContext] App voltou ao foreground mas offline — ignorando sync');
          return;
        }

        const token = await secureStorage.getAccessToken();
        if (!token) {
          logger.info('[SyncContext] App voltou ao foreground mas sem token — ignorando sync');
          return;
        }
        // Verificar se o dispositivo está registrado antes de sincronizar
        if (!dispositivo?.registrado) {
          logger.info('[SyncContext] App voltou ao foreground mas dispositivo não registrado — ignorando sync');
          return;
        }
        logger.info('[SyncContext] App voltou ao foreground — iniciando sync');
        sincronizar();
      }
    });

    return () => subscription.remove();
  }, [syncConfig.syncOnAppResume, sincronizar, dispositivo?.registrado, isOnline]);

  // ==========================================================================
  // ESTADO DO CONTEXT
  // ==========================================================================

  const contextValue: SyncContextData = {
    // Estado
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
    // Conectividade
    isOnline,
    // Ativação
    needsDeviceActivation,
    dispositivoPendenteId,
    ativacaoErro,
    // Inicialização
    inicializar,

    // Sincronização
    sincronizar,
    cancelarSincronizacao,
    syncNow: () => sincronizar(true),

    // Dispositivo
    atualizarDispositivo,
    ativarDispositivo,
    verificarAtivacao,

    // Conflitos
    resolverConflito,
    resolverTodosConflitos,
    ignorarConflitos,

    // Utilitários
    verificarConexao,
    getMudancasPendentes,
    limparErros,

    // Configurações
    ativarAutoSync,
    setAutoSyncInterval,
    syncConfig,

    // Propriedades adicionais para compatibilidade
    lastSync: lastSyncAt,
    pendingItems: pendingItemsState,

    // Controle de versão para reload dos contexts
    syncVersion,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useSync(): SyncContextData {
  const context = useContext(SyncContext);

  if (context === undefined) {
    throw new Error('useSync deve ser usado dentro de um SyncProvider');

  }

  return context;
}

// ============================================================================
// EXPORTAÇÃO PADRÃO
// ============================================================================
export default SyncContext;
