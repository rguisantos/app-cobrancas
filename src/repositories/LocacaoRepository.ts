/**
 * LocacaoRepository.ts
 * Repositório para operações com Locações
 * Core do negócio - Integração: DatabaseService (expo-sqlite) + Tipos TypeScript
 */

import { databaseService } from '../services/DatabaseService';
import { 
  Locacao, 
  LocacaoListItem, 
  EntityType,
  StatusLocacao,
  FormaPagamentoLocacao,
  Periodicidade
} from '../types';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface LocacaoFilters {
  clienteId?: string | number;
  produtoId?: string | number;
  status?: StatusLocacao;
  formaPagamento?: FormaPagamentoLocacao;
  rotaId?: string | number;
  dataInicio?: string;
  dataFim?: string;
  termoBusca?: string; // Busca por identificador do produto, nome do cliente
}

export interface LocacaoComDetalhes extends Locacao {
  produtoIdentificador: string;
  produtoTipo: string;
  produtoDescricao?: string;
  produtoTamanho?: string;
  clienteNome: string;
  clienteTelefone?: string;
  rotaNome?: string;
}

export interface LocacaoResumo {
  id: string | number;
  produtoIdentificador: string;
  produtoNome: string;
  produtoTipo?: string;
  clienteNome: string;
  dataLocacao: string;
  formaPagamento: FormaPagamentoLocacao;
  percentualEmpresa: number;
  precoFicha: number;
  status: StatusLocacao;
}

export interface NovaLocacaoData {
  clienteId: string;
  clienteNome: string;
  produtoId: string;
  produtoIdentificador: string;
  produtoTipo: string;
  
  dataLocacao: string;
  observacao?: string;
  
  formaPagamento: FormaPagamentoLocacao;
  numeroRelogio: string;
  precoFicha: number;
  percentualEmpresa: number;
  percentualCliente: number;
  
  // Para período
  periodicidade?: string;
  valorFixo?: number;
  dataPrimeiraCobranca?: string;
}

export interface RelocacaoData {
  produtoId: string;
  produtoIdentificador: string;
  
  // Novo cliente
  novoClienteId: string;
  novoClienteNome: string;
  
  // Dados da nova locação
  dataRelocacao: string;
  formaPagamento: FormaPagamentoLocacao;
  numeroRelogio: string;
  precoFicha: number;
  percentualEmpresa: number;
  percentualCliente: number;
  periodicidade?: string;
  valorFixo?: number;
  dataPrimeiraCobranca?: string;
  
  motivoRelocacao: string;
  observacao?: string;
}

export interface EnviarEstoqueData {
  locacaoId: string;
  produtoId: string;  produtoIdentificador: string;
  clienteId: string;
  clienteNome: string;
  
  estabelecimento: string;
  motivo: string;
  observacao?: string;
}

// ============================================================================
// CLASSE LOCACAO REPOSITORY
// ============================================================================

class LocacaoRepository {
  private entityType: EntityType = 'locacao';

  // ==========================================================================
  // OPERAÇÕES CRUD BÁSICAS
  // ==========================================================================

