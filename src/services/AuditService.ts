/**
 * AuditService.ts
 * Serviço de auditoria para o mobile — equivalente ao registrarAuditoria() do web
 *
 * Registra ações do usuário localmente no SQLite e envia durante o sync.
 * Alinha com o modelo LogAuditoria do Prisma schema.
 *
 * Uso:
 * import AuditService from '../services/AuditService';
 * await AuditService.logAction('criar_cliente', 'cliente', clienteId, { nome: 'João' })
 */

import type { EntityType } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  | 'login'
  | 'logout'
  | 'criar_cliente'
  | 'editar_cliente'
  | 'excluir_cliente'
  | 'criar_produto'
  | 'editar_produto'
  | 'excluir_produto'
  | 'alterar_relogio'
  | 'criar_locacao'
  | 'editar_locacao'
  | 'finalizar_locacao'
  | 'criar_cobranca'
  | 'registrar_pagamento'
  | 'quitar_saldo_devedor'
  | 'criar_manutencao'
  | 'criar_rota'
  | 'editar_rota'
  | 'excluir_rota'
  | 'sincronizar'
  | 'ativar_dispositivo'
  | 'capturar_localizacao'
  | 'gerar_relatorio';

export interface AuditLogEntry {
  id: string;
  usuarioId?: string;
  acao: AuditAction | string;
  entidade: string;
  entidadeId?: string;
  detalhes?: Record<string, unknown>;
  ip?: string;           // Disponível apenas se online
  userAgent?: string;    // Disponível apenas se online
  deviceId?: string;
  createdAt: string;
  synced: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

class AuditService {
  private db: any = null;
  private currentUserId: string | null = null;
  private currentDeviceId: string | null = null;

  /**
   * Inicializa o serviço com a referência do banco SQLite
   */
  init(db: any, userId?: string, deviceId?: string): void {
    this.db = db;
    this.currentUserId = userId || null;
    this.currentDeviceId = deviceId || null;
  }

  /**
   * Atualiza o ID do usuário logado
   */
  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Atualiza o ID do dispositivo
   */
  setDeviceId(deviceId: string): void {
    this.currentDeviceId = deviceId;
  }

  /**
   * Cria a tabela de audit_log no SQLite se não existir
   */
  async createTable(): Promise<void> {
    if (!this.db) return;

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY NOT NULL,
        usuarioId TEXT,
        acao TEXT NOT NULL,
        entidade TEXT NOT NULL,
        entidadeId TEXT,
        detalhes TEXT,
        deviceId TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_usuarioId ON audit_log(usuarioId);
      CREATE INDEX IF NOT EXISTS idx_audit_log_acao ON audit_log(acao);
      CREATE INDEX IF NOT EXISTS idx_audit_log_entidade ON audit_log(entidade, entidadeId);
      CREATE INDEX IF NOT EXISTS idx_audit_log_createdAt ON audit_log(createdAt);
      CREATE INDEX IF NOT EXISTS idx_audit_log_synced ON audit_log(synced);
    `);
  }

  /**
   * Registra uma ação de auditoria
   * Equivalente ao registrarAuditoria() do backend web
   */
  async logAction(
    acao: AuditAction | string,
    entidade: string,
    entidadeId?: string,
    detalhes?: Record<string, unknown>
  ): Promise<string | null> {
    if (!this.db) {
      // Se não tem DB, apenas loga no console
      console.log('[Audit]', { acao, entidade, entidadeId, detalhes });
      return null;
    }

    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      await this.db.runAsync(
        `INSERT INTO audit_log (id, usuarioId, acao, entidade, entidadeId, detalhes, deviceId, createdAt, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          this.currentUserId || null,
          acao,
          entidade,
          entidadeId || null,
          detalhes ? JSON.stringify(detalhes) : null,
          this.currentDeviceId || null,
          now,
        ]
      );

