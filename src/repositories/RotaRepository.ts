/**
 * RotaRepository.ts
 * Repositório para operações com Rotas
 * Integração: DatabaseService (expo-sqlite) + Tipos TypeScript
 */

import { databaseService } from '../services/DatabaseService';
import { 
  Rota, 
  EntityType
} from '../types';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface RotaFilters {
  status?: 'Ativo' | 'Inativo';
  termoBusca?: string;
}

export interface RotaResumo {
  id: string | number;
  descricao: string;
  status: 'Ativo' | 'Inativo';
  totalClientes?: number;
}

// ============================================================================
// CLASSE ROTA REPOSITORY
// ============================================================================

class RotaRepository {
  private entityType: EntityType = 'rota';

  // ==========================================================================
  // OPERAÇÕES CRUD BÁSICAS
  // ==========================================================================

  /**
   * Busca todas as rotas (com filtros opcionais)
   */
  async getAll(filters?: RotaFilters): Promise<Rota[]> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];

      // Aplicar filtros
      if (filters?.status) {
        whereClauses.push('status = ?');        params.push(filters.status);
      }

      if (filters?.termoBusca) {
        whereClauses.push('descricao LIKE ?');
        const termo = `%${filters.termoBusca}%`;
        params.push(termo);
      }

      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1';
      const rotas = await databaseService.getAll<Rota>(
        this.entityType,
        where,
        params
      );

      return rotas;
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar rotas:', error);
      return [];
    }
  }

  /**
   * Busca rota por ID
   */
  async getById(id: string | number): Promise<Rota | null> {
    try {
      const rota = await databaseService.getById<Rota>(this.entityType, String(id));
      return rota;
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar rota por ID:', error);
      return null;
    }
  }

  /**
   * Salva rota (cria ou atualiza)
   */
  async save(rota: Omit<Rota, 'createdAt' | 'updatedAt'>): Promise<Rota> {
    try {
      const now = new Date().toISOString();
      
      const rotaCompleta: Rota = {
        ...rota,
        createdAt: rota.createdAt || now,
        updatedAt: now,
      };

      // Verificar se existe para decidir entre insert ou update      const existing = await this.getById(rota.id);
      
      if (existing) {
        await databaseService.update(this.entityType, rotaCompleta);
      } else {
        await databaseService.save(this.entityType, rotaCompleta);
      }
      
      console.log('[RotaRepository] Rota salva:', rotaCompleta.id);
      return rotaCompleta;
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

      const rotaAtualizada: Rota = {
        ...existing,
        ...rota,
        updatedAt: new Date().toISOString(),
      };

      await databaseService.update(this.entityType, rotaAtualizada);
      
      console.log('[RotaRepository] Rota atualizada:', rota.id);
      return rotaAtualizada;
    } catch (error) {
      console.error('[RotaRepository] Erro ao atualizar rota:', error);
      throw error;
    }
  }

  /**
   * Remove rota (soft delete não se aplica, é hard delete)
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      await databaseService.delete(this.entityType, String(id));
      console.log('[RotaRepository] Rota removida:', id);      return true;
    } catch (error) {
      console.error('[RotaRepository] Erro ao remover rota:', error);
      return false;
    }
  }

  // ==========================================================================
  // MÉTODOS ESPECÍFICOS DE NEGÓCIO
  // ==========================================================================

  /**
   * Busca apenas rotas ativas
   */
  async getAtivas(): Promise<Rota[]> {
    return this.getAll({ status: 'Ativo' });
  }

  /**
   * Busca apenas rotas inativas
   */
  async getInativas(): Promise<Rota[]> {
    return this.getAll({ status: 'Inativo' });
  }

  /**
   * Busca rota por descrição (nome)
   */
  async getByDescricao(descricao: string): Promise<Rota | null> {
    try {
      const rotas = await databaseService.getAll<Rota>(
        this.entityType,
        'descricao = ?',
        [descricao]
      );

      return rotas.length > 0 ? rotas[0] : null;
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar rota por descrição:', error);
      return null;
    }
  }

  /**
   * Busca avançada (para autocomplete/select)
   */
  async search(termo: string): Promise<RotaResumo[]> {
    if (!termo || termo.trim().length === 0) {
      const rotas = await this.getAtivas();
      return rotas.map(rota => this.toResumo(rota));    }

    const rotas = await this.getAll({ termoBusca: termo, status: 'Ativo' });
    return rotas.map(rota => this.toResumo(rota));
  }

  /**
   * Verifica se descrição da rota já existe (exceto a própria rota)
   */
  async descricaoExists(descricao: string, excludeId?: string | number): Promise<boolean> {
    try {
      const rota = await this.getByDescricao(descricao);
      
      if (!rota) return false;
      if (excludeId && String(rota.id) === String(excludeId)) return false;
      
      return true;
    } catch (error) {
      console.error('[RotaRepository] Erro ao verificar descrição:', error);
      return false;
    }
  }

  /**
   * Conta total de rotas
   */
  async count(filters?: RotaFilters): Promise<number> {
    try {
      const rotas = await this.getAll(filters);
      return rotas.length;
    } catch (error) {
      console.error('[RotaRepository] Erro ao contar rotas:', error);
      return 0;
    }
  }

  /**
   * Ativa ou desativa rota
   */
  async toggleStatus(id: string | number): Promise<Rota | null> {
    try {
      const rota = await this.getById(id);
      if (!rota) {
        console.warn('[RotaRepository] Rota não encontrada:', id);
        return null;
      }

      const novoStatus: 'Ativo' | 'Inativo' = rota.status === 'Ativo' ? 'Inativo' : 'Ativo';

      return await this.update({        id,
        status: novoStatus,
      });
    } catch (error) {
      console.error('[RotaRepository] Erro ao alternar status:', error);
      return null;
    }
  }

  /**
   * Busca resumo de rotas com contagem de clientes
   */
  async getResumoComClientes(): Promise<RotaResumo[]> {
    try {
      const rotas = await this.getAll();
      
      // TODO: Integrar com ClienteRepository para contar clientes por rota
      return rotas.map(rota => ({
        ...this.toResumo(rota),
        totalClientes: 0, // Será implementado quando integrar com ClienteRepository
      }));
    } catch (error) {
      console.error('[RotaRepository] Erro ao buscar resumo:', error);
      return [];
    }
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ==========================================================================

  /**
   * Converte Rota completa para RotaResumo
   */
  private toResumo(rota: Rota): RotaResumo {
    return {
      id: rota.id,
      descricao: rota.descricao,
      status: rota.status,
    };
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const rotaRepository = new RotaRepository();
export default rotaRepository;