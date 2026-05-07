/**
 * UsuarioRepository.ts
 * Repositório para operações com Usuários
 * Persistência local usando SQLite (DatabaseService)
 */

import bcrypt from 'bcryptjs';
import { databaseService } from '../services/DatabaseService';
import { 
  Usuario, 
  TipoPermissaoUsuario,
  PermissoesUsuario,
  EntityType 
} from '../types';
import logger from '../utils/logger';
import { generateId, parseJSON } from '../utils/database';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface UsuarioFilters {
  status?: 'Ativo' | 'Inativo';
  tipoPermissao?: TipoPermissaoUsuario;
  termoBusca?: string;
}

export interface UsuarioLogin {
  id: string;
  email: string;
  nome: string;
  tipoPermissao: TipoPermissaoUsuario;
  permissoes: PermissoesUsuario;
  rotasPermitidas: string[];
  status: 'Ativo' | 'Inativo';
}

// ============================================================================
// CLASSE USUARIO REPOSITORY
// ============================================================================

class UsuarioRepository {
  private entityType: EntityType = 'usuario';

  // ==========================================================================
  // OPERAÇÕES CRUD BÁSICAS
  // ==========================================================================

  /**
   * Busca todos os usuários (com filtros opcionais)
   */
  async getAll(filters?: UsuarioFilters): Promise<Usuario[]> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (filters?.status) {
        whereClauses.push('status = ?');
        params.push(filters.status);
      }

      if (filters?.tipoPermissao) {
        whereClauses.push('tipoPermissao = ?');
        params.push(filters.tipoPermissao);
      }

      if (filters?.termoBusca) {
        whereClauses.push('(nome LIKE ? OR email LIKE ?)');
        const termo = `%${filters.termoBusca}%`;
        params.push(termo, termo);
      }

      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : undefined;
      const usuarios = await databaseService.getAll<Usuario>(
        this.entityType,
        where,
        params
      );

