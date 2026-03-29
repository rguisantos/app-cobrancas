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
   * Busca rota por ID
   */
  async getById(id: string | number): Promise<Rota | null> {
    try {
      const rotas = await databaseService.getRotas();
      const rota = rotas.find(r => String(r.id) === String(id));
      return rota ? this.mapToRota(rota) : null;
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar rota por ID:', error);
      return null;
    }
  }

  /**
   * Salva rota (cria ou atualiza)
   */
  async save(rota: Partial<Rota>): Promise<Rota> {
    try {
      const id = String(rota.id || `rota_${Date.now()}`);
      const descricao = rota.descricao || '';
      const status = rota.status || 'Ativo';

      await databaseService.saveRota(id, descricao, status);
      
      console.log('[RotaRepository] Rota salva:', id, descricao);
      
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
      console.error('[RotaRepository] Erro ao salvar rota:', error);
      throw error;
    }
  }

  /**
   * Atualiza rota existente
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

      await databaseService.saveRota(String(rota.id), descricao, status);
      
      console.log('[RotaRepository] Rota atualizada:', rota.id);
      
      return {
        ...existing,
        descricao,
        status: status as 'Ativo' | 'Inativo',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[RotaRepository] Erro ao atualizar rota:', error);
      throw error;
    }
  }

  /**
   * Remove rota (soft delete)
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      // Soft delete - marcar como deletado
      const existing = await this.getById(id);
      if (existing) {
        await databaseService.delete('rota', String(id));
        console.log('[RotaRepository] Rota removida:', id);
      }
      return true;
    } catch (error) {
      console.error('[RotaRepository] Erro ao remover rota:', error);
      return false;
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
   * Conta total de rotas ativas
   */
  async count(): Promise<number> {
    const rotas = await this.getAtivas();
    return rotas.length;
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const rotaRepository = new RotaRepository();
export default rotaRepository;
