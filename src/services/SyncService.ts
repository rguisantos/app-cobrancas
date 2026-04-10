/**
 * SyncService.ts
 * Serviço de sincronização bidirecional - Mobile ↔ Web
 * Arquitetura: Offline-first com SQLite local + PostgreSQL remoto
 */

import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  SyncMetadata, 
  ChangeLog, 
  SyncResponse, 
  SyncConflict,
  EntityType 
} from '../types';
import { databaseService } from './DatabaseService';
import { apiService } from './ApiService';
import { ENV } from '../config/env';
import logger from '../utils/logger';

// Chave do token no AsyncStorage (mesma do AuthContext)
const TOKEN_KEY = '@cobrancas:token';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface SyncProgress {
  phase: 'idle' | 'pushing' | 'pulling' | 'completed' | 'error';
  total: number;
  current: number;
  message: string;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: SyncConflict[];
  errors: string[];
  lastSyncAt: string;
}

type SyncEventListener = (progress: SyncProgress) => void;

// ============================================================================
// CLASSE SYNC SERVICE
// ============================================================================

class SyncService {
  private syncInProgress = false;
  private listeners: SyncEventListener[] = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;

  // ==========================================================================
  // CONFIGURAÇÃO
  // ==========================================================================

  /**
   * Adiciona listener para eventos de sincronização
   */
  addListener(listener: SyncEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifica listeners sobre progresso
   */
  private notify(progress: SyncProgress): void {
    this.listeners.forEach(listener => listener(progress));
  }

  /**
   * Inicia sincronização automática
   */
  startAutoSync(intervalMinutes: number = ENV.SYNC_INTERVAL): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }

    this.autoSyncInterval = setInterval(() => {
      this.sync();
    }, intervalMinutes * 60 * 1000);

