/**
 * SyncService.ts
 * Serviço de sincronização bidirecional - Mobile <-> Web
 * Arquitetura: Offline-first com SQLite local + PostgreSQL remoto
 *
 * REWRITE NOTES:
 * - Removed auto-sync (moved to SyncContext only)
 * - Removed syncEvents dependency (SyncContext uses syncVersion exclusively)
 * - Added robust error serialization (no more `{}` errors)
 * - Added structured logging for debugging
 * - Kept: mutex, pagination, snapshot recovery, ALLOWED_FIELDS filtering,
 *         batch marking, version updates
 */

import {
  SyncMetadata,
  ChangeLog,
  SyncResponse,
  SyncConflict,
  EntityType,
  UpdatedVersion,
} from '../types';
import { databaseService } from './DatabaseService';
import { apiService } from './ApiService';
import logger from '../utils/logger';

// ============================================================================
// TYPES & INTERFACES
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
// ALLOWED_FIELDS — mirrors backend sync-helpers.ts
// Used to filter outgoing PUSH payload changes to only include fields
// the server accepts, reducing payload size and preventing server-side errors.
// ============================================================================

const ALLOWED_FIELDS: Record<string, Set<string>> = {
  cliente: new Set([
    'tipo', 'tipoPessoa', 'identificador', 'nomeExibicao', 'nomeCompleto',
    'razaoSocial', 'nomeFantasia', 'cpf', 'cnpj', 'rg', 'inscricaoEstadual',
    'email', 'telefonePrincipal', 'contatos', 'cep', 'logradouro', 'numero',
    'complemento', 'bairro', 'cidade', 'estado', 'rotaId', 'rotaNome',
    'latitude', 'longitude',
    'status', 'observacao', 'dataCadastro', 'dataUltimaAlteracao',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  produto: new Set([
    'tipo', 'identificador', 'numeroRelogio', 'tipoId', 'tipoNome',
    'descricaoId', 'descricaoNome', 'tamanhoId', 'tamanhoNome',
    'codigoCH', 'codigoABLF', 'conservacao', 'statusProduto',
    'dataFabricacao', 'dataUltimaManutencao', 'relatorioUltimaManutencao',
    'dataAvaliacao', 'aprovacao', 'estabelecimento', 'observacao', 'dataCadastro',
    'dataUltimaAlteracao',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  locacao: new Set([
    'tipo', 'clienteId', 'clienteNome', 'produtoId', 'produtoIdentificador',
    'produtoTipo', 'dataLocacao', 'dataFim', 'observacao', 'formaPagamento',
    'numeroRelogio', 'precoFicha', 'percentualEmpresa', 'percentualCliente',
    'periodicidade', 'valorFixo', 'dataPrimeiraCobranca', 'status',
    'ultimaLeituraRelogio', 'dataUltimaCobranca', 'trocaPano', 'dataUltimaManutencao',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  cobranca: new Set([
    'tipo', 'locacaoId', 'clienteId', 'clienteNome', 'produtoId',
    'produtoIdentificador', 'dataInicio', 'dataFim', 'dataPagamento',
    'relogioAnterior', 'relogioAtual', 'fichasRodadas', 'valorFicha',
    'totalBruto', 'descontoPartidasQtd', 'descontoPartidasValor', 'descontoDinheiro',
    'percentualEmpresa', 'subtotalAposDescontos', 'valorPercentual',
    'totalClientePaga', 'valorRecebido', 'saldoDevedorGerado',
    'status', 'dataVencimento', 'observacao', 'trocaPano',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  rota: new Set([
    'descricao', 'status', 'cor', 'regiao', 'ordem', 'observacao',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  usuario: new Set([
    'tipo', 'nome', 'cpf', 'telefone', 'email',
    'tipoPermissao', 'permissoesWeb', 'permissoesMobile',
    'rotasPermitidas', 'status', 'bloqueado', 'dataUltimoAcesso', 'ultimoAcessoDispositivo',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  manutencao: new Set([
    'produtoId', 'produtoIdentificador', 'produtoTipo',
    'clienteId', 'clienteNome', 'locacaoId', 'cobrancaId',
    'tipo', 'descricao', 'data', 'registradoPor',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  meta: new Set([
    'nome', 'tipo', 'valorMeta', 'valorAtual',
    'dataInicio', 'dataFim', 'rotaId', 'status', 'criadoPor',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
  historicoRelogio: new Set([
    'produtoId', 'relogioAnterior', 'relogioNovo', 'motivo',
    'dataAlteracao', 'usuarioResponsavel',
  ]),
  tipoProduto: new Set([
    'nome',
  ]),
  descricaoProduto: new Set([
    'nome',
  ]),
  tamanhoProduto: new Set([
    'nome',
  ]),
  estabelecimento: new Set([
    'nome', 'endereco', 'observacao',
    'syncStatus', 'lastSyncedAt', 'needsSync', 'version', 'deviceId',
  ]),
};

// Pull pagination limits
const MAX_PULL_ROUNDS = 20;
const ABSOLUTE_MAX_ROUNDS = 30;

// ============================================================================
// ERROR SERIALIZATION
// ============================================================================

/**
 * Robust error serialization — never produces empty `{}` strings.
 * Handles: Error instances, plain objects, non-enumerable props, HTTP errors.
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

    // Try common error properties in priority order
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

    // Try JSON stringify, but check for empty result
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}' && json !== '""') {
        return json;
      }
    } catch {
      // JSON.stringify can fail on circular refs
    }

    // Last resort: use String() which calls toString()
    const str = String(error);
    if (str && str !== '[object Object]') {
      return str;
    }

    // Extract constructor name for debugging
    const ctorName = error?.constructor?.name;
    if (ctorName && ctorName !== 'Object') {
      return `Erro do tipo ${ctorName} (sem mensagem)`;
    }

    return 'Erro inesperado (objeto sem propriedades serializáveis)';
  }

  return `Erro inesperado: ${String(error)}`;
}

/**
 * Filter change fields to only include allowed fields for the given entity type.
 */
function filterChangeFields(entityType: string, changes: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[entityType];
  if (!allowed) {
    logger.warn(`[Sync] No ALLOWED_FIELDS for entityType "${entityType}" — passing all fields`);
    return changes;
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (allowed.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// ============================================================================
// SYNC SERVICE CLASS
// ============================================================================

class SyncService {
  private syncInProgress = false;
  private syncPromise: Promise<SyncResult> | null = null;
  private listeners: SyncEventListener[] = [];
  private cancellationRequested = false;

  // ==========================================================================
  // LISTENER MANAGEMENT
  // ==========================================================================

  /**
   * Adiciona listener para eventos de progresso de sincronização
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
    for (const listener of this.listeners) {
      try {
        listener(progress);
      } catch (err) {
        logger.error('[Sync] Listener error:', serializeError(err));
      }
    }
  }

  // ==========================================================================
  // MAIN SYNC
  // ==========================================================================

  /**
   * Executa sincronização completa (push + pull).
   *
   * Mutex: if a sync is already in progress, returns the same Promise
   * instead of rejecting. Prevents race conditions between auto-sync,
   * manual sync, and sync-on-resume.
   */
  async sync(): Promise<SyncResult> {
    if (this.syncPromise) {
      logger.warn('[Sync] Sync already in progress — awaiting existing promise');
      return this.syncPromise;
    }

    this.cancellationRequested = false;
    this.syncPromise = this._doSync();
    try {
      return await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  /**
   * Internal sync implementation (called via mutex)
   */
  private async _doSync(): Promise<SyncResult> {
    this.syncInProgress = true;
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;
    let conflicts: SyncConflict[] = [];

    try {
      logger.info('[Sync] Starting sync...');

      // Verify device is registered
      const isRegistered = await this.ensureDeviceRegistered();
      if (!isRegistered) {
        throw new Error('Dispositivo não registrado. Faça login primeiro.');
      }

      // Phase 1: PUSH — send local changes
      this.notify({
        phase: 'pushing',
        total: 0,
        current: 0,
        message: 'Enviando mudanças locais...',
        errors: [],
      });

      const pushResult = await this.pushChanges();
      if (this.cancellationRequested) {
        throw new Error('Sincronização cancelada');
      }
      pushed = pushResult.pushed;
      conflicts = pushResult.conflicts;
      errors.push(...pushResult.errors);

      // Phase 2: PULL — receive remote changes
      this.notify({
        phase: 'pulling',
        total: 0,
        current: 0,
        message: 'Recebendo mudanças do servidor...',
        errors,
      });

      const pullResult = await this.pullChanges();
      if (this.cancellationRequested) {
        throw new Error('Sincronização cancelada');
      }
      pulled = pullResult.pulled;
      errors.push(...pullResult.errors);
      if (pullResult.conflicts && pullResult.conflicts.length > 0) {
        conflicts = [...conflicts, ...pullResult.conflicts];
      }

      // Purge old change logs after successful sync
      try {
        await databaseService.purgeOldChangeLogs(30);
      } catch (purgeError) {
        logger.warn('[Sync] Changelog purge failed:', serializeError(purgeError));
      }

      // Update metadata
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

      logger.info('[Sync] Completed', {
        pushed,
        pulled,
        conflicts: conflicts.length,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        pushed,
        pulled,
        conflicts,
        errors,
        lastSyncAt: now,
      };

    } catch (error) {
      const errorMsg = serializeError(error);
      errors.push(errorMsg);
      logger.error('[Sync] Error:', errorMsg);

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
      this.cancellationRequested = false;
    }
  }

  /**
   * Cancela a sincronização em andamento
   */
  cancelSync(): void {
    this.cancellationRequested = true;
    apiService.cancelScope('sync');
    this.notify({
      phase: 'error',
      total: 0,
      current: 0,
      message: 'Sincronização cancelada',
      errors: ['Sincronização cancelada'],
    });
  }

  // ==========================================================================
  // PUSH
  // ==========================================================================

  /**
   * Envia mudanças locais para o servidor (PUSH)
   */
  async pushChanges(): Promise<{ pushed: number; conflicts: SyncConflict[]; errors: string[] }> {
    const errors: string[] = [];
    let pushed = 0;
    let conflicts: SyncConflict[] = [];

    try {
      const pendingChanges = await databaseService.getPendingChanges();

      if (pendingChanges.length === 0) {
        logger.info('[Sync/Push] No pending changes');
        return { pushed: 0, conflicts: [], errors: [] };
      }

      logger.info('[Sync/Push] Sending changes...', { count: pendingChanges.length });

      const metadata = await databaseService.getSyncMetadata();

      // Filter changes using ALLOWED_FIELDS before sending to server
      const payload = {
        deviceId: metadata.deviceId,
        deviceKey: metadata.deviceKey,
        lastSyncAt: metadata.lastSyncAt,
        changes: pendingChanges.map(change => {
          const rawChanges: Record<string, unknown> = typeof change.changes === 'string'
            ? JSON.parse(change.changes)
            : change.changes;

          const filteredChanges = filterChangeFields(change.entityType, rawChanges);

          return {
            id: change.id,
            entityId: change.entityId,
            entityType: change.entityType,
            operation: change.operation,
            changes: filteredChanges,
            timestamp: change.timestamp,
            deviceId: change.deviceId,
            synced: Boolean(change.synced),
            syncedAt: change.syncedAt || undefined,
          };
        }),
      };

      const response = await apiService.pushChanges(payload);

      if (!response.success) {
        errors.push(...(response.errors || ['Falha ao enviar mudanças']));
        return { pushed: 0, conflicts: [], errors };
      }

      // Process response
      conflicts = response.conflicts || [];

      // Update local versions based on updatedVersions from server
      const updatedVersions = response.updatedVersions || [];
      for (const uv of updatedVersions) {
        try {
          const tableName = this.getTableName(uv.entityType as EntityType);
          if (tableName) {
            await databaseService.runAsync(
              `UPDATE ${tableName} SET version = ? WHERE id = ?`,
              [uv.newVersion, uv.entityId]
            );
          }
        } catch (err) {
          logger.error(`[Sync/Push] Version update error ${uv.entityType}:${uv.entityId}:`, serializeError(err));
        }
      }

      // Batch mark changes as synced
      const changeIds = pendingChanges.map(c => c.id);
      await this.batchMarkAsSynced(changeIds);
      pushed = changeIds.length;

      // Mark entities as synced (batched by entity type)
      await this.markEntitiesAsSynced(pendingChanges);

      logger.info('[Sync/Push] Changes sent', { pushed, conflicts: conflicts.length });

    } catch (error) {
      errors.push(serializeError(error));
      logger.error('[Sync/Push] Error:', serializeError(error));
    }

    return { pushed, conflicts, errors };
  }

  // ==========================================================================
  // PULL
  // ==========================================================================

  /**
   * Recebe mudanças do servidor (PULL)
   * Handles stale device detection, incremental pagination, and snapshot recovery.
   */
  async pullChanges(): Promise<{ pulled: number; errors: string[]; conflicts: SyncConflict[] }> {
    const errors: string[] = [];
    const allConflicts: SyncConflict[] = [];
    let pulled = 0;

    try {
      const metadata = await databaseService.getSyncMetadata();

      const payload = {
        deviceId: metadata.deviceId,
        deviceKey: metadata.deviceKey,
        lastSyncAt: metadata.lastSyncAt || new Date(0).toISOString(),
      };

      // Detect stale device: if lastSyncAt is >30 days old, pull incremental
      // may return empty (because deviceId filter excludes own records).
      // In that case, go straight to snapshot.
      const lastSyncDate = new Date(payload.lastSyncAt);
      const diasOffline = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60 * 24);
      const STALE_THRESHOLD_DAYS = 30;

      if (diasOffline > STALE_THRESHOLD_DAYS) {
        logger.warn(`[Sync/Pull] Stale device (${Math.round(diasOffline)} days offline) — trying snapshot`);

        try {
          const snapshotResult = await this.syncFromSnapshot();
          if (snapshotResult > 0) {
            pulled = snapshotResult;
            logger.info(`[Sync/Pull] Snapshot applied: ${pulled} records`);
          } else {
            logger.warn('[Sync/Pull] Snapshot returned 0 — falling back to incremental');
            const incrementalResult = await this._doIncrementalPull(metadata, payload.lastSyncAt);
            pulled = incrementalResult.pulled;
            errors.push(...incrementalResult.errors);
            if (incrementalResult.conflicts.length > 0) {
              allConflicts.push(...incrementalResult.conflicts);
            }
          }
        } catch (snapError) {
          logger.error('[Sync/Pull] Snapshot failed, falling back to incremental:', serializeError(snapError));
          const incrementalResult = await this._doIncrementalPull(metadata, payload.lastSyncAt);
          pulled = incrementalResult.pulled;
          errors.push(...incrementalResult.errors);
          if (incrementalResult.conflicts.length > 0) {
            allConflicts.push(...incrementalResult.conflicts);
          }
        }

        return { pulled, errors, conflicts: allConflicts };
      }

      // Normal incremental pull (device NOT stale)
      const incrementalResult = await this._doIncrementalPull(metadata, payload.lastSyncAt);
      pulled = incrementalResult.pulled;
      errors.push(...incrementalResult.errors);
      if (incrementalResult.conflicts.length > 0) {
        allConflicts.push(...incrementalResult.conflicts);
      }

    } catch (error) {
      errors.push(serializeError(error));
      logger.error('[Sync/Pull] Error:', serializeError(error));
    }

    return { pulled, errors, conflicts: allConflicts };
  }

  /**
   * Incremental pull with pagination (extracted from pullChanges)
   */
  private async _doIncrementalPull(
    metadata: { deviceId: string; deviceKey: string },
    initialLastSyncAt: string
  ): Promise<{ pulled: number; errors: string[]; conflicts: SyncConflict[] }> {
    const errors: string[] = [];
    const allConflicts: SyncConflict[] = [];
    let pulled = 0;

    try {
      let currentLastSyncAt = initialLastSyncAt;
      const allChanges: any = {
        clientes: [], produtos: [], locacoes: [], cobrancas: [],
        rotas: [], usuarios: [], manutencoes: [], metas: [],
        historicoRelogio: [],
      };
      const allTiposProduto: any[] = [];
      const allDescricoesProduto: any[] = [];
      const allTamanhosProduto: any[] = [];
      const allEstabelecimentos: any[] = [];
      const allUpdatedVersions: UpdatedVersion[] = [];
      let round = 0;
      let hasMore = false;
      let finalLastSyncAt = '';
      let noProgressCount = 0;
      let prevTotal = 0;

      do {
        round++;

        // Hard cap against infinite loops
        if (round > ABSOLUTE_MAX_ROUNDS) {
          logger.error(`[Sync/Pull] ABORT: exceeded absolute max of ${ABSOLUTE_MAX_ROUNDS} rounds`);
          errors.push(`Sincronização abortada: ${ABSOLUTE_MAX_ROUNDS} rodadas excedidas.`);
          logger.warn('[Sync/Pull] Triggering snapshot recovery due to excessive rounds');
          try {
            const snapshotResult = await this.syncFromSnapshot();
            if (snapshotResult) pulled += snapshotResult;
          } catch (snapErr) {
            logger.error('[Sync/Pull] Snapshot recovery also failed:', serializeError(snapErr));
          }
          break;
        }

        const pullPayload = {
          deviceId: metadata.deviceId,
          deviceKey: metadata.deviceKey,
          lastSyncAt: currentLastSyncAt,
        };

        const response = await apiService.pullChanges(pullPayload);

        if (!response.success) {
          errors.push(...(response.errors || ['Falha ao receber mudanças']));
          break;
        }

        // Handle conflicts and errors in PULL response
        if (response.conflicts && response.conflicts.length > 0) {
          allConflicts.push(...response.conflicts);
          logger.warn(`[Sync/Pull] ${response.conflicts.length} conflicts in round ${round}`);
          for (const conflict of response.conflicts) {
            logger.warn(`[Sync/Pull] Conflict: ${conflict.entityType}:${conflict.entityId} — type: ${conflict.conflictType}`);
          }
        }
        if (response.errors && response.errors.length > 0) {
          errors.push(...response.errors);
          logger.warn(`[Sync/Pull] ${response.errors.length} errors in round ${round}:`, response.errors);
        }

        // Collect updatedVersions from PULL response
        if (response.updatedVersions && response.updatedVersions.length > 0) {
          allUpdatedVersions.push(...response.updatedVersions);
        }

        const changes = response.changes || {};

        // Accumulate changes per entity type
        const changeKeys = ['clientes', 'produtos', 'locacoes', 'cobrancas', 'rotas', 'usuarios', 'manutencoes', 'metas', 'historicoRelogio'] as const;
        for (const key of changeKeys) {
          if (changes[key] && Array.isArray(changes[key])) {
            allChanges[key].push(...changes[key]!);
          }
        }

        // Accumulate auxiliary data
        if (response.tiposProduto) allTiposProduto.push(...response.tiposProduto);
        if (response.descricoesProduto) allDescricoesProduto.push(...response.descricoesProduto);
        if (response.tamanhosProduto) allTamanhosProduto.push(...response.tamanhosProduto);
        if (response.estabelecimentos) allEstabelecimentos.push(...response.estabelecimentos);

        // Update cursor for next page
        finalLastSyncAt = response.lastSyncAt || finalLastSyncAt;
        hasMore = response.hasMore || false;
        currentLastSyncAt = finalLastSyncAt;

        // Detect no-progress loops (hasMore=true but no new data)
        const currentTotal =
          allChanges.clientes.length + allChanges.produtos.length +
          allChanges.locacoes.length + allChanges.cobrancas.length +
          allChanges.rotas.length + allChanges.usuarios.length +
          allChanges.manutencoes.length + allChanges.metas.length +
          allChanges.historicoRelogio.length;
        if (currentTotal === prevTotal && hasMore) {
          noProgressCount++;
          if (noProgressCount >= 3) {
            logger.error(`[Sync/Pull] ABORT: ${noProgressCount} rounds with hasMore=true but no new data`);
            errors.push('Sincronização parcial: servidor reportando dados pendentes mas não enviando novos registros');
            break;
          }
        } else {
          noProgressCount = 0;
        }
        prevTotal = currentTotal;

        if (round >= MAX_PULL_ROUNDS && hasMore) {
          logger.warn(`[Sync/Pull] Reached limit of ${MAX_PULL_ROUNDS} rounds — hasMore=true but stopping`);
          errors.push(`Sincronização parcial: ${MAX_PULL_ROUNDS} rodadas atingidas, dados restantes na próxima vez`);
          break;
        }
      } while (hasMore);

      // Count total changes
      pulled =
        allChanges.clientes.length +
        allChanges.produtos.length +
        allChanges.locacoes.length +
        allChanges.cobrancas.length +
        allChanges.rotas.length +
        allChanges.usuarios.length +
        allChanges.manutencoes.length +
        allChanges.metas.length +
        allChanges.historicoRelogio.length +
        allEstabelecimentos.length;

      // Apply updatedVersions from PULL response
      if (allUpdatedVersions.length > 0) {
        logger.info(`[Sync/Pull] Applying ${allUpdatedVersions.length} version updates from server`);
        for (const uv of allUpdatedVersions) {
          try {
            const tableName = this.getTableName(uv.entityType as EntityType);
            if (tableName) {
              await databaseService.runAsync(
                `UPDATE ${tableName} SET version = ? WHERE id = ?`,
                [uv.newVersion, uv.entityId]
              );
            }
          } catch (err) {
            logger.error(`[Sync/Pull] Version update error ${uv.entityType}:${uv.entityId}:`, serializeError(err));
          }
        }
      }

      // Apply accumulated changes if any
      if (pulled > 0) {
        await databaseService.applyRemoteChanges({
          success: true,
          lastSyncAt: finalLastSyncAt || new Date().toISOString(),
          changes: allChanges,
          tiposProduto: allTiposProduto,
          descricoesProduto: allDescricoesProduto,
          tamanhosProduto: allTamanhosProduto,
          estabelecimentos: allEstabelecimentos,
        });
      }

      // Detailed log for debugging
      logger.info('[Sync/Pull] Changes received', {
        pulled,
        rounds: round,
        conflicts: allConflicts.length,
        clientes: allChanges.clientes.length,
        produtos: allChanges.produtos.length,
        locacoes: allChanges.locacoes.length,
        cobrancas: allChanges.cobrancas.length,
        rotas: allChanges.rotas.length,
        usuarios: allChanges.usuarios.length,
        manutencoes: allChanges.manutencoes.length,
        metas: allChanges.metas.length,
        estabelecimentos: allEstabelecimentos.length,
        tiposProduto: allTiposProduto.length,
        descricoesProduto: allDescricoesProduto.length,
        tamanhosProduto: allTamanhosProduto.length,
      });

    } catch (error) {
      errors.push(serializeError(error));
      logger.error('[Sync/Pull] Error:', serializeError(error));
    }

    return { pulled, errors, conflicts: allConflicts };
  }

  // ==========================================================================
  // DEVICE REGISTRATION
  // ==========================================================================

  /**
   * Garante que o dispositivo está registrado.
   * NOTE: registerDevice() removed — activation is now via PIN on DeviceActivationScreen.
   */
  async ensureDeviceRegistered(): Promise<boolean> {
    try {
      const metadata = await databaseService.getSyncMetadata();
      if (metadata.deviceId && metadata.deviceKey) {
        return true;
      }
      logger.warn('[Sync] Device not registered — activation via PIN required');
      return false;
    } catch (error) {
      logger.error('[Sync] Device registration check error:', serializeError(error));
      return false;
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Batch mark change logs as synced — single SQL statement.
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
      logger.error('[Sync] Batch mark synced failed, falling back to individual:', serializeError(error));
      for (const id of changeIds) {
        try {
          await databaseService.markAsSynced(id);
        } catch (err) {
          logger.error(`[Sync] Individual mark synced ${id} failed:`, serializeError(err));
        }
      }
    }
  }

  /**
   * Marca entidades locais como sincronizadas (batched by entity type)
   */
  private async markEntitiesAsSynced(changes: ChangeLog[]): Promise<void> {
    if (changes.length === 0) return;

    const byType: Record<string, string[]> = {};
    for (const change of changes) {
      if (!byType[change.entityType]) byType[change.entityType] = [];
      byType[change.entityType].push(change.entityId);
    }

    const now = new Date().toISOString();

    for (const [entityType, ids] of Object.entries(byType)) {
      try {
        const tableName = this.getTableName(entityType as EntityType);
        if (tableName) {
          const placeholders = ids.map(() => '?').join(',');
          await databaseService.runAsync(
            `UPDATE ${tableName} SET syncStatus = 'synced', lastSyncedAt = ?, needsSync = 0 WHERE id IN (${placeholders})`,
            [now, ...ids]
          );
        }
      } catch (error) {
        logger.error(`[Sync] Batch entity sync mark failed for ${entityType}:`, serializeError(error));
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
      historicoRelogio: 'historico_relogio',
      tipoProduto: 'tipos_produto',
      descricaoProduto: 'descricoes_produto',
      tamanhoProduto: 'tamanhos_produto',
      estabelecimento: 'estabelecimentos',
    };
    return tableMap[entityType];
  }

  /**
   * Sincroniza a partir de snapshot completo (para device stale).
   * Busca todos os dados ativos do servidor e aplica localmente.
   */
  async syncFromSnapshot(): Promise<number> {
    try {
      const metadata = await databaseService.getSyncMetadata();
      if (!metadata.deviceId || !metadata.deviceKey) {
        logger.error('[Sync/Snapshot] Device not registered');
        return 0;
      }

      logger.info('[Sync/Snapshot] Fetching full snapshot...');
      const response = await apiService.getSnapshot(metadata.deviceId, metadata.deviceKey);

      if (!response.success || !response.data?.snapshot) {
        logger.error('[Sync/Snapshot] Failed:', response.error);
        return 0;
      }

      const snapshot = response.data.snapshot;
      const total =
        (snapshot.clientes?.length || 0) +
        (snapshot.produtos?.length || 0) +
        (snapshot.locacoes?.length || 0) +
        (snapshot.cobrancas?.length || 0) +
        (snapshot.rotas?.length || 0) +
        (snapshot.usuarios?.length || 0) +
        (snapshot.manutencoes?.length || 0) +
        (snapshot.metas?.length || 0) +
        (snapshot.historicoRelogio?.length || 0);

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
          manutencoes: snapshot.manutencoes || [],
          metas: snapshot.metas || [],
          historicoRelogio: snapshot.historicoRelogio || [],
        },
        tiposProduto: snapshot.tiposProduto || [],
        descricoesProduto: snapshot.descricoesProduto || [],
        tamanhosProduto: snapshot.tamanhosProduto || [],
        estabelecimentos: snapshot.estabelecimentos || [],
      });

      logger.info('[Sync/Snapshot] Applied', { total });
      return total;
    } catch (error) {
      logger.error('[Sync/Snapshot] Error:', serializeError(error));
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
    logger.info('[Sync] Starting full sync...');

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
      logger.error('[Sync] Conflict resolution error:', serializeError(error));
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
      logger.error('[Sync] Pending conflicts fetch error:', serializeError(error));
      return [];
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const syncService = new SyncService();
export default syncService;