      return id;
    } catch (error) {
      console.error('[Audit] Erro ao registrar ação:', error);
      return null;
    }
  }

  /**
   * Busca logs de auditoria com filtros
   */
  async getLogs(filters?: {
    usuarioId?: string;
    acao?: string;
    entidade?: string;
    entidadeId?: string;
    dataInicio?: string;
    dataFim?: string;
    limite?: number;
    offset?: number;
  }): Promise<AuditLogEntry[]> {
    if (!this.db) return [];

    try {
      let query = 'SELECT * FROM audit_log WHERE 1=1';
      const params: any[] = [];

      if (filters?.usuarioId) {
        query += ' AND usuarioId = ?';
        params.push(filters.usuarioId);
      }
      if (filters?.acao) {
        query += ' AND acao = ?';
        params.push(filters.acao);
      }
      if (filters?.entidade) {
        query += ' AND entidade = ?';
        params.push(filters.entidade);
      }
      if (filters?.entidadeId) {
        query += ' AND entidadeId = ?';
        params.push(filters.entidadeId);
      }
      if (filters?.dataInicio) {
        query += ' AND createdAt >= ?';
        params.push(filters.dataInicio);
      }
      if (filters?.dataFim) {
        query += ' AND createdAt <= ?';
        params.push(filters.dataFim);
      }

      query += ' ORDER BY createdAt DESC';

      if (filters?.limite) {
        query += ' LIMIT ?';
        params.push(filters.limite);
      }
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const results = await this.db.getAllAsync(query, params);

      return results.map((row: any) => ({
        id: row.id,
        usuarioId: row.usuarioId,
        acao: row.acao,
        entidade: row.entidade,
        entidadeId: row.entidadeId,
        detalhes: row.detalhes ? JSON.parse(row.detalhes) : undefined,
        deviceId: row.deviceId,
        createdAt: row.createdAt,
        synced: row.synced === 1,
      }));
    } catch (error) {
      console.error('[Audit] Erro ao buscar logs:', error);
      return [];
    }
  }

  /**
   * Marca logs como sincizados após push bem-sucedido
   */
  async markAsSynced(ids: string[]): Promise<void> {
    if (!this.db || ids.length === 0) return;

    try {
      const placeholders = ids.map(() => '?').join(',');
      await this.db.runAsync(
        `UPDATE audit_log SET synced = 1 WHERE id IN (${placeholders})`,
        ids
      );
    } catch (error) {
      console.error('[Audit] Erro ao marcar como sincronizado:', error);
    }
  }

  /**
   * Retorna logs pendentes de sincronização
   */
  async getUnsyncedLogs(limite: number = 500): Promise<AuditLogEntry[]> {
    if (!this.db) return [];

    try {
      const results = await this.db.getAllAsync(
        'SELECT * FROM audit_log WHERE synced = 0 ORDER BY createdAt ASC LIMIT ?',
        [limite]
      );

      return results.map((row: any) => ({
        id: row.id,
        usuarioId: row.usuarioId,
        acao: row.acao,
        entidade: row.entidade,
        entidadeId: row.entidadeId,
        detalhes: row.detalhes ? JSON.parse(row.detalhes) : undefined,
        deviceId: row.deviceId,
        createdAt: row.createdAt,
        synced: false,
      }));
    } catch (error) {
      console.error('[Audit] Erro ao buscar logs pendentes:', error);
      return [];
    }
  }

  /**
   * Limpa logs antigos já sincronizados (purge)
   */
  async purgeOldLogs(dias: number = 90): Promise<number> {
    if (!this.db) return 0;

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dias);

      const result = await this.db.runAsync(
        'DELETE FROM audit_log WHERE synced = 1 AND createdAt < ?',
        [cutoff.toISOString()]
      );

      return result.changes || 0;
    } catch (error) {
      console.error('[Audit] Erro ao purgar logs antigos:', error);
      return 0;
    }
  }

  /**
   * Gera ID único para o log
   */
  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton
export default new AuditService();
