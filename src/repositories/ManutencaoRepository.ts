/**
 * ManutencaoRepository.ts
 * Repositório para histórico de manutenções / trocas de pano
 * Utiliza o tipo Manutencao do pacote shared (com campos de sincronização)
 */

import { Manutencao, SyncStatus } from '../types';
import { databaseService } from '../services/DatabaseService';
import { generateId } from '../utils/database';

/** Alias de compatibilidade — agora aponta para o tipo Manutencao compartilhado */
export type RegistroManutencao = Manutencao;

export interface ManutencaoFilters {
  produtoId?: string;
  tipo?: string;
  dataInicio?: string;
  dataFim?: string;
}

class ManutencaoRepository {
  async registrar(
    dados: Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'>,
  ): Promise<Manutencao> {
    const id = generateId('manut');
    const now = new Date().toISOString();
    const registro: Manutencao = {
      ...dados,
      id,
      data: dados.data || now,
      // Campos de sincronização — registro novo precisa ser sincronizado
      syncStatus: 'pending' as SyncStatus,
      lastSyncedAt: undefined,
      needsSync: true,
      version: 1,
      deviceId: await databaseService.getDeviceId(),
      createdAt: now,
      updatedAt: now,
    };
    await databaseService.saveManutencao(registro);
    console.log('[ManutencaoRepository] Manutenção registrada:', id, dados.tipo);
    return registro;
  }

  /**
   * Atualiza uma manutenção existente
   */
  async update(id: string, data: Partial<Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'>>): Promise<Manutencao | null> {
    try {
      const existing = await databaseService.getById<Manutencao>('manutencao', id);
      if (!existing) {
        console.warn('[ManutencaoRepository] Manutenção não encontrada para atualização:', id);
        return null;
      }

      const now = new Date().toISOString();
      const updated: Manutencao = {
        ...existing,
        ...data,
        syncStatus: 'pending' as SyncStatus,
        createdAt: existing.createdAt || now,
        updatedAt: now,
      };

      await databaseService.update('manutencao', {
        ...updated,
        createdAt: updated.createdAt || now,
      } as any);
      console.log('[ManutencaoRepository] Manutenção atualizada:', id);
      return updated;
    } catch (error) {
      console.error('[ManutencaoRepository] Erro ao atualizar manutenção:', error);
      throw error;
    }
  }

  /**
   * Remove uma manutenção (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await databaseService.delete('manutencao', id);
      console.log('[ManutencaoRepository] Manutenção removida:', id);
      return true;
    } catch (error) {
      console.error('[ManutencaoRepository] Erro ao remover manutenção:', error);
      return false;
    }
  }

  async getAll(filters?: ManutencaoFilters): Promise<Manutencao[]> {
    try {
      return await databaseService.getManutencoes(filters) as Manutencao[];
    } catch (error) {
      console.error('[ManutencaoRepository] Erro ao buscar manutenções:', error);
      return [];
    }
  }

  async getByProduto(produtoId: string): Promise<Manutencao[]> {
    return this.getAll({ produtoId });
  }

  async getTrocasDePano(filters?: { dataInicio?: string; dataFim?: string }): Promise<Manutencao[]> {
    return this.getAll({ tipo: 'trocaPano', ...filters });
  }

  /**
   * Busca manutenções pendentes de sincronização
   */
  async getPendentesSync(): Promise<Manutencao[]> {
    try {
      const todas = await this.getAll();
      return todas.filter(
        m => m.needsSync || m.syncStatus === 'pending' || m.syncStatus === 'error',
      );
    } catch (error) {
      console.error('[ManutencaoRepository] Erro ao buscar pendentes:', error);
      return [];
    }
  }

  /**
   * Atualiza status de sincronização de uma manutenção
   */
  async atualizarSyncStatus(
    id: string,
    syncStatus: SyncStatus,
    lastSyncedAt?: string,
    version?: number,
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      await databaseService.runAsync(
        `UPDATE manutencoes SET syncStatus = ?, lastSyncedAt = ?, needsSync = ?, version = COALESCE(?, version), updatedAt = ? WHERE id = ?`,
        [
          syncStatus,
          lastSyncedAt || now,
          syncStatus !== 'synced' ? 1 : 0,
          version ?? null,
          now,
          id,
        ],
      );
    } catch (error) {
      console.error('[ManutencaoRepository] Erro ao atualizar sync status:', error);
    }
  }
}

export const manutencaoRepository = new ManutencaoRepository();
export default manutencaoRepository;