      return usuarios.map(u => this.parseUsuario(u));
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao buscar usuários:', error);
      return [];
    }
  }

  /**
   * Busca usuário por ID
   */
  async getById(id: string): Promise<Usuario | null> {
    try {
      const usuario = await databaseService.getById<Usuario>(this.entityType, id);
      return usuario ? this.parseUsuario(usuario) : null;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao buscar usuário por ID:', error);
      return null;
    }
  }

  /**
   * Busca usuário por email
   */
  async getByEmail(email: string): Promise<Usuario | null> {
    try {
      const result = await databaseService.getUsuarioByEmail(email);
      return result ? this.parseUsuario(result) : null;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao buscar usuário por email:', error);
      return null;
    }
  }

  /**
   * Salva usuário (cria ou atualiza)
   */
  async save(usuario: Omit<Usuario, 'createdAt' | 'updatedAt'> & { senha?: string }): Promise<Usuario> {
    try {
      const now = new Date().toISOString();
      const existingById = usuario.id ? await this.getById(usuario.id) : null;
      const existingByEmail = await this.getByEmail(usuario.email);
      const existing = existingById || existingByEmail;
      const id = existing?.id || usuario.id || generateId('usuario');
      const deviceId = existing?.deviceId || await databaseService.getDeviceId();
      
      // Campos que pertencem à tabela usuarios
      const usuarioData: any = {
        id,
        tipo: 'usuario',
        nome: usuario.nome,
        cpf: usuario.cpf || '',
        telefone: usuario.telefone || '',
        email: usuario.email.toLowerCase().trim(),
        senha: usuario.senha || (existing as any)?.senha || '',
        tipoPermissao: usuario.tipoPermissao || 'AcessoControlado',
        permissoesWeb: JSON.stringify(usuario.permissoes?.web || {}),
        permissoesMobile: JSON.stringify(usuario.permissoes?.mobile || {}),
        rotasPermitidas: JSON.stringify(usuario.rotasPermitidas || []),
        status: usuario.status || 'Ativo',
        bloqueado: usuario.bloqueado ? 1 : 0, // Integer para SQLite
        syncStatus: 'pending',
        needsSync: 1, // Integer para SQLite
        version: existing?.version || 1,
        deviceId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      
      if (existing) {
        await databaseService.update(this.entityType, usuarioData);
      } else {
        await databaseService.save(this.entityType, usuarioData);
      }

      console.log('[UsuarioRepository] Usuário salvo:', usuario.email);
      return this.parseUsuario(usuarioData) as Usuario;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao salvar usuário:', error);
      throw error;
    }
  }

  /**
   * Atualiza usuário existente
   */
  async update(usuario: (Partial<Usuario> & { id: string }) & { senha?: string }): Promise<Usuario | null> {
    try {
      const existing = await this.getById(usuario.id);
      if (!existing) {
        console.warn('[UsuarioRepository] Usuário não encontrado para atualização:', usuario.id);
        return null;
      }

      const now = new Date().toISOString();
      const deviceId = existing.deviceId || await databaseService.getDeviceId();
      
      // Construir objeto de atualização com campos válidos
      const usuarioAtualizado: any = {
        id: usuario.id,
        tipo: 'usuario',
        nome: usuario.nome !== undefined ? usuario.nome : existing.nome,
        email: usuario.email !== undefined ? usuario.email.toLowerCase().trim() : existing.email,
        telefone: usuario.telefone !== undefined ? usuario.telefone : existing.telefone,
        cpf: usuario.cpf !== undefined ? usuario.cpf : existing.cpf,
        tipoPermissao: usuario.tipoPermissao !== undefined ? usuario.tipoPermissao : existing.tipoPermissao,
        status: usuario.status !== undefined ? usuario.status : existing.status,
        bloqueado: usuario.bloqueado !== undefined ? (usuario.bloqueado ? 1 : 0) : (existing.bloqueado ? 1 : 0),
        syncStatus: 'pending',
        lastSyncedAt: existing.lastSyncedAt,
        version: existing.version || 1,
        deviceId,
        updatedAt: now,
      };

      // Adicionar senha se fornecida
      if (usuario.senha) {
        usuarioAtualizado.senha = usuario.senha;
      }

      // Serializar permissões
      if (usuario.permissoes) {
        usuarioAtualizado.permissoesWeb = JSON.stringify(usuario.permissoes.web);
        usuarioAtualizado.permissoesMobile = JSON.stringify(usuario.permissoes.mobile);
      } else {
        usuarioAtualizado.permissoesWeb = JSON.stringify(existing.permissoes?.web || {});
        usuarioAtualizado.permissoesMobile = JSON.stringify(existing.permissoes?.mobile || {});
      }

      // Serializar rotas permitidas
      if (usuario.rotasPermitidas) {
        usuarioAtualizado.rotasPermitidas = JSON.stringify(usuario.rotasPermitidas);
      } else {
        usuarioAtualizado.rotasPermitidas = JSON.stringify(existing.rotasPermitidas || []);
      }

      await databaseService.update(this.entityType, usuarioAtualizado);
      
      console.log('[UsuarioRepository] Usuário atualizado:', usuario.id);
      return this.parseUsuario(usuarioAtualizado);
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  /**
   * Remove usuário (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    try {
      await databaseService.delete(this.entityType, id);
      console.log('[UsuarioRepository] Usuário removido:', id);
      return true;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao remover usuário:', error);
      return false;
    }
  }

  // ==========================================================================
  // MÉTODOS DE AUTENTICAÇÃO
  // ==========================================================================

  /**
   * Autentica usuário com email e senha
   */
  async autenticar(email: string, senha: string): Promise<UsuarioLogin | null> {
    try {
      console.log('[UsuarioRepository] Tentando autenticar:', email);
      
      // Buscar usuário diretamente do banco para ter todos os campos
      const result = await databaseService.getUsuarioByEmail(email);
      
      if (!result) {
        console.log('[UsuarioRepository] Usuário não encontrado:', email);
        return null;
      }
      
      console.log('[UsuarioRepository] Usuário encontrado:', {
        email: (result as any).email,
        status: (result as any).status,
        bloqueado: (result as any).bloqueado,
        temSenha: !!(result as any).senha,
      });

      if ((result as any).status !== 'Ativo') {
        console.log('[UsuarioRepository] Usuário inativo:', email);
        return null;
      }

      if ((result as any).bloqueado) {
        console.log('[UsuarioRepository] Usuário bloqueado:', email);
        return null;
      }

      const senhaArmazenada = (result as any).senha;

      // Comparar senha com bcrypt — apenas hash bcrypt é aceito
      // Senhas em plaintext são recusadas por segurança
      let senhaOk = false;
      if (senhaArmazenada) {
        if (senhaArmazenada.startsWith('$2')) {
          senhaOk = await bcrypt.compare(senha, senhaArmazenada);
        } else {
          // Senha não está em formato bcrypt — recusar login
          // O usuário deve redefinir a senha via fluxo de recuperação
          logger.warn('[UsuarioRepository] Senha armazenada não está em formato bcrypt. Login recusado por segurança.');
          return null;
        }
      }

      if (senhaOk) {
        logger.debug('[UsuarioRepository] Senha correta! Login autorizado.');
        
        // Atualizar último acesso
        await this.atualizarUltimoAcesso((result as any).id, 'Mobile');
        
        return {
          id: (result as any).id,
          email: (result as any).email,
          nome: (result as any).nome,
          tipoPermissao: (result as any).tipoPermissao,
          permissoes: {
            web: parseJSON((result as any).permissoesWeb, {
              clientes: false, produtos: false, rotas: false,
              locacaoRelocacaoEstoque: false, cobrancas: false, manutencoes: false, relogios: false,
              relatorios: false, dashboard: true, agenda: false, mapa: false,
              adminCadastros: false, adminUsuarios: false, adminDispositivos: false, adminSincronizacao: false, adminAuditoria: false,
            }),
            mobile: parseJSON((result as any).permissoesMobile, {
              clientes: false, produtos: false,
              alteracaoRelogio: false, locacaoRelocacaoEstoque: false, cobrancasFaturas: true, manutencoes: false,
              relatorios: false, sincronizacao: true,
            }),
          },
          rotasPermitidas: parseJSON((result as any).rotasPermitidas, []),
          status: (result as any).status,
        };
      }

      console.log('[UsuarioRepository] Senha incorreta para:', email);
      return null;
    } catch (error) {
      console.error('[UsuarioRepository] Erro na autenticação:', error);
      return null;
    }
  }

  /**
   * Atualiza data do último acesso
   */
  async atualizarUltimoAcesso(id: string, dispositivo: 'Web' | 'Mobile'): Promise<void> {
    try {
      const now = new Date().toISOString();
      await databaseService.update(this.entityType, {
        id,
        dataUltimoAcesso: now,
        ultimoAcessoDispositivo: dispositivo,
        updatedAt: now,
      } as any);
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao atualizar último acesso:', error);
    }
  }

  /**
   * Define nova senha para usuário
   */
  async definirSenha(id: string, novaSenha: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      // Se já é um hash bcrypt (migration path), armazenar diretamente;
      // caso contrário, gerar hash antes de armazenar.
      const senhaParaSalvar = novaSenha.startsWith('$2')
        ? novaSenha
        : await bcrypt.hash(novaSenha, 10);
      await databaseService.update(this.entityType, {
        id,
        senha: senhaParaSalvar,
        updatedAt: now,
      } as any);
      return true;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao definir senha:', error);
      return false;
    }
  }

  // ==========================================================================
  // MÉTODOS DE NEGÓCIO
  // ==========================================================================

  /**
   * Busca apenas usuários ativos
   */
  async getAtivos(): Promise<Usuario[]> {
    return this.getAll({ status: 'Ativo' });
  }

  /**
   * Busca usuários por tipo de permissão
   */
  async getByTipoPermissao(tipo: TipoPermissaoUsuario): Promise<Usuario[]> {
    return this.getAll({ tipoPermissao: tipo });
  }

  /**
   * Verifica se email já existe
   */
  async emailExiste(email: string, excludeId?: string): Promise<boolean> {
    try {
      const usuario = await this.getByEmail(email);
      if (!usuario) return false;
      if (excludeId && usuario.id === excludeId) return false;
      return true;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao verificar email:', error);
      return false;
    }
  }

  /**
   * Bloqueia/desbloqueia usuário
   */
  async toggleBloqueio(id: string): Promise<boolean> {
    try {
      const usuario = await this.getById(id);
      if (!usuario) return false;

      await this.update({
        id,
        bloqueado: !usuario.bloqueado,
      });

      return true;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao alternar bloqueio:', error);
      return false;
    }
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  /**
   * Parseia dados do banco para objeto Usuario
   */
  private parseUsuario(data: any): Usuario {
    return {
      ...data,
      bloqueado: data.bloqueado === 1 || data.bloqueado === true,
      permissoes: {
        web: parseJSON(data.permissoesWeb, {}),
        mobile: parseJSON(data.permissoesMobile, {}),
      },
      rotasPermitidas: parseJSON(data.rotasPermitidas, []),
    };
  }

  /**
   * Conta total de usuários
   */
  async count(filters?: UsuarioFilters): Promise<number> {
    try {
      const usuarios = await this.getAll(filters);
      return usuarios.length;
    } catch (error) {
      console.error('[UsuarioRepository] Erro ao contar usuários:', error);
      return 0;
    }
  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const usuarioRepository = new UsuarioRepository();
export default usuarioRepository;
