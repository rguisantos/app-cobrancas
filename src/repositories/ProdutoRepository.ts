/**
 * ProdutoRepository.ts
 * Repositório para operações com Produtos
 * Integração: DatabaseService (expo-sqlite) + Tipos TypeScript
 */

import { databaseService } from '../services/DatabaseService';
import { 
  Produto, 
  ProdutoListItem, 
  EntityType,
  ProdutoHistoricoRelogio,
  StatusProduto
} from '../types';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface ProdutoFilters {
  tipoId?: string | number;
  descricaoId?: string | number;
  tamanhoId?: string | number;
  statusProduto?: StatusProduto;
  conservacao?: string;
  estabelecimento?: string;
  termoBusca?: string; // Busca por identificador, tipo, descrição
  comLocacaoAtiva?: boolean; // true = locados, false = disponíveis
  rotaId?: string | number; // Filtro por rota do cliente (se locado)
}

export interface ProdutoComLocacao extends Produto {
  estaLocado: boolean;
  locacaoAtual?: {
    locacaoId: string;
    clienteId: string;
    clienteNome: string;
    dataInicio: string;
    rotaNome?: string;
  };
}

export interface ProdutoResumo {
  id: string;
  identificador: string;
  tipoNome: string;
  descricaoNome: string;
  tamanhoNome: string;
  estaLocado: boolean;
  clienteNome?: string;}

// ============================================================================
// CLASSE PRODUTO REPOSITORY
// ============================================================================

class ProdutoRepository {
  private entityType: EntityType = 'produto';

  // ==========================================================================
  // OPERAÇÕES CRUD BÁSICAS
  // ==========================================================================

