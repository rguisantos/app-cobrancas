/**
 * SyncService.ts
 * Serviço de sincronização bidirecional - Mobile ↔ Web
 * Arquitetura: Offline-first com SQLite local + PostgreSQL remoto
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
// FIX #4: ALLOWED_FIELDS — mirrors backend sync-helpers.ts ALLOWED_FIELDS
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

/**
 * Filter change fields to only include allowed fields for the given entity type.
 * Removes fields like 'id', 'createdAt', 'cpfCnpj', 'rgIe', 'locacaoAtiva', 'estaLocado'
 * that the server would reject or ignore.
 */
function filterChangeFields(entityType: string, changes: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[entityType];
  if (!allowed) {
    // Unknown entity type — pass through unchanged (backward compat)
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
// CLASSE SYNC SERVICE
// ============================================================================

class SyncService {
  private syncInProgress = false;
  private syncPromise: Promise<SyncResult> | null = null;
  private listeners: SyncEventListener[] = [];
  private autoSyncInterval: NodeJS.Timeout | null = null;
  private cancellationRequested = false;

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

    this.cancellationRequested = false;
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
      if (this.cancellationRequested) {
        throw new Error('Sincronização cancelada');
      }
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
      if (this.cancellationRequested) {
        throw new Error('Sincronização cancelada');
      }
      pulled = pullResult.pulled;
      errors.push(...pullResult.errors);
      // FIX #1: Merge pull conflicts into the overall sync result
      if (pullResult.conflicts && pullResult.conflicts.length > 0) {
        conflicts = [...conflicts, ...pullResult.conflicts];
      }

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
      this.cancellationRequested = false;
    }
  }

  /**
   * Cancela a sincronização em andamento sem afetar outras chamadas da API.
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
      
      // FIX #4: Filter changes using ALLOWED_FIELDS before sending to server
      // Converter tipos do SQLite para tipos esperados pela API
      const payload = {
        deviceId: metadata.deviceId,
        deviceKey: metadata.deviceKey,
        lastSyncAt: metadata.lastSyncAt,
        changes: pendingChanges.map(change => {
          // Parse changes if string (from SQLite)
          const rawChanges: Record<string, unknown> = typeof change.changes === 'string' 
            ? JSON.parse(change.changes) 
            : change.changes;

          // Filter fields to only include what the server accepts
          const filteredChanges = filterChangeFields(change.entityType, rawChanges);

          return {
            id: change.id,
            entityId: change.entityId,
            entityType: change.entityType,
            operation: change.operation,
            changes: filteredChanges,
            timestamp: change.timestamp,
            deviceId: change.deviceId,
            // Converter synced de number (0/1) para boolean
            synced: Boolean(change.synced),
            // Converter syncedAt null para undefined
            syncedAt: change.syncedAt || undefined,
          };
        }),
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
   * 
   * FIX #1: Now handles conflicts and errors from PULL response
   * FIX #2: Increased max rounds from 10 to 20 with no-progress detection
   * FIX #3: Applies updatedVersions from PULL response
   */
  async pullChanges(): Promise<{ pulled: number; errors: string[]; conflicts: SyncConflict[] }> {
    const errors: string[] = [];
    const allConflicts: SyncConflict[] = [];
    let pulled = 0;
    // FIX #2: Increased max rounds from 10 to 20 with explicit infinite-loop guard
    const MAX_PULL_ROUNDS = 20;
    const ABSOLUTE_MAX_ROUNDS = 30; // Hard cap — if hit, something is very wrong

    try {
      const metadata = await databaseService.getSyncMetadata();
      
      const payload = {
        deviceId: metadata.deviceId,
        deviceKey: metadata.deviceKey,
        lastSyncAt: metadata.lastSyncAt || new Date(0).toISOString(),
      };

      // PULL com paginação — continua enquanto hasMore=true
      let currentLastSyncAt = payload.lastSyncAt;
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
      let isStale = false;
      let finalLastSyncAt = '';
      let noProgressCount = 0;
      let prevTotal = 0;

      do {
        round++;

        // FIX #2: Hard cap against infinite loops
        if (round > ABSOLUTE_MAX_ROUNDS) {
          logger.error(`[Sync/Pull] ABORT: exceeded absolute max of ${ABSOLUTE_MAX_ROUNDS} rounds — possible server bug with hasMore always true`);
          errors.push(`Sincronização abortada: ${ABSOLUTE_MAX_ROUNDS} rodadas excedidas. Dados restantes serão sincronizados na próxima vez.`);
          // Consider snapshot recovery if we hit this
          logger.warn('[Sync/Pull] Triggering snapshot recovery due to excessive rounds');
          try {
            const snapshotResult = await this.syncFromSnapshot();
            if (snapshotResult) pulled += snapshotResult;
          } catch (snapErr) {
            logger.error('[Sync/Pull] Snapshot recovery also failed:', snapErr);
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

        // FIX #1: Handle conflicts and errors in PULL response
        if (response.conflicts && response.conflicts.length > 0) {
          allConflicts.push(...response.conflicts);
          logger.warn(`[Sync/Pull] ${response.conflicts.length} conflitos recebidos no round ${round}`);
          for (const conflict of response.conflicts) {
            logger.warn(`[Sync/Pull] Conflito: ${conflict.entityType}:${conflict.entityId} — tipo: ${conflict.conflictType}`);
          }
        }
        if (response.errors && response.errors.length > 0) {
          errors.push(...response.errors);
          logger.warn(`[Sync/Pull] ${response.errors.length} erros no round ${round}:`, response.errors);
        }

        // FIX #3: Collect updatedVersions from PULL response
        if (response.updatedVersions && response.updatedVersions.length > 0) {
          allUpdatedVersions.push(...response.updatedVersions);
        }

        const changes = response.changes || {};
        
        // Acumular mudanças de cada entidade
        const changeKeys = ['clientes', 'produtos', 'locacoes', 'cobrancas', 'rotas', 'usuarios', 'manutencoes', 'metas', 'historicoRelogio'] as const;
        for (const key of changeKeys) {
          if (changes[key] && Array.isArray(changes[key])) {
            allChanges[key].push(...changes[key]!);
          }
        }

        // Acumular dados auxiliares
        if (response.tiposProduto) allTiposProduto.push(...response.tiposProduto);
        if (response.descricoesProduto) allDescricoesProduto.push(...response.descricoesProduto);
        if (response.tamanhosProduto) allTamanhosProduto.push(...response.tamanhosProduto);
        if (response.estabelecimentos) allEstabelecimentos.push(...response.estabelecimentos);

        // Atualizar cursor para próxima página
        finalLastSyncAt = response.lastSyncAt || finalLastSyncAt;
        hasMore = response.hasMore || false;
        isStale = response.isStale || isStale;
        currentLastSyncAt = finalLastSyncAt;

        // FIX #2: Detect no-progress loops (hasMore=true but no new data)
        const currentTotal =
          allChanges.clientes.length + allChanges.produtos.length +
          allChanges.locacoes.length + allChanges.cobrancas.length +
          allChanges.rotas.length + allChanges.usuarios.length +
          allChanges.manutencoes.length + allChanges.metas.length +
          allChanges.historicoRelogio.length;
        if (currentTotal === prevTotal && hasMore) {
          noProgressCount++;
          if (noProgressCount >= 3) {
            logger.error(`[Sync/Pull] ABORT: ${noProgressCount} rounds com hasMore=true mas sem novos dados — possível bug no servidor`);
            errors.push('Sincronização parcial: servidor reportando dados pendentes mas não enviando novos registros');
            break;
          }
        } else {
          noProgressCount = 0;
        }
        prevTotal = currentTotal;

        if (round >= MAX_PULL_ROUNDS && hasMore) {
          logger.warn(`[Sync/Pull] Atingido limite de ${MAX_PULL_ROUNDS} rodadas — hasMore=true mas parando para evitar loop infinito`);
          errors.push(`Sincronização parcial: ${MAX_PULL_ROUNDS} rodadas atingidas, dados restantes serão sincronizados na próxima vez`);
          break;
        }
      } while (hasMore);

      // Contar total de mudanças
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

      // FIX #3: Apply updatedVersions from PULL response (same logic as PUSH)
      if (allUpdatedVersions.length > 0) {
        logger.info(`[Sync/Pull] Aplicando ${allUpdatedVersions.length} atualizações de versão do servidor`);
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
            logger.error(`[Sync/Pull] Erro ao atualizar versão de ${uv.entityType}:${uv.entityId}:`, err);
          }
        }
      }

      // Avisar se o dispositivo está muito tempo sem sync
      if (isStale) {
        logger.warn(
          '[Sync/Pull] AVISO: dispositivo sem sync há mais de 30 dias. ' +
          'Dados podem estar incompletos — usando snapshot para resync completo.'
        );
        this.notify({
          phase: 'pulling',
          total: pulled,
          current: pulled,
          message: 'Dispositivo desatualizado — sincronizando snapshot completo...',
          errors: [],
        });
        const snapshotResult = await this.syncFromSnapshot();
        if (snapshotResult) {
          pulled += snapshotResult;
        }
      }

      // Aplicar mudanças acumuladas se houver
      if (pulled > 0) {
        await databaseService.applyRemoteChanges({
          success: true,
          lastSyncAt: finalLastSyncAt,
          changes: allChanges,
          tiposProduto: allTiposProduto,
          descricoesProduto: allDescricoesProduto,
          tamanhosProduto: allTamanhosProduto,
          estabelecimentos: allEstabelecimentos,
        });
      }

      logger.info('[Sync/Pull] Mudanças recebidas', { pulled, rounds: round, conflicts: allConflicts.length });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro no pull';
      errors.push(errorMsg);
      logger.error('[Sync/Pull] Erro:', error);
    }

    return { pulled, errors, conflicts: allConflicts };
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
      
      // Fonte única de verdade: sync_metadata local (SQLite)
      if (metadata.deviceId && metadata.deviceKey) {
        return true;
      }

      // Sem metadados locais completos: precisa de ativação
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
      historicoRelogio: 'historico_relogio',
      tipoProduto: 'tipos_produto',
      descricaoProduto: 'descricoes_produto',
      tamanhoProduto: 'tamanhos_produto',
      estabelecimento: 'estabelecimentos',
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
        (snapshot.rotas?.length || 0) +
        (snapshot.usuarios?.length || 0) +
        (snapshot.manutencoes?.length || 0) +
        (snapshot.metas?.length || 0) +
        (snapshot.historicoRelogio?.length || 0);

      // CORREÇÃO: Aplicar como mudanças remotas incluindo TODAS as entidades
      // Antes faltavam manutencoes e metas, causando perda de dados em snapshot recovery
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
