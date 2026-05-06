/**
 * SyncService.ts
 * Serviço de sincronização bidirecional - Mobile ↔ Web
 * Arquitetura: Offline-first com SQLite local + PostgreSQL remoto
 */

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
  private syncPromise: Promise<SyncResult> | null = null;
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
    // CORREÇÃO: Mutex baseado em Promise — se já existe sync em andamento,
    // aguardar a mesma Promise em vez de rejeitar. Evita race condition
    // entre auto-sync, sync manual e sync on resume.
    if (this.syncPromise) {
      logger.warn('[Sync] Sincronização já em andamento — aguardando conclusão');
      return this.syncPromise;
    }

    this.syncPromise = this._doSync();
    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  /**
   * Implementação interna da sincronização (chamada via mutex)
   */
  private async _doSync(): Promise<SyncResult> {
    this.syncInProgress = true;
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;
    let conflicts: SyncConflict[] = [];

    try {
      logger.info('[Sync] Iniciando sincronização...');

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

      // Purge old change logs after successful sync
      try {
        await databaseService.purgeOldChangeLogs(30);
      } catch (purgeError) {
        logger.warn('[Sync] Falha no purge de changelogs:', purgeError);
      }

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

      logger.info('[Sync] Concluída', { pushed, pulled, conflicts: conflicts.length });

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
      logger.error('[Sync] Erro:', error);

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

      // Enviar para o servidor
      const response = await apiService.pushChanges(payload);

      if (!response.success) {
        errors.push(...(response.errors || ['Falha ao enviar mudanças']));
        return { pushed: 0, conflicts: [], errors };
      }

      // Processar resposta
      conflicts = response.conflicts || [];
      
      // CORREÇÃO: Atualizar versões locais com base no updatedVersions retornado pelo servidor
      const updatedVersions = response.updatedVersions || [];
      for (const uv of updatedVersions) {
        try {
          const tableName = this.getTableName(uv.entityType as EntityType);
          await databaseService.runAsync(
            `UPDATE ${tableName} SET version = ? WHERE id = ?`,
            [uv.newVersion, uv.entityId]
          );
        } catch (err) {
          logger.error(`[Sync/Push] Erro ao atualizar versão de ${uv.entityType}:${uv.entityId}:`, err);
        }
      }

      // Batch mark changes as synced
      const changeIds = pendingChanges.map(c => c.id);
      await this.batchMarkAsSynced(changeIds);
      pushed = changeIds.length;

      // Atualizar status das entidades locais (batched)
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
      const metadata = await databaseService.getSyncMetadata();
      
      const payload = {
        deviceId: metadata.deviceId,
        deviceKey: metadata.deviceKey,
        lastSyncAt: metadata.lastSyncAt || new Date(0).toISOString(),
      };

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
        (changes.usuarios?.length || 0);

      // Avisar se o dispositivo está muito tempo sem sync (servidor truncou o payload)
      if (response.isStale) {
        logger.warn(
          '[Sync/Pull] AVISO: dispositivo sem sync há mais de 30 dias. ' +
          'Dados podem estar incompletos — usando snapshot para resync completo.'
        );
        this.notify({
          phase: 'pull',
          total: pulled,
          current: pulled,
          message: 'Dispositivo desatualizado — sincronizando snapshot completo...',
          errors: [],
        });
        // CORREÇÃO: Buscar snapshot completo para device estale
        const snapshotResult = await this.syncFromSnapshot();
        if (snapshotResult) {
          pulled += snapshotResult;
        }
      }

      if (pulled > 0) {
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
        return true;
      }

      // Verificar se existe deviceKey no AsyncStorage (salvo pelo DeviceActivationScreen)
      const savedDeviceKey = await AsyncStorage.getItem('@device:key');
      const savedDeviceId = await AsyncStorage.getItem('@device:id');
      const savedDeviceName = await AsyncStorage.getItem('@device:name');
      
      if (savedDeviceId && savedDeviceKey) {
        // Salvar no SyncMetadata para uso futuro
        await databaseService.setDeviceId(savedDeviceId, savedDeviceName || 'Dispositivo', savedDeviceKey);
        return true;
      }

      // Se não tem deviceKey em nenhum lugar, precisa de ativação
      logger.warn('[Sync] Dispositivo não registrado. Precisa de ativação via PIN.');
      return false;
    } catch (error) {
      logger.error('[Sync] Erro ao verificar registro:', error);
      return false;
    }
  }

  // NOTE: registerDevice() and its helper methods (generateDeviceId, generateDeviceKey,
  // getDeviceName, getDeviceType) have been REMOVED.
  // The new activation flow is:
  //   1. Admin creates device on web panel (with DEV-XXXXXX key and 6-digit PIN)
  //   2. Mobile activates via POST /api/dispositivos/ativar (using key + PIN)
  // See: DeviceActivationScreen, ativarDispositivo() in ApiService.

  // ==========================================================================
  // AUXILIARES
  // ==========================================================================

  /**
   * Batch mark change logs as synced — single SQL statement instead of N individual calls.
   */
  private async batchMarkAsSynced(changeIds: string[]): Promise<void> {
    if (changeIds.length === 0) return;
    try {
      const now = new Date().toISOString();
      const placeholders = changeIds.map(() => '?').join(',');
      await databaseService.runAsync(
        `UPDATE change_log SET synced = 1, syncedAt = ? WHERE id IN (${placeholders})`,
        [now, ...changeIds]
      );
    } catch (error) {
      logger.error('[Sync] Erro ao marcar changelogs como sincronizados (batch):', error);
      // Fallback: mark one by one
      for (const id of changeIds) {
        try {
          await databaseService.markAsSynced(id);
        } catch (err) {
          logger.error(`[Sync] Erro ao marcar changelog ${id}:`, err);
        }
      }
    }
  }

  /**
   * Marca entidades locais como sincronizadas (batched by entity type)
   */
  private async markEntitiesAsSynced(changes: ChangeLog[]): Promise<void> {
    if (changes.length === 0) return;

    // Group by entity type
    const byType: Record<string, string[]> = {};
    for (const change of changes) {
      if (!byType[change.entityType]) byType[change.entityType] = [];
      byType[change.entityType].push(change.entityId);
    }

    const now = new Date().toISOString();

    // Batch update per type
    for (const [entityType, ids] of Object.entries(byType)) {
      try {
        const tableName = this.getTableName(entityType as EntityType);
        const placeholders = ids.map(() => '?').join(',');
        await databaseService.runAsync(
          `UPDATE ${tableName} SET syncStatus = 'synced', lastSyncedAt = ?, needsSync = 0 WHERE id IN (${placeholders})`,
          [now, ...ids]
        );
      } catch (error) {
        logger.error(`[Sync] Erro ao marcar ${entityType} como synced (batch):`, error);
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
      manutencao: 'manutencoes',
      meta: 'metas',
    };
    return tableMap[entityType];
  }

  /**
   * CORREÇÃO: Sincroniza a partir de snapshot completo (para device estale)
   * Busca todos os dados ativos do servidor e aplica localmente
   */
  async syncFromSnapshot(): Promise<number> {
    try {
      const metadata = await databaseService.getSyncMetadata();
      if (!metadata.deviceId || !metadata.deviceKey) {
        logger.error('[Sync/Snapshot] Dispositivo não registrado');
        return 0;
      }

      logger.info('[Sync/Snapshot] Buscando snapshot completo...');
      const response = await apiService.getSnapshot(metadata.deviceId, metadata.deviceKey);

      if (!response.success || !response.data?.snapshot) {
        logger.error('[Sync/Snapshot] Falha ao buscar snapshot:', response.error);
        return 0;
      }

      const snapshot = response.data.snapshot;
      const total = 
        (snapshot.clientes?.length || 0) +
        (snapshot.produtos?.length || 0) +
        (snapshot.locacoes?.length || 0) +
        (snapshot.cobrancas?.length || 0) +
        (snapshot.rotas?.length || 0);

      // Aplicar como mudanças remotas
      await databaseService.applyRemoteChanges({
        success: true,
        lastSyncAt: response.data.lastSyncAt,
        changes: {
          clientes: snapshot.clientes || [],
          produtos: snapshot.produtos || [],
          locacoes: snapshot.locacoes || [],
          cobrancas: snapshot.cobrancas || [],
          rotas: snapshot.rotas || [],
          usuarios: snapshot.usuarios || [],
        },
        tiposProduto: snapshot.tiposProduto || [],
        descricoesProduto: snapshot.descricoesProduto || [],
        tamanhosProduto: snapshot.tamanhosProduto || [],
      });

      logger.info('[Sync/Snapshot] Snapshot aplicado', { total });
      return total;
    } catch (error) {
      logger.error('[Sync/Snapshot] Erro:', error);
      return 0;
    }
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
