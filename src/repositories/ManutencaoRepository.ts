/**
 * ManutencaoRepository.ts
 * Repositório para histórico de manutenções / trocas de pano
 */

import { databaseService } from '../services/DatabaseService';
import { generateId } from '../utils/database';

export interface RegistroManutencao {
  id: string;
  produtoId: string;
  produtoIdentificador: string;
  produtoTipo: string;
  clienteId?: string;
  clienteNome?: string;
  locacaoId?: string;
  cobrancaId?: string;
  tipo: 'trocaPano' | 'manutencao';
  descricao?: string;
  data: string;
  registradoPor?: string;
  createdAt?: string;
}

export interface ManutencaoFilters {
  produtoId?: string;
  tipo?: string;
  dataInicio?: string;
  dataFim?: string;
}

class ManutencaoRepository {
  async registrar(dados: Omit<RegistroManutencao, 'id' | 'createdAt'>): Promise<RegistroManutencao> {
    const id = generateId('manut');
    const registro: RegistroManutencao = {
      ...dados,
      id,
      data: dados.data || new Date().toISOString(),
    };
    await databaseService.saveManutencao(registro);
    console.log('[ManutencaoRepository] Manutenção registrada:', id, dados.tipo);
    return registro;
  }

  async getAll(filters?: ManutencaoFilters): Promise<RegistroManutencao[]> {
    try {
      return await databaseService.getManutencoes(filters) as RegistroManutencao[];
    } catch (error) {
      console.error('[ManutencaoRepository] Erro ao buscar manutenções:', error);
      return [];
    }
  }

  async getByProduto(produtoId: string): Promise<RegistroManutencao[]> {
    return this.getAll({ produtoId });
  }

  async getTrocasDePano(filters?: { dataInicio?: string; dataFim?: string }): Promise<RegistroManutencao[]> {
    return this.getAll({ tipo: 'trocaPano', ...filters });
  }
}

export const manutencaoRepository = new ManutencaoRepository();
export default manutencaoRepository;
