/**
 * ClienteRepository.ts
 * Repositório para operações com Clientes
 * Integração: DatabaseService (expo-sqlite) + Tipos TypeScript
 */

import { databaseService } from '../services/DatabaseService';
import { 
  Cliente, 
  ClienteListItem, 
  EntityType,
  SyncableEntity 
} from '../types';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface ClienteFilters {
  rotaId?: string | number;
  status?: 'Ativo' | 'Inativo';
  cidade?: string;
  estado?: string;
  termoBusca?: string; // Busca por nome, CPF, telefone
}

export interface ClienteComLocacoes extends Cliente {
  totalLocacoesAtivas: number;
  totalLocacoesFinalizadas: number;
  saldoDevedorTotal: number;
}

// ============================================================================
// CLASSE CLIENTE REPOSITORY
// ============================================================================

class ClienteRepository {
  private entityType: EntityType = 'cliente';

  // ==========================================================================
  // OPERAÇÕES CRUD BÁSICAS
  // ==========================================================================

  /**
   * Busca todos os clientes (com filtros opcionais)
   */
  async getAll(filters?: ClienteFilters): Promise<ClienteListItem[]> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];
      // Aplicar filtros
      if (filters?.rotaId) {
        whereClauses.push('rotaId = ?');
        params.push(String(filters.rotaId));
    
  }

      if (filters?.status) {
        whereClauses.push('status = ?');
        params.push(filters.status);
    
  }

      if (filters?.cidade) {
        whereClauses.push('cidade = ?');
        params.push(filters.cidade);
    
  }

      if (filters?.estado) {
        whereClauses.push('estado = ?');
        params.push(filters.estado);
    
  }

      if (filters?.termoBusca) {
        // Busca por nome, CPF ou CNPJ (colunas separadas) ou telefone
        whereClauses.push('(nomeExibicao LIKE ? OR cpf LIKE ? OR cnpj LIKE ? OR telefonePrincipal LIKE ?)');
        const termo = `%${filters.termoBusca}%`;
        params.push(termo, termo, termo, termo);
      }

      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : undefined;
      const clientes = await databaseService.getAll<Cliente>(
        this.entityType,
        where,
        params
      );

      // Mapear para ClienteListItem (mais leve para listagem)
      return clientes.map(cliente => this.toListItem(cliente));
    } catch (error) {
      console.error('[ClienteRepository] Erro ao buscar clientes:', error);
      return [];
  
  }

  }

  /**
   * Busca cliente por ID
   */
  async getById(id: string): Promise<Cliente | null> {
    try {
      const cliente = await databaseService.getById<Cliente>(this.entityType, id);
      return cliente ? this.parseCliente(cliente) : null;
    } catch (error) {
      console.error('[ClienteRepository] Erro ao buscar cliente por ID:', error);
      return null;
    }
  }

  /**
   * Busca cliente com dados de locações (para tela de detalhes)
   */
  async getByIdWithLocacoes(id: string): Promise<ClienteComLocacoes | null> {
    try {
      const cliente = await this.getById(id);
      if (!cliente) return null;

      // Buscar contagem de locações (será implementado no LocacaoRepository)
      const locacoesCount = await this.getLocacoesCount(id);

      return {
        ...cliente,
        ...locacoesCount,
      };
    } catch (error) {
      console.error('[ClienteRepository] Erro ao buscar cliente com locações:', error);
      return null;
  
  }

  }

  /**
   * Salva cliente (cria ou atualiza)
   */
  async save(cliente: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'lastSyncedAt' | 'needsSync' | 'version' | 'deviceId' | 'tipo'> & { id?: string }): Promise<Cliente> {
    try {
      // Gerar ID único se não existir
      const id = cliente.id || this.generateId();
      const now = new Date().toISOString();
      
      // Mapear cpfCnpj para cpf ou cnpj baseado no tipoPessoa
      const cpf = cliente.tipoPessoa === 'Fisica' ? (cliente.cpfCnpj || cliente.cpf || '') : '';
      const cnpj = cliente.tipoPessoa === 'Juridica' ? (cliente.cpfCnpj || cliente.cnpj || '') : '';
      
      // Mapear rgIe para rg ou inscricaoEstadual
      const rg = cliente.tipoPessoa === 'Fisica' ? ((cliente as any).rgIe || cliente.rg || '') : '';
      const inscricaoEstadual = cliente.tipoPessoa === 'Juridica' ? ((cliente as any).rgIe || cliente.inscricaoEstadual || '') : '';
      
      const clienteCompleto: any = {
        id,
        tipo: this.entityType,
        tipoPessoa: cliente.tipoPessoa,
        identificador: cliente.tipoPessoa === 'Fisica' ? cpf : cnpj,
        cpf,
        cnpj,
        rg,
        inscricaoEstadual,
        nomeCompleto: cliente.tipoPessoa === 'Fisica' ? cliente.nomeExibicao : '',
        razaoSocial: cliente.tipoPessoa === 'Juridica' ? cliente.nomeExibicao : '',
        nomeFantasia: cliente.nomeFantasia || '',
        nomeExibicao: cliente.nomeExibicao,
        email: cliente.email || '',
        telefonePrincipal: cliente.telefonePrincipal || '',
        contatos: JSON.stringify(cliente.contatos || []), // Serializar para JSON
        cep: cliente.cep || '',
        logradouro: cliente.logradouro || '',
        numero: cliente.numero || '',
        complemento: cliente.complemento || '',
        bairro: cliente.bairro || '',
        cidade: cliente.cidade || '',
        estado: cliente.estado || '',
        rotaId: cliente.rotaId || '',
        rotaNome: cliente.rotaNome || '',
        status: cliente.status || 'Ativo',
        observacao: cliente.observacao || '',
        syncStatus: 'pending',
        lastSyncedAt: null,
        needsSync: 1,
        version: 0,
        deviceId: await databaseService.getDeviceId(),
        createdAt: now,
        updatedAt: now,
      };

      await databaseService.save(this.entityType, clienteCompleto);
      
      console.log('[ClienteRepository] Cliente salvo:', clienteCompleto.id);
      return this.parseCliente(clienteCompleto);
    } catch (error) {
      console.error('[ClienteRepository] Erro ao salvar cliente:', error);
      throw error;
    }
  }

  /**
   * Atualiza cliente existente
   */
  async update(cliente: Partial<Cliente> & { id: string }): Promise<Cliente | null> {
    try {
      const existing = await this.getById(cliente.id);
      if (!existing) {
        console.warn('[ClienteRepository] Cliente não encontrado para atualização:', cliente.id);
        return null;
      }

      // Remover campos computados de AMBOS os objetos antes do merge
      // (existing vem de parseCliente que já injeta cpfCnpj e rgIe)
      const { cpfCnpj: _ea, rgIe: _eb, ...existingSemVirtuais } = existing as any;
      const { cpfCnpj, rgIe, ...clienteSemCamposVirtuais } = cliente as any;

      const clienteAtualizado: any = {
        ...existingSemVirtuais,
        ...clienteSemCamposVirtuais,
        updatedAt: new Date().toISOString(),
        version: (existing.version || 0) + 1,
      };

      // Serializar contatos se fornecido
      if (clienteSemCamposVirtuais.contatos) {
        clienteAtualizado.contatos = JSON.stringify(clienteSemCamposVirtuais.contatos);
      }

      await databaseService.update(this.entityType, clienteAtualizado);
      
      console.log('[ClienteRepository] Cliente atualizado:', cliente.id);
      return this.parseCliente(clienteAtualizado);
    } catch (error) {
      console.error('[ClienteRepository] Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  /**
   * Remove cliente (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await databaseService.delete(this.entityType, id);
      console.log('[ClienteRepository] Cliente removido:', id);
      return true;
    } catch (error) {
      console.error('[ClienteRepository] Erro ao remover cliente:', error);
      return false;
    }
  }

  // ==========================================================================
  // MÉTODOS ESPECÍFICOS DE NEGÓCIO
  // ==========================================================================

  /**
   * Busca clientes por rota
   */
  async getByRota(rotaId: string | number): Promise<ClienteListItem[]> {
    return this.getAll({ rotaId, status: 'Ativo' });
  }

  /**
   * Busca clientes ativos
   */
  async getAtivos(): Promise<ClienteListItem[]> {
    return this.getAll({ status: 'Ativo' });
  }

  /**
   * Busca clientes inativos
   */
  async getInativos(): Promise<ClienteListItem[]> {
    return this.getAll({ status: 'Inativo' });
  }

  /**
   * Busca avançada (nome, CPF, telefone, cidade)
   */
  async search(termo: string): Promise<ClienteListItem[]> {
    if (!termo || termo.trim().length === 0) {
      return this.getAtivos();
    }
    return this.getAll({ termoBusca: termo });
  }

  /**
   * Busca cliente por CPF/CNPJ
   */
  async getByDocumento(documento: string): Promise<Cliente | null> {
    try {
      const clientes = await databaseService.getAll<Cliente>(
        this.entityType,
        '(cpf = ? OR cnpj = ?)',
        [documento, documento]
      );
      return clientes.length > 0 ? this.parseCliente(clientes[0]) : null;
    } catch (error) {
      console.error('[ClienteRepository] Erro ao buscar cliente por documento:', error);
      return null;
    }
  }

  /**
   * Verifica se CPF/CNPJ já está cadastrado (exceto o próprio cliente)
   */
  async documentoExists(documento: string, excludeId?: string): Promise<boolean> {
    try {
      const cliente = await this.getByDocumento(documento);
      if (!cliente) return false;
      if (excludeId && cliente.id === excludeId) return false;
      return true;
    } catch (error) {
      console.error('[ClienteRepository] Erro ao verificar documento:', error);
      return false;
    }
  }

  /**
   * Conta total de clientes
   */
  async count(filters?: ClienteFilters): Promise<number> {
    try {
      const clientes = await this.getAll(filters);
      return clientes.length;
    } catch (error) {
      console.error('[ClienteRepository] Erro ao contar clientes:', error);
      return 0;
    }
  }

  /**
   * Busca clientes com saldo devedor
   */
  async getComSaldoDevedor(): Promise<ClienteComLocacoes[]> {
    try {
      const clientes = await databaseService.getAll<Cliente>(
        this.entityType,
        'status = ?',
        ['Ativo']
      );

      const clientesComSaldo: ClienteComLocacoes[] = [];
      for (const cliente of clientes) {
        const locacoesCount = await this.getLocacoesCount(cliente.id);
        if (locacoesCount.saldoDevedorTotal > 0) {
          clientesComSaldo.push({
            ...this.parseCliente(cliente),
            ...locacoesCount,
          });
        }
      }
      return clientesComSaldo;
    } catch (error) {
      console.error('[ClienteRepository] Erro ao buscar clientes com saldo devedor:', error);
      return [];
    }
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES PRIVADOS
  // ==========================================================================

  /**
   * Parseia dados do banco para objeto Cliente
   * Converte campos JSON de volta para objetos/arrays
   */
  private parseCliente(data: any): Cliente {
    return {
      ...data,
      cpfCnpj: data.cpfCnpj || data.cpf || data.cnpj || '',
      rgIe: data.rgIe || data.rg || data.inscricaoEstadual || '',
      contatos: this.parseJSON(data.contatos, []),
    };
  }

  /**
   * Parseia JSON com fallback
   */
  private parseJSON<T>(value: string | undefined | null, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  /**
   * Converte Cliente completo para ClienteListItem (mais leve)
   */
  private toListItem(cliente: Cliente): ClienteListItem {
    return {
      id: cliente.id,
      nomeExibicao: cliente.nomeExibicao,
      cpfCnpj: cliente.cpfCnpj || cliente.cpf || cliente.cnpj,
      rotaNome: cliente.rotaNome || '',
      cidade: cliente.cidade,
      estado: cliente.estado,
      status: cliente.status,
    };

  }

  /**
   * Gera ID único para o cliente
   */
  private generateId(): string {
    return `cliente_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  }

  /**
   * Busca contagem de locações do cliente
   * (Será implementado quando criarmos o LocacaoRepository)
   */
  private async getLocacoesCount(clienteId: string): Promise<{
    totalLocacoesAtivas: number;
    totalLocacoesFinalizadas: number;
    saldoDevedorTotal: number;
  }> {
    try {
      const { locacaoRepository }   = await import('./LocacaoRepository');
      const { cobrancaRepository }  = await import('./CobrancaRepository');
      const [ativas, finalizadas, saldo] = await Promise.all([
        locacaoRepository.count({ clienteId, status: 'Ativa' }),
        locacaoRepository.count({ clienteId, status: 'Finalizada' }),
        cobrancaRepository.getTotalSaldoDevedorByCliente(clienteId),
      ]);
      return {
        totalLocacoesAtivas:     ativas,
        totalLocacoesFinalizadas: finalizadas,
        saldoDevedorTotal:       saldo,
      };
    } catch {
      return { totalLocacoesAtivas: 0, totalLocacoesFinalizadas: 0, saldoDevedorTotal: 0 };
    }
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const clienteRepository = new ClienteRepository();
export default clienteRepository;