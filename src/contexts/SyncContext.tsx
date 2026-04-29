/**
 * SyncContext.tsx
 * Contexto para gerenciamento de sincronização offline-first
 * Integração: DatabaseService + ApiService + Tipos
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import logger from '../utils/logger';

// Chave do token no AsyncStorage (mesma do AuthContext)
const TOKEN_KEY = '@cobrancas:token';

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
  registrarDispositivo: (nome: string, chave: string) => Promise<boolean>;
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
  };
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
  });
  
  const [dispositivo, setDispositivo] = useState<SyncState['dispositivo']>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoErro, setUltimoErro] = useState<string | null>(null);
  
  // Estados para ativação de dispositivo
  const [needsDeviceActivation, setNeedsDeviceActivation] = useState(false);
  const [dispositivoPendenteId, setDispositivoPendenteId] = useState<string | null>(null);
  const [ativacaoErro, setAtivacaoErro] = useState<string | null>(null);

  // Timer para auto sync — useRef para evitar memory leak
  // (useState causaria re-render e não limparia o interval anterior corretamente)
  const autoSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Sync automático ao iniciar (se configurado)
      if (syncConfig.syncOnAppStart && metadata.deviceId) {
        await sincronizar();
    
  }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao inicializar sync';
      setErro(mensagem);
      setUltimoErro(mensagem);
      setStatus('error');
      console.error('[SyncContext] Erro na inicialização:', error);
  
  }
  }, [syncConfig.syncOnAppStart]);

  // Sync automático ao voltar do background (AppState: background → active)
  useEffect(() => {
    if (!syncConfig.syncOnAppResume) return;

    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      // Só sincroniza quando voltar para foreground (background/inactive → active)
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        // BUG FIX: Verificar se há token antes de sincronizar
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (!token) {
          logger.info('[SyncContext] App voltou ao foreground mas sem token — ignorando sync');
          return;
        }
        logger.info('[SyncContext] App voltou ao foreground — iniciando sync');
        sincronizar();
      }
    });

    return () => subscription.remove();
  }, [syncConfig.syncOnAppResume, sincronizar]);

  // ==========================================================================
  // SINCRONIZAÇÃO
  // ==========================================================================

  /**
   * Executa sincronização completa (push + pull)   */
  const sincronizar = useCallback(async (forca: boolean = false) => {
    if (isSyncing) {
      console.log('[SyncContext] Sincronização já em andamento');
      return;
  
  }

    setIsSyncing(true);
    setStatus('pending');
    setErro(null);
    setLastSyncMessage('Iniciando sincronização...');

    try {
      // IMPORTANTE: Sincronizar token do AsyncStorage com ApiService
      // Isso garante que o token de autenticação esteja disponível para as requisições
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        apiService.setToken(savedToken);
        console.log('[SyncContext] Token sincronizado com ApiService');
      } else {
        // BUG FIX: Abortar imediatamente se não houver token
        console.warn('[SyncContext] ⚠️ Nenhum token encontrado no AsyncStorage — abortando sync');
        setIsSyncing(false);
        setStatus('idle');
        return;
      }

      // Verificar/registrar dispositivo automaticamente
      let deviceId = dispositivo?.id;
      let deviceKey = dispositivo?.chave;
      
      if (!deviceId || !deviceKey) {
        console.log('[SyncContext] Dispositivo não registrado, registrando automaticamente...');
        setLastSyncMessage('Registrando dispositivo...');
        
        const registrado = await syncService.ensureDeviceRegistered();
        if (!registrado) {
          throw new Error('Falha ao registrar dispositivo');
        }
        
        // Recarregar metadata
        const metadata = await databaseService.getSyncMetadata();
        deviceId = metadata.deviceId;
        deviceKey = metadata.deviceKey;
        
        setDispositivo({
          id: deviceId || '',
          nome: metadata.deviceName || '',
          chave: deviceKey || '',
          registrado: true,
        });
        
        console.log('[SyncContext] Dispositivo registrado:', deviceId);
      }

      // 1. Push - Enviar mudanças locais
      setProgress({
        current: 0,
        total: 2,
        stage: 'push',
        message: 'Enviando mudanças locais...',
      });

      const mudancasLocais = await databaseService.getPendingChanges();
      
      if (mudancasLocais.length > 0) {
        console.log(`[SyncContext] Enviando ${mudancasLocais.length} mudanças...`);
        
        const pushResponse = await apiService.pushChanges({
          deviceId: deviceId || '',
          deviceKey: deviceKey || '',
          lastSyncAt: lastSyncAt || new Date(0).toISOString(),
          changes: mudancasLocais,
        });

        if (!pushResponse.success) {
          throw new Error(pushResponse.errors?.[0] || 'Falha ao enviar mudanças');
      
  }

        // Marcar mudanças como sincronizadas
        for (const change of mudancasLocais) {
          await databaseService.markAsSynced(change.id);
      
  }

        setLastSyncMessage(`${mudancasLocais.length} mudanças enviadas`);
      } else {
        setLastSyncMessage('Nenhuma mudança local para enviar');
    
  }

      // 2. Pull - Buscar mudanças remotas
      setProgress({
        current: 1,
        total: 2,
        stage: 'pull',
        message: 'Baixando mudanças do servidor...',
      });

      const pullResponse = await apiService.pullChanges({
        deviceId: deviceId || '',
        deviceKey: deviceKey || '',
        lastSyncAt: lastSyncAt || new Date(0).toISOString(),
      });

      if (pullResponse.success) {
        // Verificar conflitos
        if (pullResponse.conflicts && pullResponse.conflicts.length > 0) {
          setConflitosPendentes(pullResponse.conflicts);
          setLastSyncMessage(`${pullResponse.conflicts.length} conflitos detectados`);
          setStatus('conflict');
        } else {
          // Aplicar mudanças remotas
          await databaseService.applyRemoteChanges(pullResponse);
          setLastSyncMessage('Sincronização concluída com sucesso');
          setStatus('synced');
      
  }

        // Atualizar metadata
        setLastSyncAt(pullResponse.lastSyncAt);
        await databaseService.updateSyncMetadata({
          lastSyncAt: pullResponse.lastSyncAt,
          lastPullAt: new Date().toISOString(),
        });
    
  }

      // 3. Completar
      setProgress({
        current: 2,
        total: 2,
        stage: 'complete',
        message: 'Sincronização concluída',
      });

      // Atualizar contagem de mudanças pendentes
      const restantes = await databaseService.getPendingChanges();
      setMudancasPendentes(restantes.length);
      
      // Atualizar contagem por tipo de entidade
      await atualizarPendingItems();
      // Limpar progresso após 2 segundos
      setTimeout(() => setProgress(null), 2000);

    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro durante sincronização';
      setErro(mensagem);
      setUltimoErro(mensagem);
      setStatus('error');
      setLastSyncMessage(`Erro: ${mensagem}`);
      logger.error('[SyncContext] Erro na sincronização:', error);
    } finally {
      setIsSyncing(false);
  
  }
  }, [isSyncing, dispositivo, lastSyncAt]);

  /**
   * Cancela sincronização em andamento
   */
  const cancelarSincronizacao = useCallback(() => {
    // TODO: Implementar cancelamento via ApiService (AbortController)
    setIsSyncing(false);
    setProgress(null);
    setLastSyncMessage('Sincronização cancelada');
  }, []);

  // ==========================================================================
  // DISPOSITIVO
  // ==========================================================================

  /**
   * Registra dispositivo no servidor
   */
  const registrarDispositivo = useCallback(async (nome: string, chave: string): Promise<boolean> => {
    try {
      setLastSyncMessage('Registrando dispositivo...');

      // Gerar ID único para o dispositivo
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Registrar no servidor
      const response = await apiService.registrarEquipamento({
        id: deviceId,
        nome,
        chave,
        tipo: 'Celular',
        dataCadastro: new Date().toISOString(),
      });

      if (!response.success) {
        throw new Error(response.error || 'Falha ao registrar dispositivo');
    
  }

      // Salvar metadata local
      await databaseService.setDeviceId(deviceId, nome, chave);

      // Atualizar estado
      setDispositivo({
        id: deviceId,
        nome,
        chave,
        registrado: true,
      });

      setLastSyncMessage('Dispositivo registrado com sucesso');
      setStatus('synced');

      console.log('[SyncContext] Dispositivo registrado:', deviceId);
      return true;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao registrar dispositivo';
      setErro(mensagem);
      setUltimoErro(mensagem);
      setLastSyncMessage(mensagem);
      console.error('[SyncContext] Erro ao registrar dispositivo:', error);
      return false;
  
  }
  }, []);

  /**
   * Atualiza informações do dispositivo
   */
  const atualizarDispositivo = useCallback(async (dados: Partial<Equipamento>) => {
    if (!dispositivo) return;

    try {
      await apiService.atualizarEquipamento({
        ...dispositivo,
        ...dados,
      });

      setDispositivo({
        ...dispositivo,
        ...dados,
      });

      console.log('[SyncContext] Dispositivo atualizado');
    } catch (error) {
      console.error('[SyncContext] Erro ao atualizar dispositivo:', error);
  
  }
  }, [dispositivo]);

  // ==========================================================================
  // ATIVAÇÃO DE DISPOSITIVO COM SENHA
  // ==========================================================================

  /**
   * Verifica se o dispositivo precisa de ativação
   * Deve ser chamado após o login bem-sucedido
   */
  const verificarAtivacao = useCallback(async () => {
    console.log('[SyncContext] Verificando necessidade de ativação...');
    
    try {
      const metadata = await databaseService.getSyncMetadata();
      
      // Se já tem deviceId e deviceKey, verificar se está ativo no servidor
      if (metadata.deviceId && metadata.deviceKey) {
        const response = await apiService.verificarStatusDispositivo(metadata.deviceKey);
        
        if (response.success && response.data?.needsActivation) {
          // Dispositivo existe mas precisa de ativação
          setNeedsDeviceActivation(true);
          setDispositivoPendenteId(response.data.dispositivoId || metadata.deviceId);
          console.log('[SyncContext] Dispositivo precisa de ativação');
          return;
        }
        
        // Dispositivo já ativo
        setNeedsDeviceActivation(false);
        setDispositivo({
          id: metadata.deviceId,
          nome: metadata.deviceName || '',
          chave: metadata.deviceKey,
          registrado: true,
        });
        console.log('[SyncContext] Dispositivo já está ativo');
        return;
      }
      
      // Não tem deviceId - precisa cadastrar novo dispositivo
      // Mas primeiro precisa que o admin cadastre no web e forneça a senha
      setNeedsDeviceActivation(true);
      console.log('[SyncContext] Nenhum dispositivo registrado localmente');
      
    } catch (error) {
      console.error('[SyncContext] Erro ao verificar ativação:', error);
      setNeedsDeviceActivation(true);
    }
  }, []);

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
      
      // Salvar informações do dispositivo localmente
      await databaseService.setDeviceId(
        dispositivoId,
        deviceName,
        deviceKey
      );
      
      // BUG FIX: Persistir @device:activated e @device:key no AsyncStorage
      // Isso garante que a ativação persista entre logins
      await AsyncStorage.multiSet([
        ['@device:activated', 'true'],
        ['@device:id', dispositivoId],
        ['@device:key', deviceKey]
      ]);
      
      // Atualizar estado
      setDispositivo({
        id: dispositivoId,
        nome: deviceName,
        chave: deviceKey,
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
          const localDate = new Date(conflito.localVersion.updatedAt);
          const remoteDate = new Date(conflito.remoteVersion.updatedAt);
          versaoFinal = localDate > remoteDate ? conflito.localVersion : conflito.remoteVersion;
          break;
        case 'manual':
          // TODO: Implementar tela de resolução manual
          setErro('Resolução manual deve ser feita pela interface');
          return;
    
  }

      // Salvar versão final no banco local
      await databaseService.save(conflito.entityType, versaoFinal);

      // Remover da lista de conflitos
      setConflitosPendentes(prev => prev.filter(c => c.entityId !== conflitoId));

      // Sincronizar resolução com servidor
      await apiService.resolverConflito({
        conflitoId,
        estrategia,
        versaoFinal,
      });

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
    registrarDispositivo,
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