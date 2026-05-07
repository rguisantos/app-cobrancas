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
import { generateId, parseJSON } from '../utils/database';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Remove caracteres não-numéricos de um documento (CPF/CNPJ).
 * Usado para o campo `identificador` (busca rápida e unicidade) e para
 * garantir compatibilidade com o backend que espera dígitos limpos.
 */
function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface ClienteFilters {
  rotaId?: string;
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
        // Busca por nome, identificador (dígitos limpos), CPF, CNPJ ou telefone
        whereClauses.push('(nomeExibicao LIKE ? OR identificador LIKE ? OR cpf LIKE ? OR cnpj LIKE ? OR telefonePrincipal LIKE ?)');
        const termo = `%${filters.termoBusca}%`;
        params.push(termo, termo, termo, termo, termo);
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
      const id = cliente.id || generateId('cliente');
      const now = new Date().toISOString();
      
      // Mapear cpfCnpj para cpf ou cnpj baseado no tipoPessoa
      const cpf = cliente.tipoPessoa === 'Fisica' ? (cliente.cpfCnpj || cliente.cpf || '') : '';
      const cnpj = cliente.tipoPessoa === 'Juridica' ? (cliente.cpfCnpj || cliente.cnpj || '') : '';
      
      // Mapear rgIe para rg ou inscricaoEstadual
      const rg = cliente.tipoPessoa === 'Fisica' ? ((cliente as any).rgIe || cliente.rg || '') : '';
      const inscricaoEstadual = cliente.tipoPessoa === 'Juridica' ? ((cliente as any).rgIe || cliente.inscricaoEstadual || '') : '';
      
      // identificador: dígitos limpos para busca rápida e unicidade (backend usa DateTime + unique)
      const identificador = cleanDocument(
        cliente.tipoPessoa === 'Fisica' ? cpf : cnpj
      );
      
      const clienteCompleto: any = {
        id,
        tipo: this.entityType,
        tipoPessoa: cliente.tipoPessoa || 'Fisica', // Garantir default
        identificador,
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
        latitude: cliente.latitude ?? null,
        longitude: cliente.longitude ?? null,
        rotaId: cliente.rotaId || '',
        rotaNome: cliente.rotaNome || '',
        status: cliente.status || 'Ativo',
        dataCadastro: cliente.dataCadastro || now, // ISO DateTime compatível com backend
        dataUltimaAlteracao: now, // ISO DateTime compatível com backend
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

      // IMPORTANTE: Mapear cpfCnpj e rgIe para os campos corretos
      // Se o formulário enviou cpfCnpj, mapear para cpf ou cnpj baseado no tipoPessoa
      const tipoPessoa = clienteSemCamposVirtuais.tipoPessoa || existing.tipoPessoa;
      const cpfAtualizado = cpfCnpj && tipoPessoa === 'Fisica' ? cpfCnpj : (clienteSemCamposVirtuais.cpf || existingSemVirtuais.cpf);
      const cnpjAtualizado = cpfCnpj && tipoPessoa === 'Juridica' ? cpfCnpj : (clienteSemCamposVirtuais.cnpj || existingSemVirtuais.cnpj);
      const rgAtualizado = rgIe && tipoPessoa === 'Fisica' ? rgIe : (clienteSemCamposVirtuais.rg || existingSemVirtuais.rg);
      const inscricaoEstadualAtualizada = rgIe && tipoPessoa === 'Juridica' ? rgIe : (clienteSemCamposVirtuais.inscricaoEstadual || existingSemVirtuais.inscricaoEstadual);

      const now = new Date().toISOString();

      const clienteAtualizado: any = {
        ...existingSemVirtuais,
        ...clienteSemCamposVirtuais,
        tipoPessoa, // Garantir que tipoPessoa esteja sempre presente
        cpf: cpfAtualizado,
        cnpj: cnpjAtualizado,
        rg: rgAtualizado,
        inscricaoEstadual: inscricaoEstadualAtualizada,
        // identificador: dígitos limpos para busca rápida e unicidade
        identificador: cleanDocument(
          tipoPessoa === 'Fisica' ? cpfAtualizado : cnpjAtualizado
        ),
        // Sincronizar nomeExibicao com nomeCompleto (PF) ou razaoSocial (PJ)
        nomeCompleto: tipoPessoa === 'Fisica' ? (clienteSemCamposVirtuais.nomeExibicao || existingSemVirtuais.nomeExibicao) : '',
        razaoSocial: tipoPessoa === 'Juridica' ? (clienteSemCamposVirtuais.nomeExibicao || existingSemVirtuais.nomeExibicao) : '',
        dataUltimaAlteracao: now, // ISO DateTime — compatível com backend
        updatedAt: now,
        version: (existing.version || 0) + 1,
      };

      // Serializar contatos para JSON (sempre, para evitar array em SQLite)
      // - Se o update inclui novos contatos: serializar os novos
      // - Se o update NÃO inclui contatos: existingSemVirtuais.contatos já é um array
      //   (vindo de parseCliente), precisamos re-serializar para string JSON
      if (clienteSemCamposVirtuais.contatos) {
        clienteAtualizado.contatos = JSON.stringify(clienteSemCamposVirtuais.contatos);
      } else if (existingSemVirtuais.contatos && typeof existingSemVirtuais.contatos !== 'string') {
        clienteAtualizado.contatos = JSON.stringify(existingSemVirtuais.contatos);
      }

      await databaseService.update(this.entityType, clienteAtualizado);
      
      console.log('[ClienteRepository] Cliente atualizado:', cliente.id, {
        cpf: clienteAtualizado.cpf,
        rg: clienteAtualizado.rg
      });
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
  async getByRota(rotaId: string): Promise<ClienteListItem[]> {
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
   * Compatível com documentos mascarados (formulário mobile) e limpos (backend API)
   */
  async getByDocumento(documento: string): Promise<Cliente | null> {
    try {
      const cleanDoc = cleanDocument(documento);
      // Buscar por identificador (dígitos limpos), cpf/cnpj (pode estar mascarado ou limpo),
      // ou pelos dígitos limpos do cpf/cnpj
      const clientes = await databaseService.getAll<Cliente>(
        this.entityType,
        '(identificador = ? OR cpf = ? OR cnpj = ? OR REPLACE(REPLACE(REPLACE(REPLACE(cpf, ".", ""), "-", ""), "/", ""), " ", "") = ? OR REPLACE(REPLACE(REPLACE(REPLACE(cnpj, ".", ""), "-", ""), "/", ""), " ", "") = ?)',
        [cleanDoc, documento, documento, cleanDoc, cleanDoc]
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
      // Busca otimizada: uma única query SQL em vez de N+1 queries por cliente.
      // Filtra clientes ativos, não bloqueados, que tenham saldo devedor > 0
      // usando a ÚLTIMA cobrança por locação (ROW_NUMBER) para evitar duplicação.
      const rows = await databaseService.getAllAsync<any>(
        `SELECT
           c.id, c.tipo, c.tipoPessoa, c.identificador, c.nomeExibicao,
           c.nomeCompleto, c.razaoSocial, c.nomeFantasia, c.cpf, c.cnpj,
           c.rg, c.inscricaoEstadual, c.email, c.telefonePrincipal,
           c.contatos, c.cep, c.logradouro, c.numero, c.complemento,
           c.bairro, c.cidade, c.estado, c.latitude, c.longitude,
           c.rotaId, c.rotaNome,
           c.status, c.observacao, c.dataCadastro, c.dataUltimaAlteracao,
           c.syncStatus, c.lastSyncedAt, c.needsSync, c.version,
           c.deviceId, c.createdAt, c.updatedAt, c.deletedAt,
           COALESCE(lativas.cnt, 0)     AS totalLocacoesAtivas,
           COALESCE(lfinal.cnt, 0)      AS totalLocacoesFinalizadas,
           COALESCE(saldo.total, 0)     AS saldoDevedorTotal
         FROM clientes c
         -- Locações ativas
         LEFT JOIN (
           SELECT clienteId, COUNT(*) AS cnt
           FROM locacoes
           WHERE deletedAt IS NULL AND status = 'Ativa'
           GROUP BY clienteId
         ) lativas ON lativas.clienteId = c.id
         -- Locações finalizadas
         LEFT JOIN (
           SELECT clienteId, COUNT(*) AS cnt
           FROM locacoes
           WHERE deletedAt IS NULL AND status = 'Finalizada'
           GROUP BY clienteId
         ) lfinal ON lfinal.clienteId = c.id
         -- Saldo devedor: somente a última cobrança de cada locação
         LEFT JOIN (
           SELECT clienteId, SUM(saldoDevedorGerado) AS total
           FROM (
             SELECT clienteId, locacaoId, saldoDevedorGerado,
                    ROW_NUMBER() OVER (PARTITION BY locacaoId ORDER BY updatedAt DESC, createdAt DESC) AS rn
             FROM cobrancas
             WHERE deletedAt IS NULL AND status != 'Pago' AND saldoDevedorGerado > 0
           ) WHERE rn = 1
           GROUP BY clienteId
         ) saldo ON saldo.clienteId = c.id
         WHERE c.deletedAt IS NULL
           AND c.status = 'Ativo'
           AND c.bloqueado != 1
           AND COALESCE(saldo.total, 0) > 0
         ORDER BY saldo.total DESC`,
        []
      );

      return rows.map(row => ({
        ...this.parseCliente(row),
        totalLocacoesAtivas:     row.totalLocacoesAtivas,
        totalLocacoesFinalizadas: row.totalLocacoesFinalizadas,
        saldoDevedorTotal:       row.saldoDevedorTotal,
      }));
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
   * Garante compatibilidade com o backend (DateTime como ISO string, contatos como array)
   */
  private parseCliente(data: any): Cliente {
    return {
      ...data,
      cpfCnpj: data.cpfCnpj || data.cpf || data.cnpj || '',
      rgIe: data.rgIe || data.rg || data.inscricaoEstadual || '',
      contatos: parseJSON(data.contatos, []),
      // Garantir que campos numéricos venham como number (SQLite pode retornar null)
      latitude: data.latitude != null ? Number(data.latitude) : undefined,
      longitude: data.longitude != null ? Number(data.longitude) : undefined,
      // Garantir que date fields estejam em formato ISO string (backend usa DateTime)
      dataCadastro: data.dataCadastro || undefined,
      dataUltimaAlteracao: data.dataUltimaAlteracao || undefined,
    };
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