  /**
   * Busca todas as locações (com filtros opcionais)
   */
  async getAll(filters?: LocacaoFilters): Promise<LocacaoListItem[]> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];

      // Aplicar filtros
      if (filters?.clienteId) {
        whereClauses.push('clienteId = ?');
        params.push(String(filters.clienteId));
    
  }

      if (filters?.produtoId) {
        whereClauses.push('produtoId = ?');
        params.push(String(filters.produtoId));
    
  }

      if (filters?.status) {
        whereClauses.push('status = ?');
        params.push(filters.status);
    
  }

      if (filters?.formaPagamento) {
        whereClauses.push('formaPagamento = ?');
        params.push(filters.formaPagamento);
    
  }

      // NOTA: rotaId não existe na tabela locacoes - remover este filtro
      // if (filters?.rotaId) {
      //   whereClauses.push('rotaId = ?');
      //   params.push(String(filters.rotaId));
      // }

      if (filters?.dataInicio) {
        whereClauses.push('dataLocacao >= ?');
        params.push(filters.dataInicio);
    
  }

      if (filters?.dataFim) {
        whereClauses.push('dataLocacao <= ?');
        params.push(filters.dataFim);
    
  }

      if (filters?.termoBusca) {
        whereClauses.push('(produtoIdentificador LIKE ? OR clienteNome LIKE ?)');
        const termo = `%${filters.termoBusca}%`;
        params.push(termo, termo);
    
  }

      // NOTA: deletedAt IS NULL já é adicionado automaticamente pelo databaseService.getAll()
      // whereClauses.push('deletedAt IS NULL');

      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : undefined;
      const locacoes = await databaseService.getAll<Locacao>(
        this.entityType,
        where,
        params
      );

      // Mapear para LocacaoListItem
      return locacoes.map(locacao => this.toListItem(locacao));
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao buscar locações:', error);
      return [];
  
  }

  }

  /**
   * Busca locação por ID
   */
  async getById(id: string): Promise<Locacao | null> {
    try {
      const locacao = await databaseService.getById<Locacao>(this.entityType, id);
      return locacao;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao buscar locação por ID:', error);
      return null;
  
  }

  }
  /**
   * Busca locação ativa por produto
   */
  async getAtivaByProduto(produtoId: string): Promise<Locacao | null> {
    try {
      const locacoes = await databaseService.getAll<Locacao>(
        this.entityType,
        'produtoId = ? AND status = ?',
        [produtoId, 'Ativa']
      );

      return locacoes.length > 0 ? locacoes[0] : null;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao buscar locação ativa por produto:', error);
      return null;
  
  }

  }

  /**
   * Busca todas as locações ativas de um cliente
   */
  async getAtivasByCliente(clienteId: string): Promise<Locacao[]> {
    try {
      return await this.getAll({ 
        clienteId, 
        status: 'Ativa' 
      }) as unknown as Locacao[];
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao buscar locações ativas do cliente:', error);
      return [];
  
  }

  }

  /**
   * Salva nova locação
   */
  async save(locacao: Omit<Locacao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> & { id?: string }): Promise<Locacao> {
    try {
      const locacaoCompleta: Locacao = {
        ...locacao,
        id: locacao.id || this.generateId(),
        tipo: this.entityType,
        syncStatus: 'pending',
        lastSyncedAt: undefined,
        needsSync: 1,
        version: 0,
        deviceId: await databaseService.getDeviceId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),      
      };

      await databaseService.save(this.entityType, locacaoCompleta);
      
      console.log('[LocacaoRepository] Locação salva:', locacaoCompleta.id);
      return locacaoCompleta;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao salvar locação:', error);
      throw error;
  
  }

  }

  /**
   * Atualiza locação existente
   */
  async update(locacao: Partial<Locacao> & { id: string }): Promise<Locacao | null> {
    try {
      const existing = await this.getById(locacao.id);
      if (!existing) {
        console.warn('[LocacaoRepository] Locação não encontrada para atualização:', locacao.id);
        return null;
    
  }

      const locacaoAtualizada: Locacao = {
        ...existing,
        ...locacao,
        updatedAt: new Date().toISOString(),
        version: (existing.version || 0) + 1,
      };

      await databaseService.update(this.entityType, locacaoAtualizada);
      
      console.log('[LocacaoRepository] Locação atualizada:', locacao.id);
      return locacaoAtualizada;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao atualizar locação:', error);
      throw error;
  
  }

  }

  /**
   * Remove locação (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await databaseService.delete(this.entityType, id);
      console.log('[LocacaoRepository] Locação removida:', id);
      return true;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao remover locação:', error);      return false;
  
  }

  }

  // ==========================================================================
  // MÉTODOS DE NEGÓCIO - LOCAÇÃO
  // ==========================================================================

  /**
   * Cria nova locação (produto → cliente)
   */
  async criarNovaLocacao(data: NovaLocacaoData): Promise<Locacao | null> {
    try {
      // Verificar se produto já está locado
      const locacaoExistente = await this.getAtivaByProduto(data.produtoId);
      if (locacaoExistente) {
        console.error('[LocacaoRepository] Produto já está locado:', data.produtoId);
        throw new Error('Produto já está locado para outro cliente');
    
  }

      const novaLocacao: Omit<Locacao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> = {
        clienteId: data.clienteId,
        clienteNome: data.clienteNome,
        produtoId: data.produtoId,
        produtoIdentificador: data.produtoIdentificador,
        produtoTipo: data.produtoTipo,
        
        dataLocacao: data.dataLocacao,
        observacao: data.observacao,
        
        formaPagamento: data.formaPagamento,
        numeroRelogio: data.numeroRelogio,
        precoFicha: data.precoFicha,
        percentualEmpresa: data.percentualEmpresa,
        percentualCliente: data.percentualCliente,
        
        periodicidade: data.periodicidade as Periodicidade | undefined,
        valorFixo: data.valorFixo,
        dataPrimeiraCobranca: data.dataPrimeiraCobranca,
        
        status: 'Ativa',
      };

      const locacao = await this.save(novaLocacao);
      
      console.log('[LocacaoRepository] Nova locação criada:', locacao.id);
      return locacao;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao criar nova locação:', error);
      throw error;  
  }

  }

  /**
   * Realiza relocação de produto (muda de cliente)
   */
  async realizarRelocacao(data: RelocacaoData): Promise<{
    locacaoAntigaFinalizada: Locacao | null;
    novaLocacao: Locacao | null;
  }> {
    try {
      await databaseService.runTransaction(async () => {
        // 1. Buscar locação atual do produto
        const locacaoAtual = await this.getAtivaByProduto(data.produtoId);
        
        if (!locacaoAtual) {
          throw new Error('Produto não está locado atualmente');
      
  }

        // 2. Finalizar locação antiga
        await this.finalizarLocacao(locacaoAtual.id, 'Relocação', data.motivoRelocacao);

        // 3. Criar nova locação
        const novaLocacao: Omit<Locacao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> = {
          clienteId: data.novoClienteId,
          clienteNome: data.novoClienteNome,
          produtoId: data.produtoId,
          produtoIdentificador: data.produtoIdentificador,
          produtoTipo: locacaoAtual.produtoTipo,
          
          dataLocacao: data.dataRelocacao,
          observacao: data.observacao || `Relocação: ${data.motivoRelocacao}`,
          
          formaPagamento: data.formaPagamento,
          numeroRelogio: data.numeroRelogio,
          precoFicha: data.precoFicha,
          percentualEmpresa: data.percentualEmpresa,
          percentualCliente: data.percentualCliente,
          
          periodicidade: data.periodicidade as Periodicidade | undefined,
          valorFixo: data.valorFixo,
          dataPrimeiraCobranca: data.dataPrimeiraCobranca,
          
          status: 'Ativa',
          ultimaLeituraRelogio: locacaoAtual.ultimaLeituraRelogio,
        };

        await this.save(novaLocacao);

        console.log('[LocacaoRepository] Relocação realizada:', data.produtoId);      });

      return {
        locacaoAntigaFinalizada: null,
        novaLocacao: null,
      };
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao realizar relocação:', error);
      throw error;
  
  }

  }

  /**
   * Envia produto para estoque (desvincula do cliente)
   */
  async enviarParaEstoque(data: EnviarEstoqueData): Promise<boolean> {
    try {
      await databaseService.runTransaction(async () => {
        // 1. Finalizar locação
        await this.finalizarLocacao(data.locacaoId, 'Envio para estoque', data.motivo);

        // 2. Atualizar produto para estoque
        // (Será feito via ProdutoRepository)
        console.log('[LocacaoRepository] Produto enviado para estoque:', data.produtoId);
      });

      return true;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao enviar para estoque:', error);
      return false;
  
  }

  }

  /**
   * Finaliza locação
   */
  async finalizarLocacao(
    locacaoId: string, 
    motivo: string = 'Finalização normal',
    observacao?: string
  ): Promise<boolean> {
    try {
      const locacao = await this.getById(locacaoId);
      if (!locacao) {
        console.warn('[LocacaoRepository] Locação não encontrada:', locacaoId);
        return false;
    
  }

      await this.update({
        id: locacaoId,        status: 'Finalizada',
        dataFim: new Date().toISOString(),
        observacao: observacao || motivo,
      });

      console.log('[LocacaoRepository] Locação finalizada:', locacaoId);
      return true;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao finalizar locação:', error);
      return false;
  
  }

  }

  // ==========================================================================
  // MÉTODOS ESPECÍFICOS DE NEGÓCIO
  // ==========================================================================

  /**
   * Busca todas as locações ativas
   */
  async getAtivas(): Promise<LocacaoListItem[]> {
    return this.getAll({ status: 'Ativa' });

  }

  /**
   * Busca todas as locações finalizadas
   */
  async getFinalizadas(): Promise<LocacaoListItem[]> {
    return this.getAll({ status: 'Finalizada' });

  }

  /**
   * Busca locações por cliente (para tela de detalhes do cliente)
   */
  async getByCliente(clienteId: string): Promise<LocacaoResumo[]> {
    try {
      const locacoes = await this.getAll({ clienteId });
      
      return locacoes.map(locacao => ({
        id: String(locacao.id),
        produtoIdentificador: locacao.produtoIdentificador,
        produtoNome: `${locacao.produtoTipo} N° ${locacao.produtoIdentificador}`,
        produtoTipo: locacao.produtoTipo,
        clienteNome: locacao.clienteNome || '',
        dataLocacao: locacao.dataLocacao,
        formaPagamento: locacao.formaPagamento,
        percentualEmpresa: locacao.percentualEmpresa,
        precoFicha: locacao.precoFicha,
        status: locacao.status,
      }));
    } catch (error) {      console.error('[LocacaoRepository] Erro ao buscar locações por cliente:', error);
      return [];
  
  }

  }

  /**
   * Busca locações por produto (histórico do produto)
   */
  async getByProduto(produtoId: string): Promise<Locacao[]> {
    try {
      return await this.getAll({ produtoId }) as unknown as Locacao[];
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao buscar locações por produto:', error);
      return [];
  
  }

  }

  /**
   * Conta locações ativas por cliente
   */
  async countAtivasByCliente(clienteId: string): Promise<number> {
    try {
      const locacoes = await this.getAll({ clienteId, status: 'Ativa' });
      return locacoes.length;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao contar locações:', error);
      return 0;
  
  }

  }

  /**
   * Busca resumo de locações (para dashboard)
   */
  async getResumo(): Promise<{
    totalLocacoes: number;
    totalAtivas: number;
    totalFinalizadas: number;
    totalCanceladas: number;
  }> {
    try {
      const [total, ativas, finalizadas, canceladas] = await Promise.all([
        this.count(),
        this.count({ status: 'Ativa' }),
        this.count({ status: 'Finalizada' }),
        this.count({ status: 'Cancelada' }),
      ]);

      return {
        totalLocacoes: total,
        totalAtivas: ativas,        totalFinalizadas: finalizadas,
        totalCanceladas: canceladas,
      };
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao buscar resumo:', error);
      return {
        totalLocacoes: 0,
        totalAtivas: 0,
        totalFinalizadas: 0,
        totalCanceladas: 0,
      };
  
  }

  }

  /**
   * Conta total de locações
   */
  async count(filters?: LocacaoFilters): Promise<number> {
    try {
      const locacoes = await this.getAll(filters);
      return locacoes.length;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao contar locações:', error);
      return 0;
  
  }

  }

  /**
   * Atualiza leitura do relógio para cobrança
   */
  async atualizarLeituraRelogio(
    locacaoId: string,
    novaLeitura: number
  ): Promise<boolean> {
    try {
      await this.update({
        id: locacaoId,
        ultimaLeituraRelogio: novaLeitura,
        dataUltimaCobranca: new Date().toISOString(),
      });

      console.log('[LocacaoRepository] Leitura do relógio atualizada:', locacaoId);
      return true;
    } catch (error) {
      console.error('[LocacaoRepository] Erro ao atualizar leitura:', error);
      return false;
  
  }

  }

  // ==========================================================================  // MÉTODOS AUXILIARES PRIVADOS
  // ==========================================================================

  /**
   * Converte Locacao completa para LocacaoListItem
   */
  private toListItem(locacao: Locacao): LocacaoListItem {
    return {
      id: locacao.id,
      produtoIdentificador: locacao.produtoIdentificador,
      produtoTipo: locacao.produtoTipo,
      produtoDescricao: '', // Preencher quando tiver dados do produto
      produtoTamanho: '', // Preencher quando tiver dados do produto
      formaPagamento: locacao.formaPagamento,
      numeroRelogio: locacao.numeroRelogio,
      percentualEmpresa: locacao.percentualEmpresa,
      precoFicha: locacao.precoFicha,
      dataLocacao: locacao.dataLocacao,
      status: locacao.status,
    };

  }

  /**
   * Gera ID único para a locação
   */
  private generateId(): string {
    return `locacao_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const locacaoRepository = new LocacaoRepository();
export default locacaoRepository;