  /**
   * Busca todos os produtos (com filtros opcionais)
   */
  async getAll(filters?: ProdutoFilters): Promise<ProdutoListItem[]> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];

      // Aplicar filtros
      if (filters?.tipoId) {
        whereClauses.push('tipoId = ?');
        params.push(String(filters.tipoId));
    
  }

      if (filters?.descricaoId) {
        whereClauses.push('descricaoId = ?');
        params.push(String(filters.descricaoId));
    
  }

      if (filters?.tamanhoId) {
        whereClauses.push('tamanhoId = ?');
        params.push(String(filters.tamanhoId));
    
  }

      if (filters?.statusProduto) {
        whereClauses.push('statusProduto = ?');
        params.push(filters.statusProduto);
    
  }

      if (filters?.conservacao) {
        whereClauses.push('conservacao = ?');
        params.push(filters.conservacao);
    
  }

      if (filters?.estabelecimento) {
        whereClauses.push('estabelecimento = ?');
        params.push(filters.estabelecimento);    
  }

      if (filters?.termoBusca) {
        whereClauses.push('(identificador LIKE ? OR tipoNome LIKE ? OR descricaoNome LIKE ?)');
        const termo = `%${filters.termoBusca}%`;
        params.push(termo, termo, termo);
    
  }

      // Filtro para produtos locados vs disponíveis usando subquery em locacoes
      if (filters?.comLocacaoAtiva === true) {
        // Produtos com locação ativa
        whereClauses.push(`id IN (SELECT produtoId FROM locacoes WHERE status = 'Ativa' AND deletedAt IS NULL)`);
      } else if (filters?.comLocacaoAtiva === false) {
        // Produtos SEM locação ativa (disponíveis para locar)
        whereClauses.push(`id NOT IN (SELECT produtoId FROM locacoes WHERE status = 'Ativa' AND deletedAt IS NULL)`);
      }

      const where = whereClauses.join(' AND ');
      const produtos = await databaseService.getAll<Produto>(
        this.entityType,
        where,
        params
      );

      // Mapear para ProdutoListItem (mais leve para listagem)
      return produtos.map(produto => this.toListItem(produto));
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao buscar produtos:', error);
      return [];
  
  }

  }

  /**
   * Busca produto por ID
   */
  async getById(id: string): Promise<Produto | null> {
    try {
      const produto = await databaseService.getById<Produto>(this.entityType, id);
      return produto;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao buscar produto por ID:', error);
      return null;
  
  }

  }

  /**
   * Busca produto por identificador (numeração física)
   */
  async getByIdentificador(identificador: string): Promise<Produto | null> {    try {
      const produtos = await databaseService.getAll<Produto>(
        this.entityType,
        'identificador = ?',
        [identificador]
      );

      return produtos.length > 0 ? produtos[0] : null;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao buscar produto por identificador:', error);
      return null;
  
  }

  }

  /**
   * Busca produto com dados de locação atual
   */
  async getByIdWithLocacao(id: string): Promise<ProdutoComLocacao | null> {
    try {
      const produto = await this.getById(id);
      if (!produto) return null;

      // Verificar se está locado (será implementado com LocacaoRepository)
      const locacaoAtual = await this.getLocacaoAtual(produto.id);

      return {
        ...produto,
        estaLocado: !!locacaoAtual,
        locacaoAtual,
      };
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao buscar produto com locação:', error);
      return null;
  
  }

  }

  /**
   * Salva produto (cria ou atualiza)
   */
  async save(produto: Omit<Produto, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> & { id?: string }): Promise<Produto> {
    try {
      // Remover campo de relacionamento antes de salvar
      const { locacaoAtiva, ...produtoSemRelacionamentos } = produto as any;

      // Gerar ID único se não existir
      const produtoCompleto: Produto = {
        ...produtoSemRelacionamentos,
        id: produto.id || this.generateId(),
        tipo: this.entityType,
        syncStatus: 'pending',
        lastSyncedAt: undefined,
        needsSync: 1, // Integer para SQLite
        version: 0,
        deviceId: await databaseService.getDeviceId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await databaseService.save(this.entityType, produtoCompleto);
      
      console.log('[ProdutoRepository] Produto salvo:', produtoCompleto.id);
      return produtoCompleto;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao salvar produto:', error);
      throw error;
  
  }

  }

  /**
   * Atualiza produto existente
   */
  async update(produto: Partial<Produto> & { id: string }): Promise<Produto | null> {
    try {
      const existing = await this.getById(produto.id);
      if (!existing) {
        console.warn('[ProdutoRepository] Produto não encontrado para atualização:', produto.id);
        return null;
    
  }

      const produtoAtualizado: Produto = {
        ...existing,
        ...produto,
        updatedAt: new Date().toISOString(),
        version: (existing.version || 0) + 1,
      };

      await databaseService.update(this.entityType, produtoAtualizado);
      
      console.log('[ProdutoRepository] Produto atualizado:', produto.id);
      return produtoAtualizado;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao atualizar produto:', error);
      throw error;
  
  }

  }

  /**
   * Remove produto (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await databaseService.delete(this.entityType, id);
      console.log('[ProdutoRepository] Produto removido:', id);      return true;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao remover produto:', error);
      return false;
  
  }

  }

  // ==========================================================================
  // MÉTODOS ESPECÍFICOS DE NEGÓCIO
  // ==========================================================================

  /**
   * Busca produtos disponíveis para locação (em estoque/barracão)
   */
  async getDisponiveis(): Promise<ProdutoListItem[]> {
    return this.getAll({ 
      statusProduto: 'Ativo',
      comLocacaoAtiva: false 
    });

  }

  /**
   * Busca produtos locados (com cliente)
   */
  async getLocados(): Promise<ProdutoListItem[]> {
    return this.getAll({ 
      comLocacaoAtiva: true 
    });

  }

  /**
   * Busca produtos em manutenção
   */
  async getEmManutencao(): Promise<ProdutoListItem[]> {
    return this.getAll({ 
      statusProduto: 'Manutenção' 
    });

  }

  /**
   * Busca produtos inativos
   */
  async getInativos(): Promise<ProdutoListItem[]> {
    return this.getAll({ 
      statusProduto: 'Inativo' 
    });

  }

  /**
   * Busca avançada (identificador, tipo, descrição, tamanho)
   */
  async search(termo: string): Promise<ProdutoListItem[]> {
    if (!termo || termo.trim().length === 0) {
      return this.getAll({ statusProduto: 'Ativo' });
    }
    return this.getAll({ termoBusca: termo });
  }

  /**
   * Alias para search (compatibilidade)
   */
  async buscar(termo: string): Promise<ProdutoListItem[]> {
    return this.search(termo);
  }

  /**
   * Verifica se identificador já está cadastrado (exceto o próprio produto)
   */
  async identificadorExists(identificador: string, excludeId?: string): Promise<boolean> {
    try {
      const produto = await this.getByIdentificador(identificador);
      
      if (!produto) return false;
      if (excludeId && produto.id === excludeId) return false;
      
      return true;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao verificar identificador:', error);
      return false;
  
  }

  }

  /**
   * Busca produto por número do relógio
   */
  async getByNumeroRelogio(numeroRelogio: string): Promise<Produto | null> {
    try {
      const produtos = await databaseService.getAll<Produto>(
        this.entityType,
        'numeroRelogio = ?',
        [numeroRelogio]
      );

      return produtos.length > 0 ? produtos[0] : null;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao buscar produto por número do relógio:', error);
      return null;
  
  }

  }

  /**
   * Conta total de produtos
   */
  async count(filters?: ProdutoFilters): Promise<number> {
    try {
      const produtos = await this.getAll(filters);      return produtos.length;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao contar produtos:', error);
      return 0;
  
  }

  }

  /**
   * Busca resumo de produtos (para dashboard)
   */
  async getResumo(): Promise<{
    totalProdutos: number;
    totalLocados: number;
    totalDisponiveis: number;
    totalManutencao: number;
  }> {
    try {
      const [total, locados, disponiveis, manutencao] = await Promise.all([
        this.count(),
        this.count({ comLocacaoAtiva: true }),
        this.count({ comLocacaoAtiva: false, statusProduto: 'Ativo' }),
        this.count({ statusProduto: 'Manutenção' }),
      ]);

      return {
        totalProdutos: total,
        totalLocados: locados,
        totalDisponiveis: disponiveis,
        totalManutencao: manutencao,
      };
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao buscar resumo de produtos:', error);
      return {
        totalProdutos: 0,
        totalLocados: 0,
        totalDisponiveis: 0,
        totalManutencao: 0,
      };
  
  }

  }

  /**
   * Atualiza número do relógio do produto
   */
  async atualizarNumeroRelogio(
    produtoId: string,
    novoNumeroRelogio: string,
    motivo: string,
    usuarioResponsavel: string
  ): Promise<boolean> {    try {
      const produto = await this.getById(produtoId);
      if (!produto) {
        console.warn('[ProdutoRepository] Produto não encontrado:', produtoId);
        return false;
    
  }

      // Atualizar produto
      await this.update({
        id: produtoId,
        numeroRelogio: novoNumeroRelogio,
      });

      // Atualizar ultimaLeituraRelogio na locação ativa, se existir
      try {
        const { locacaoRepository } = await import('./LocacaoRepository');
        const locacaoAtiva = await locacaoRepository.getAtivaByProduto(produtoId);
        if (locacaoAtiva) {
          await locacaoRepository.update({
            id: String(locacaoAtiva.id),
            ultimaLeituraRelogio: parseInt(novoNumeroRelogio, 10) || 0,
          });
          console.log('[ProdutoRepository] ultimaLeituraRelogio atualizado na locação:', locacaoAtiva.id);
        }
      } catch (e) {
        console.warn('[ProdutoRepository] Não foi possível atualizar locação:', e);
      }
      
      const historico: ProdutoHistoricoRelogio = {
        id: this.generateId(),
        produtoId,
        relogioAnterior: produto.numeroRelogio,
        relogioNovo: novoNumeroRelogio,
        motivo,
        dataAlteracao: new Date().toISOString(),
        usuarioResponsavel,
      };
      console.log('[ProdutoRepository] Histórico de relógio:', historico);

      console.log('[ProdutoRepository] Número do relógio atualizado:', produtoId);
      return true;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao atualizar número do relógio:', error);
      return false;
  
  }

  }

  /**
   * Envia produto para estoque (desvincula de cliente)
   */
  async enviarParaEstoque(
    produtoId: string,
    estabelecimento: string,
    motivo: string
  ): Promise<boolean> {
    try {
      await this.update({
        id: produtoId,
        estabelecimento,
        observacao: motivo,
        statusProduto: 'Ativo', // Volta para ativo quando vai para estoque
      });
      console.log('[ProdutoRepository] Produto enviado para estoque:', produtoId);
      return true;
    } catch (error) {
      console.error('[ProdutoRepository] Erro ao enviar produto para estoque:', error);
      return false;
  
  }

  }

  // ==========================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ==========================================================================

  /**
   * Converte Produto completo para ProdutoListItem (mais leve)
   */
  private toListItem(produto: Produto): ProdutoListItem {
    return {
      id: produto.id,
      identificador: produto.identificador,
      tipoNome: produto.tipoNome,
      descricaoNome: produto.descricaoNome,
      tamanhoNome: produto.tamanhoNome,
      statusProduto: produto.statusProduto,
      // clienteNome será preenchido quando tivermos integração com LocacaoRepository
    };

  }

  /**
   * Gera ID único para o produto
   */
  private generateId(): string {
    return `produto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  }

  /**
   * Busca locação atual do produto
   * (Será implementado quando LocacaoRepository for criado)
   */
  private async getLocacaoAtual(produtoId: string): Promise<{
    locacaoId: string;
    clienteId: string;
    clienteNome: string;
    dataInicio: string;
    rotaNome?: string;
  } | undefined> {
    // TODO: Implementar quando LocacaoRepository for criado
    // Por enquanto retorna undefined
    return undefined;
  }}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const produtoRepository = new ProdutoRepository();
export default produtoRepository;