/**
 * CobrancaRepository.ts
 * Repositório para operações com Cobranças/Histórico de Pagamentos
 * Integração: DatabaseService (expo-sqlite) + Tipos TypeScript
 */

import { databaseService } from '../services/DatabaseService';
import { 
  HistoricoCobranca, 
  EntityType,
  StatusPagamento
} from '../types';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface CobrancaFilters {
  locacaoId?: string | number;
  clienteId?: string | number;
  status?: StatusPagamento;
  dataInicio?: string;
  dataFim?: string;
  produtoIdentificador?: string;
  termoBusca?: string;
}

export interface CobrancaResumo {
  id: string;
  clienteNome: string;
  produtoIdentificador: string;
  dataCobranca: string;
  valorTotal: number;
  valorRecebido: number;
  saldoDevedor: number;
  status: StatusPagamento;
}

export interface CobrancaPendente {
  locacaoId: string;
  clienteId: string;
  clienteNome: string;
  produtoIdentificador: string;
  dataVencimento: string;
  valorPrevisto: number;
  diasAtraso: number;
}

export interface NovaCobrancaData {
  locacaoId: string;  clienteId: string;
  clienteNome: string;
  produtoIdentificador: string;
  
  dataInicio: string;
  dataFim: string;
  dataVencimento?: string;
  
  relogioAnterior: number;
  relogioAtual: number;
  fichasRodadas: number;
  
  valorFicha: number;
  totalBruto: number;
  
  descontoPartidasQtd?: number;
  descontoPartidasValor?: number;
  descontoDinheiro?: number;
  
  percentualEmpresa: number;
  subtotalAposDescontos: number;
  valorPercentual: number;
  
  totalClientePaga: number;
  valorRecebido: number;
  
  observacao?: string;
}

// ============================================================================
// CLASSE COBRANCA REPOSITORY
// ============================================================================

class CobrancaRepository {
  private entityType: EntityType = 'cobranca';

  // ==========================================================================
  // OPERAÇÕES CRUD BÁSICAS
  // ==========================================================================

