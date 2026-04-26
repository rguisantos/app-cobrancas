/**
 * RotaRepository.ts
 * Repositório para operações com Rotas
 * Integração: DatabaseService (expo-sqlite)
 */

import { databaseService } from '../services/DatabaseService';
import { Rota } from '../types';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface RotaFilters {
  status?: 'Ativo' | 'Inativo';
  termoBusca?: string;
}

export interface RotaResumo {
  id: string;
  descricao: string;
  status: 'Ativo' | 'Inativo';
  totalClientes?: number;
}

// ============================================================================
// CLASSE ROTA REPOSITORY
// ============================================================================

class RotaRepository {

  // ==========================================================================
  // OPERAÇÕES CRUD
  // ==========================================================================

  /**
   * Busca todas as rotas ativas
   */
  async getAtivas(): Promise<Rota[]> {
    try {
      const rotas = await databaseService.getRotas();
      return rotas
        .filter(r => r.status === 'Ativo')
        .map(r => this.mapToRota(r));
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar rotas ativas:', error);
      return [];
    }
  }

  /**
   * Busca todas as rotas
   */
  async getAll(): Promise<Rota[]> {
    try {
      const rotas = await databaseService.getRotas();
      return rotas.map(r => this.mapToRota(r));
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar todas as rotas:', error);
      return [];
    }
  }

  /**
   * Busca rota por ID — usa WHERE clause ao invés de carregar todas
   */
  async getById(id: string | number): Promise<Rota | null> {
    try {
      const rows = await databaseService.getAllAsync<any>(
        `SELECT id, descricao, status, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt
         FROM rotas WHERE id = ? AND deletedAt IS NULL`,
        [String(id)]
      );
      if (rows.length === 0) return null;
      return this.mapToRota(rows[0]);
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar rota por ID:', error);
      return null;
    }
  }

  /**
   * Verifica se já existe uma rota com a descrição (case-insensitive)
   */
  async existeComDescricao(descricao: string, excludeId?: string | number): Promise<boolean> {
    try {
      const query = excludeId
        ? `SELECT COUNT(*) as cnt FROM rotas WHERE descricao = ? AND id != ? AND deletedAt IS NULL`
        : `SELECT COUNT(*) as cnt FROM rotas WHERE descricao = ? AND deletedAt IS NULL`;
      const params = excludeId ? [descricao.trim(), String(excludeId)] : [descricao.trim()];
      const rows = await databaseService.getAllAsync<{ cnt: number }>(query, params);
      return (rows[0]?.cnt ?? 0) > 0;
    } catch (error) {
      console.error('[RotaRepository] Erro ao verificar descrição:', error);
      return false;
    }
  }

  /**
   * Cria uma nova rota
   */
  async save(rota: Partial<Rota>): Promise<Rota> {
    try {
      const id = String(rota.id || `rota_${Date.now()}`);
      const descricao = rota.descricao || '';
      const status = rota.status || 'Ativo';

      // Verificar unicidade
      if (await this.existeComDescricao(descricao, rota.id)) {
        throw new Error('Já existe uma rota com esta descrição');
      }

      await databaseService.saveRota(id, descricao, status);
      
      console.log('[RotaRepository] Rota criada:', id, descricao);
      
      return {
        id,
        descricao,
        status: status as 'Ativo' | 'Inativo',
        syncStatus: 'pending',
        needsSync: true,
        version: 1,
        deviceId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[RotaRepository] Erro ao criar rota:', error);
      throw error;
    }
  }

  /**
   * Atualiza rota existente — preserva campos de sync e createdAt
   */
  async update(rota: Partial<Rota> & { id: string | number }): Promise<Rota | null> {
    try {
      const existing = await this.getById(rota.id);
      if (!existing) {
        console.warn('[RotaRepository] Rota não encontrada para atualização:', rota.id);
        return null;
      }

      const descricao = rota.descricao || existing.descricao;
      const status = rota.status || existing.status;

      // Verificar unicidade se a descrição foi alterada
      if (descricao !== existing.descricao && await this.existeComDescricao(descricao, rota.id)) {
        throw new Error('Já existe uma rota com esta descrição');
      }

      // Usar UPDATE ao invés de INSERT OR REPLACE para preservar campos de sync
      await databaseService.runAsync(
        `UPDATE rotas SET descricao = ?, status = ?, updatedAt = ?, needsSync = 1, syncStatus = 'pending' WHERE id = ?`,
        [descricao.trim(), status, new Date().toISOString(), String(rota.id)]
      );
      
      console.log('[RotaRepository] Rota atualizada:', rota.id);
      
      return {
        ...existing,
        descricao,
        status: status as 'Ativo' | 'Inativo',
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
        needsSync: true,
      };
    } catch (error) {
      console.error('[RotaRepository] Erro ao atualizar rota:', error);
      throw error;
    }
  }

  /**
   * Remove rota (soft delete) e desvincula clientes
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      const existing = await this.getById(id);
      if (!existing) {
        console.warn('[RotaRepository] Rota não encontrada para exclusão:', id);
        return false;
      }

      const now = new Date().toISOString();

      // Soft delete da rota
      await databaseService.runAsync(
        `UPDATE rotas SET deletedAt = ?, updatedAt = ?, needsSync = 1, syncStatus = 'pending' WHERE id = ?`,
        [now, now, String(id)]
      );

      // Desvincular clientes desta rota (nullify rotaId e rotaNome)
      await databaseService.runAsync(
        `UPDATE clientes SET rotaId = NULL, rotaNome = NULL, updatedAt = ?, needsSync = 1 WHERE rotaId = ? AND deletedAt IS NULL`,
        [now, String(id)]
      );

      console.log('[RotaRepository] Rota removida e clientes desvinculados:', id);
      return true;
    } catch (error) {
      console.error('[RotaRepository] Erro ao remover rota:', error);
      return false;
    }
  }

  /**
   * Busca rotas com filtros
   */
  async getFiltered(filters: RotaFilters): Promise<Rota[]> {
    try {
      let query = `SELECT id, descricao, status, syncStatus, lastSyncedAt, needsSync, version, deviceId, createdAt, updatedAt FROM rotas WHERE deletedAt IS NULL`;
      const params: any[] = [];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.termoBusca) {
        query += ` AND descricao LIKE ?`;
        params.push(`%${filters.termoBusca}%`);
      }

      query += ` ORDER BY descricao ASC`;

      const rows = await databaseService.getAllAsync<any>(query, params);
      return rows.map(r => this.mapToRota(r));
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar rotas filtradas:', error);
      return [];
    }
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  /**
   * Mapeia dados do banco para objeto Rota
   */
  private mapToRota(data: any): Rota {
    return {
      id: data.id,
      descricao: data.descricao,
      status: data.status || 'Ativo',
      syncStatus: data.syncStatus || 'synced',
      needsSync: data.needsSync === 1 || data.needsSync === true,
      version: data.version || 1,
      deviceId: data.deviceId || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Conta total de rotas ativas usando SQL COUNT (evita carregar todos os registros)
   */
  async count(): Promise<number> {
    try {
      const rows = await databaseService.getAllAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM rotas WHERE deletedAt IS NULL AND status = 'Ativo'`,
        []
      );
      return rows[0]?.cnt ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Conta total de clientes vinculados a uma rota
   */
  async countClientesByRota(rotaId: string | number): Promise<number> {
    try {
      const rows = await databaseService.getAllAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM clientes WHERE rotaId = ? AND deletedAt IS NULL`,
        [String(rotaId)]
      );
      return rows[0]?.cnt ?? 0;
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const rotaRepository = new RotaRepository();
export default rotaRepository;