    logger.info('[Sync] Auto-sync iniciado', { intervalMinutes });
  }

  /**
   * Para sincronização automática
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      logger.info('[Sync] Auto-sync parado');
    }
  }

  // ==========================================================================
  // SINCRONIZAÇÃO PRINCIPAL
  // ==========================================================================

  /**
   * Executa sincronização completa (push + pull)
   */
  async sync(): Promise<SyncResult> {
    // Evitar sync simultâneo
    if (this.syncInProgress) {
      logger.warn('[Sync] Sincronização já em andamento');
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts: [],
        errors: ['Sincronização já em andamento'],
        lastSyncAt: new Date().toISOString(),
      };
    }

    this.syncInProgress = true;
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;
    let conflicts: SyncConflict[] = [];

    try {
      logger.info('[Sync] Iniciando sincronização...');

      // IMPORTANTE: Sincronizar token do AsyncStorage com ApiService
      // Isso garante que o token de autenticação esteja disponível para as requisições
      try {
        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (savedToken) {
          apiService.setToken(savedToken);
          logger.info('[Sync] Token sincronizado com ApiService');
        } else {
          logger.warn('[Sync] ⚠️ Nenhum token encontrado no AsyncStorage');
        }
      } catch (tokenError) {
        logger.error('[Sync] Erro ao sincronizar token:', tokenError);
      }

      // Verificar se o dispositivo está registrado
      const isRegistered = await this.ensureDeviceRegistered();
      if (!isRegistered) {
        throw new Error('Dispositivo não registrado. Faça login primeiro.');
      }

      // Fase 1: PUSH - Enviar mudanças locais
      this.notify({
        phase: 'pushing',
        total: 0,
        current: 0,
        message: 'Enviando mudanças locais...',
        errors: [],
      });

      const pushResult = await this.pushChanges();
      pushed = pushResult.pushed;
      conflicts = pushResult.conflicts;
      errors.push(...pushResult.errors);

      // Fase 2: PULL - Receber mudanças remotas
      this.notify({
        phase: 'pulling',
        total: 0,
        current: 0,
        message: 'Recebendo mudanças do servidor...',
        errors,
      });

      const pullResult = await this.pullChanges();
      pulled = pullResult.pulled;
      errors.push(...pullResult.errors);

      // Atualizar metadata
      const now = new Date().toISOString();
      await databaseService.updateSyncMetadata({
        lastSyncAt: now,
        lastPushAt: now,
        lastPullAt: now,
        syncInProgress: false,
      });

      this.notify({
        phase: 'completed',
        total: pushed + pulled,
        current: pushed + pulled,
        message: 'Sincronização concluída!',
        errors,
      });

      logger.info('[Sync] Sincronização concluída', { pushed, pulled, conflicts: conflicts.length });

      return {
        success: errors.length === 0,
        pushed,
        pulled,
        conflicts,
        errors,
        lastSyncAt: now,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      errors.push(errorMsg);
      logger.error('[Sync] Erro na sincronização:', error);

      this.notify({
        phase: 'error',
        total: 0,
        current: 0,
        message: errorMsg,
        errors,
      });

      return {
        success: false,
        pushed,
        pulled,
        conflicts,
        errors,
        lastSyncAt: new Date().toISOString(),
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Envia mudanças locais para o servidor (PUSH)
   */
  async pushChanges(): Promise<{ pushed: number; conflicts: SyncConflict[]; errors: string[] }> {
    const errors: string[] = [];
    let pushed = 0;
    let conflicts: SyncConflict[] = [];

    try {
      // IMPORTANTE: Sincronizar token antes de cada requisição
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        apiService.setToken(savedToken);
        logger.info('[Sync/Push] Token sincronizado com ApiService');
      } else {
        logger.error('[Sync/Push] ❌ Token NÃO encontrado no AsyncStorage!');
      }

      // Buscar mudanças pendentes
      const pendingChanges = await databaseService.getPendingChanges();
      
      if (pendingChanges.length === 0) {
        logger.info('[Sync/Push] Nenhuma mudança pendente');
        return { pushed: 0, conflicts: [], errors: [] };
      }

      logger.info('[Sync/Push] Enviando mudanças...', { count: pendingChanges.length });

      // Preparar payload
      const metadata = await databaseService.getSyncMetadata();
      
      // Converter tipos do SQLite para tipos esperados pela API
      const payload = {
        deviceId: metadata.deviceId,
        deviceKey: metadata.deviceKey,
        lastSyncAt: metadata.lastSyncAt,
        changes: pendingChanges.map(change => ({
          id: change.id,
          entityId: change.entityId,
          entityType: change.entityType,
          operation: change.operation,
          // Converter changes de string JSON para objeto
          changes: typeof change.changes === 'string' 
            ? JSON.parse(change.changes) 
            : change.changes,
          timestamp: change.timestamp,
          deviceId: change.deviceId,
          // Converter synced de number (0/1) para boolean
          synced: Boolean(change.synced),
          // Converter syncedAt null para undefined
          syncedAt: change.syncedAt || undefined,
        })),
      };

      logger.info('[Sync/Push] Payload preparado:', {
        deviceId: payload.deviceId,
        changesCount: payload.changes.length,
        firstChange: payload.changes[0] ? {
          entityType: payload.changes[0].entityType,
          operation: payload.changes[0].operation,
          entityId: payload.changes[0].entityId,
        } : null,
      });

      // Enviar para o servidor
      const response = await apiService.pushChanges(payload);

      if (!response.success) {
        errors.push(...(response.errors || ['Falha ao enviar mudanças']));
        return { pushed: 0, conflicts: [], errors };
      }

      // Processar resposta
      conflicts = response.conflicts || [];
      
      // Marcar mudanças como sincronizadas
      for (const change of pendingChanges) {
        await databaseService.markAsSynced(change.id);
        pushed++;
      }

      // Atualizar status das entidades locais
      await this.markEntitiesAsSynced(pendingChanges);

      logger.info('[Sync/Push] Mudanças enviadas', { pushed, conflicts: conflicts.length });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro no push';
      errors.push(errorMsg);
      logger.error('[Sync/Push] Erro:', error);
    }

    return { pushed, conflicts, errors };
  }

  /**
   * Recebe mudanças do servidor (PULL)
   */
  async pullChanges(): Promise<{ pulled: number; errors: string[] }> {
    const errors: string[] = [];
    let pulled = 0;

    try {
      // IMPORTANTE: Sincronizar token antes de cada requisição
      const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        apiService.setToken(savedToken);
        logger.info('[Sync/Pull] Token sincronizado com ApiService');
      } else {
        logger.error('[Sync/Pull] ❌ Token NÃO encontrado no AsyncStorage!');
      }

      const metadata = await databaseService.getSyncMetadata();
      
      const payload = {
        deviceId: metadata.deviceId,
        deviceKey: metadata.deviceKey,
        lastSyncAt: metadata.lastSyncAt || new Date(0).toISOString(),
      };

      logger.info('[Sync/Pull] Buscando mudanças...', { lastSyncAt: payload.lastSyncAt });

      const response = await apiService.pullChanges(payload);

      if (!response.success) {
        errors.push(...(response.errors || ['Falha ao receber mudanças']));
        return { pulled: 0, errors };
      }

      // Contar mudanças recebidas
      const changes = response.changes || {};
      pulled = 
        (changes.clientes?.length || 0) +
        (changes.produtos?.length || 0) +
        (changes.locacoes?.length || 0) +
        (changes.cobrancas?.length || 0) +
        (changes.rotas?.length || 0) +
        ((changes as any).usuarios?.length || 0);  // Incluir usuários

      // Avisar se o dispositivo está muito tempo sem sync (servidor truncou o payload)
      if ((response as any).isStale) {
        logger.warn(
          '[Sync/Pull] AVISO: dispositivo sem sync há mais de 30 dias. ' +
          'Dados podem estar incompletos — considere forçar um resync completo.'
        );
        this.notify({
          phase: 'pull',
          total: pulled,
          current: pulled,
          message: '⚠️ Dispositivo desatualizado — alguns dados podem estar incompletos. Sincronize com frequência.',
          errors: [],
        });
      }

      if (pulled > 0) {
        logger.info('[Sync/Pull] Aplicando mudanças...', { count: pulled });
        await databaseService.applyRemoteChanges(response);
      }

      logger.info('[Sync/Pull] Mudanças recebidas', { pulled });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro no pull';
      errors.push(errorMsg);
      logger.error('[Sync/Pull] Erro:', error);
    }

    return { pulled, errors };
  }

  // ==========================================================================
  // REGISTRO DO DISPOSITIVO
  // ==========================================================================

  /**
   * Garante que o dispositivo está registrado
   */
  async ensureDeviceRegistered(): Promise<boolean> {
    try {
      const metadata = await databaseService.getSyncMetadata();
      
      // Se já tem deviceId e deviceKey no SyncMetadata, verificar se ainda é válido
      if (metadata.deviceId && metadata.deviceKey) {
        logger.info('[Sync] Dispositivo já registrado no SyncMetadata:', {
          deviceId: metadata.deviceId,
          deviceKey: metadata.deviceKey.substring(0, 20) + '...'
        });
        return true;
      }

      // Verificar se existe deviceKey no AsyncStorage (salvo pelo DeviceActivationScreen)
      const savedDeviceKey = await AsyncStorage.getItem('@device:key');
      const savedDeviceId = await AsyncStorage.getItem('@device:id');
      const savedDeviceName = await AsyncStorage.getItem('@device:name');
      
      if (savedDeviceId && savedDeviceKey) {
        logger.info('[Sync] Encontrado deviceKey no AsyncStorage, sincronizando com SyncMetadata...');
        // Salvar no SyncMetadata para uso futuro
        await databaseService.setDeviceId(savedDeviceId, savedDeviceName || 'Dispositivo', savedDeviceKey);
        logger.info('[Sync] SyncMetadata atualizado com deviceKey do AsyncStorage');
        return true;
      }

      // Se não tem deviceKey em nenhum lugar, precisa registrar
      // Mas isso só deve acontecer se o dispositivo ainda não foi ativado
      logger.warn('[Sync] Dispositivo não registrado. Precisa de ativação.');
      return false;
    } catch (error) {
      logger.error('[Sync] Erro ao verificar registro:', error);
      return false;
    }
  }

  /**
   * Registra o dispositivo no servidor
   */
  async registerDevice(): Promise<boolean> {
    try {
      logger.info('[Sync] ====== INICIANDO REGISTRO DE DISPOSITIVO ======');

      // Gerar ID e chave únicos
      const deviceId = await this.generateDeviceId();
      const deviceKey = await this.generateDeviceKey();
      const deviceName = await this.getDeviceName();
      const deviceType = this.getDeviceType();

      logger.info('[Sync] Dados do dispositivo gerados:', {
        deviceId,
        deviceKey: deviceKey.substring(0, 20) + '...',
        deviceName,
        deviceType,
      });

      // Registrar no servidor (endpoint não requer autenticação)
      logger.info('[Sync] Enviando requisição para API...');
      const response = await apiService.registrarEquipamento({
        id: deviceId,
        nome: deviceName,
        chave: deviceKey,
        tipo: deviceType,
        dataCadastro: new Date().toISOString(),
      });

      logger.info('[Sync] Resposta da API:', {
        success: response.success,
        error: response.error,
        statusCode: response.statusCode,
        data: response.data,
      });

      if (!response.success) {
        logger.error('[Sync] Falha ao registrar dispositivo:', response.error);
        return false;
      }

      // Salvar localmente
      await databaseService.setDeviceId(deviceId, deviceName, deviceKey);

      logger.info('[Sync] ====== DISPOSITIVO REGISTRADO COM SUCESSO ======', { deviceId, deviceName });

      return true;
    } catch (error) {
      logger.error('[Sync] ERRO CRÍTICO ao registrar dispositivo:', error);
      return false;
    }
  }

  /**
   * Gera ID único do dispositivo
   */
  private async generateDeviceId(): Promise<string> {
    const existingId = await databaseService.getDeviceId();
    if (existingId) return existingId;

    // Usar timestamp + random como ID único
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    
    return `dev_${timestamp}_${random}`;
  }

  /**
   * Gera chave única do dispositivo
   */
  private async generateDeviceKey(): Promise<string> {
    // Usar modelo + OS + timestamp
    let model = 'unknown';
    let os = 'unknown';
    
    try {
      model = (Device as any).modelName || (Device as any).deviceName || 'device';
      os = (Device as any).osName || 'mobile';
    } catch {
      // Ignorar erros
    }
    
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    
    return `${model}_${os}_${timestamp}_${random}`.replace(/\s+/g, '_').toLowerCase();
  }

  /**
   * Obtém nome do dispositivo
   */
  private async getDeviceName(): Promise<string> {
    let deviceName = 'Dispositivo';
    let model = '';
    
    try {
      deviceName = (Device as any).deviceName || (Device as any).modelName || 'Dispositivo';
      model = (Device as any).modelName || '';
    } catch {
      // Ignorar erros
    }
    
    return model ? `${deviceName} (${model})` : deviceName;
  }

  /**
   * Determina tipo do dispositivo
   */
  private getDeviceType(): 'Celular' | 'Tablet' | 'Outro' {
    // Fallback simples: assumir celular
    return 'Celular';
  }

  // ==========================================================================
  // AUXILIARES
  // ==========================================================================

  /**
   * Marca entidades locais como sincronizadas
   */
  private async markEntitiesAsSynced(changes: ChangeLog[]): Promise<void> {
    for (const change of changes) {
      try {
        const tableName = this.getTableName(change.entityType);
        const now = new Date().toISOString();

        await databaseService.runAsync(
          `UPDATE ${tableName} 
           SET syncStatus = 'synced', 
               lastSyncedAt = ?, 
               needsSync = 0 
           WHERE id = ?`,
          [now, change.entityId]
        );
      } catch (error) {
        logger.error(`[Sync] Erro ao marcar ${change.entityType}:${change.entityId}:`, error);
      }
    }
  }

  /**
   * Mapeia tipo de entidade para nome da tabela
   */
  private getTableName(entityType: EntityType): string {
    const tableMap: Record<EntityType, string> = {
      cliente: 'clientes',
      produto: 'produtos',
      locacao: 'locacoes',
      cobranca: 'cobrancas',
      rota: 'rotas',
      usuario: 'usuarios',
    };
    return tableMap[entityType];
  }

  /**
   * Verifica status da sincronização
   */
  async getSyncStatus(): Promise<{
    isSyncing: boolean;
    lastSyncAt: string | null;
    pendingChanges: number;
    deviceId: string | null;
  }> {
    const metadata = await databaseService.getSyncMetadata();
    const pendingChanges = (await databaseService.getPendingChanges()).length;

    return {
      isSyncing: this.syncInProgress,
      lastSyncAt: metadata.lastSyncAt || null,
      pendingChanges,
      deviceId: metadata.deviceId || null,
    };
  }

  /**
   * Força sincronização completa (re-download de todos os dados)
   */
  async fullSync(): Promise<SyncResult> {
    logger.info('[Sync] Iniciando sincronização completa...');

    // Resetar metadata para forçar download completo
    await databaseService.updateSyncMetadata({
      lastSyncAt: new Date(0).toISOString(),
    });

    return this.sync();
  }

  /**
   * Verifica se há conexão com o servidor
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await apiService.healthCheck();
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Resolve conflito de sincronização
   */
  async resolveConflict(
    conflictId: string,
    strategy: 'local' | 'remote' | 'newest' | 'manual',
    finalVersion?: any
  ): Promise<boolean> {
    try {
      const response = await apiService.resolverConflito({
        conflitoId: conflictId,
        estrategia: strategy,
        versaoFinal: finalVersion,
      });

      return response.success;
    } catch (error) {
      logger.error('[Sync] Erro ao resolver conflito:', error);
      return false;
    }
  }

  /**
   * Busca conflitos pendentes
   */
  async getPendingConflicts(): Promise<SyncConflict[]> {
    try {
      const metadata = await databaseService.getSyncMetadata();
      const response = await apiService.getConflitosPendentes(metadata.deviceId);
      
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      logger.error('[Sync] Erro ao buscar conflitos:', error);
      return [];
    }
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const syncService = new SyncService();
export default syncService;