  /**
   * Busca todas as cobranças (com filtros opcionais)
   */
  async getAll(filters?: CobrancaFilters): Promise<HistoricoCobranca[]> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];

      // Aplicar filtros
      if (filters?.locacaoId) {        whereClauses.push('locacaoId = ?');
        params.push(String(filters.locacaoId));
    
  }

      if (filters?.clienteId) {
        whereClauses.push('clienteId = ?');
        params.push(String(filters.clienteId));
    
  }

      if (filters?.status) {
        whereClauses.push('status = ?');
        params.push(filters.status);
    
  }

      if (filters?.dataInicio) {
        whereClauses.push('dataInicio >= ?');
        params.push(filters.dataInicio);
    
  }

      if (filters?.dataFim) {
        whereClauses.push('dataFim <= ?');
        params.push(filters.dataFim);
    
  }

      if (filters?.produtoIdentificador) {
        whereClauses.push('produtoIdentificador = ?');
        params.push(filters.produtoIdentificador);
    
  }

      if (filters?.termoBusca) {
        whereClauses.push('(clienteNome LIKE ? OR produtoIdentificador LIKE ?)');
        const termo = `%${filters.termoBusca}%`;
        params.push(termo, termo);
    
  }

      // NOTA: deletedAt IS NULL já é adicionado automaticamente pelo databaseService.getAll()
      // whereClauses.push('deletedAt IS NULL');

      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : undefined;
      const cobranças = await databaseService.getAll<HistoricoCobranca>(
        this.entityType,
        where,
        params
      );

      return cobranças;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao buscar cobranças:', error);
      return [];
    }
  }

  /**
   * Busca cobrança por ID
   */
  async getById(id: string): Promise<HistoricoCobranca | null> {
    try {
      const cobranca = await databaseService.getById<HistoricoCobranca>(this.entityType, id);
      return cobranca;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao buscar cobrança por ID:', error);
      return null;
  
  }

  }

  /**
   * Salva nova cobrança
   */
  async save(cobranca: Omit<HistoricoCobranca, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> & { id?: string }): Promise<HistoricoCobranca> {
    try {
      const cobrancaCompleta: HistoricoCobranca = {
        ...cobranca,
        id: cobranca.id || this.generateId(),
        tipo: this.entityType,
        syncStatus: 'pending',
        lastSyncedAt: undefined,
        needsSync: 1, // Integer para SQLite
        version: 0,
        deviceId: await databaseService.getDeviceId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await databaseService.save(this.entityType, cobrancaCompleta);
      
      console.log('[CobrancaRepository] Cobrança salva:', cobrancaCompleta.id);
      return cobrancaCompleta;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao salvar cobrança:', error);
      throw error;
  
  }

  }

  /**
   * Atualiza cobrança existente
   */
  async update(cobranca: Partial<HistoricoCobranca> & { id: string }): Promise<HistoricoCobranca | null> {
    try {
      const existing = await this.getById(cobranca.id);
      if (!existing) {        console.warn('[CobrancaRepository] Cobrança não encontrada para atualização:', cobranca.id);
        return null;
    
  }

      const cobrancaAtualizada: HistoricoCobranca = {
        ...existing,
        ...cobranca,
        updatedAt: new Date().toISOString(),
        version: (existing.version || 0) + 1,
      };

      await databaseService.update(this.entityType, cobrancaAtualizada);
      
      console.log('[CobrancaRepository] Cobrança atualizada:', cobranca.id);
      return cobrancaAtualizada;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao atualizar cobrança:', error);
      throw error;
  
  }

  }

  /**
   * Remove cobrança (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await databaseService.delete(this.entityType, id);
      console.log('[CobrancaRepository] Cobrança removida:', id);
      return true;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao remover cobrança:', error);
      return false;
  
  }

  }

  // ==========================================================================
  // MÉTODOS DE NEGÓCIO - COBRANÇA
  // ==========================================================================

  /**
   * Registra nova cobrança de locação
   */
  async registrarCobranca(data: NovaCobrancaData): Promise<HistoricoCobranca> {
    try {
      // Calcular saldo devedor
      const saldoDevedor = data.totalClientePaga - data.valorRecebido;

      // Determinar status baseado no pagamento
      let status: StatusPagamento = 'Pendente';
      if (data.valorRecebido >= data.totalClientePaga) {        status = 'Pago';
      } else if (data.valorRecebido > 0) {
        status = 'Parcial';
    
  }

      const novaCobranca: Omit<HistoricoCobranca, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> = {
        locacaoId: data.locacaoId,
        clienteId: data.clienteId,
        clienteNome: data.clienteNome,
        produtoIdentificador: data.produtoIdentificador,
        
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        dataPagamento: status === 'Pago' ? new Date().toISOString() : undefined,
        
        relogioAnterior: data.relogioAnterior,
        relogioAtual: data.relogioAtual,
        fichasRodadas: data.fichasRodadas,
        
        valorFicha: data.valorFicha,
        totalBruto: data.totalBruto,
        
        descontoPartidasQtd: data.descontoPartidasQtd,
        descontoPartidasValor: data.descontoPartidasValor,
        descontoDinheiro: data.descontoDinheiro,
        
        percentualEmpresa: data.percentualEmpresa,
        subtotalAposDescontos: data.subtotalAposDescontos,
        valorPercentual: data.valorPercentual,
        
        totalClientePaga: data.totalClientePaga,
        valorRecebido: data.valorRecebido,
        saldoDevedorGerado: saldoDevedor,
        
        status,
        dataVencimento: data.dataVencimento,
        observacao: data.observacao,
      };

      const cobranca = await this.save(novaCobranca);
      
      console.log('[CobrancaRepository] Cobrança registrada:', cobranca.id);
      return cobranca;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao registrar cobrança:', error);
      throw error;
  
  }

  }

  /**   * Atualiza status de pagamento
   */
  async atualizarPagamento(
    cobrancaId: string,
    valorRecebido: number,
    observacao?: string
  ): Promise<HistoricoCobranca | null> {
    try {
      const cobranca = await this.getById(cobrancaId);
      if (!cobranca) {
        console.warn('[CobrancaRepository] Cobrança não encontrada:', cobrancaId);
        return null;
    
  }

      // Calcular novo saldo
      const saldoDevedor = cobranca.totalClientePaga - valorRecebido;

      // Determinar novo status
      let status: StatusPagamento = 'Pendente';
      if (valorRecebido >= cobranca.totalClientePaga) {
        status = 'Pago';
      } else if (valorRecebido > 0) {
        status = 'Parcial';
    
  }

      const cobrancaAtualizada = await this.update({
        id: cobrancaId,
        valorRecebido,
        saldoDevedorGerado: saldoDevedor,
        status,
        dataPagamento: status === 'Pago' ? new Date().toISOString() : cobranca.dataPagamento,
        observacao: observacao || cobranca.observacao,
      });

      console.log('[CobrancaRepository] Pagamento atualizado:', cobrancaId);
      return cobrancaAtualizada;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao atualizar pagamento:', error);
      throw error;
  
  }

  }

  /**
   * Registra pagamento parcial
   */
  async registrarPagamentoParcial(
    cobrancaId: string,
    valorAdicional: number,
    observacao?: string
  ): Promise<HistoricoCobranca | null> {    try {
      const cobranca = await this.getById(cobrancaId);
      if (!cobranca) {
        console.warn('[CobrancaRepository] Cobrança não encontrada:', cobrancaId);
        return null;
    
  }

      const novoValorRecebido = cobranca.valorRecebido + valorAdicional;
      
      return await this.atualizarPagamento(cobrancaId, novoValorRecebido, observacao);
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao registrar pagamento parcial:', error);
      throw error;
  
  }

  }

  // ==========================================================================
  // MÉTODOS ESPECÍFICOS DE NEGÓCIO
  // ==========================================================================

  /**
   * Busca cobranças por locação (histórico)
   */
  async getByLocacao(locacaoId: string): Promise<HistoricoCobranca[]> {
    return await this.getAll({ locacaoId });

  }

  /**
   * Busca cobranças por cliente
   */
  async getByCliente(clienteId: string): Promise<CobrancaResumo[]> {
    try {
      const cobranças = await this.getAll({ clienteId });
      
      return cobranças.map(cobranca => ({
        id: cobranca.id,
        clienteNome: cobranca.clienteNome,
        produtoIdentificador: cobranca.produtoIdentificador,
        dataCobranca: cobranca.dataInicio,
        valorTotal: cobranca.totalClientePaga,
        valorRecebido: cobranca.valorRecebido,
        saldoDevedor: cobranca.saldoDevedorGerado,
        status: cobranca.status,
      }));
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao buscar cobranças por cliente:', error);
      return [];
  
  }

  }
  /**
   * Busca cobranças pendentes (para dashboard)
   */
  async getPendentes(): Promise<CobrancaPendente[]> {
    try {
      const cobranças = await this.getAll({ 
        status: 'Pendente' 
      });

      const hoje = new Date();
      
      return cobranças
        .filter(c => c.dataVencimento && new Date(c.dataVencimento) < hoje)
        .map(cobranca => ({
          locacaoId: String(cobranca.locacaoId),
          clienteId: String(cobranca.clienteId),
          clienteNome: cobranca.clienteNome,
          produtoIdentificador: cobranca.produtoIdentificador,
          dataVencimento: cobranca.dataVencimento!,
          valorPrevisto: cobranca.totalClientePaga,
          diasAtraso: this.calcularDiasAtraso(cobranca.dataVencimento!),
        }));
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao buscar cobranças pendentes:', error);
      return [];
  
  }

  }

  /**
   * Busca cobranças atrasadas por cliente
   */
  async getAtrasadasByCliente(clienteId: string): Promise<HistoricoCobranca[]> {
    try {
      const hoje = new Date().toISOString();
      const cobranças = await this.getAll({ 
        clienteId,
        status: 'Pendente',
        dataFim: hoje,
      });

      return cobranças.filter(c => 
        c.dataVencimento && new Date(c.dataVencimento) < new Date()
      );
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao buscar cobranças atrasadas:', error);
      return [];
  
  }

  }

  /**   * Busca histórico de cobranças de um produto
   */
  async getByProduto(produtoIdentificador: string): Promise<HistoricoCobranca[]> {
    return await this.getAll({ produtoIdentificador });

  }

  /**
   * Conta total de cobranças
   */
  async count(filters?: CobrancaFilters): Promise<number> {
    try {
      const cobranças = await this.getAll(filters);
      return cobranças.length;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao contar cobranças:', error);
      return 0;
  
  }

  }

  /**
   * Busca resumo financeiro (para dashboard)
   */
  async getResumoFinanceiro(
    dataInicio: string,
    dataFim: string
  ): Promise<{
    totalCobrado: number;
    totalRecebido: number;
    totalSaldoDevedor: number;
    totalPago: number;
    totalParcial: number;
    totalPendente: number;
  }> {
    try {
      const cobranças = await this.getAll({ dataInicio, dataFim });

      const resumo = cobranças.reduce(
        (acc, c) => ({
          totalCobrado: acc.totalCobrado + c.totalClientePaga,
          totalRecebido: acc.totalRecebido + c.valorRecebido,
          totalSaldoDevedor: acc.totalSaldoDevedor + c.saldoDevedorGerado,
          totalPago: acc.totalPago + (c.status === 'Pago' ? 1 : 0),
          totalParcial: acc.totalParcial + (c.status === 'Parcial' ? 1 : 0),
          totalPendente: acc.totalPendente + (c.status === 'Pendente' ? 1 : 0),
        }),
        {
          totalCobrado: 0,
          totalRecebido: 0,
          totalSaldoDevedor: 0,
          totalPago: 0,          totalParcial: 0,
          totalPendente: 0,
      
  }
      );

      return resumo;
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao buscar resumo financeiro:', error);
      return {
        totalCobrado: 0,
        totalRecebido: 0,
        totalSaldoDevedor: 0,
        totalPago: 0,
        totalParcial: 0,
        totalPendente: 0,
      };
  
  }

  }

  /**
   * Busca total de saldo devedor por cliente
   */
  async getTotalSaldoDevedorByCliente(clienteId: string): Promise<number> {
    try {
      const cobranças = await this.getAll({ clienteId });
      
      return cobranças.reduce(
        (total, c) => total + c.saldoDevedorGerado,
        0
      );
    } catch (error) {
      console.error('[CobrancaRepository] Erro ao calcular saldo devedor:', error);
      return 0;
  
  }

  }

  // ==========================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ==========================================================================

  /**
   * Calcula dias de atraso
   */
  private calcularDiasAtraso(dataVencimento: string): number {
    const vencimento = new Date(dataVencimento);
    const hoje = new Date();
    const diffTime = hoje.getTime() - vencimento.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);

  }
  /**
   * Gera ID único para a cobrança
   */
  private generateId(): string {
    return `cobranca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const cobrancaRepository = new CobrancaRepository();
export default cobrancaRepository;