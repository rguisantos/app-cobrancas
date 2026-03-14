/**
 * UsuarioRepository.ts
 * Repositório para operações com Usuários
 * Persistência local usando SQLite (DatabaseService)
 */

import { databaseService } from '../services/DatabaseService';
import { 
  Usuario, 
  TipoPermissaoUsuario,
  PermissoesUsuario,
  EntityType 
} from '../types';

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
  rotasPermitidas: Array<string | number>;
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
      const whereClauses: string[] = ['deletedAt IS NULL'];
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

      const where = whereClauses.join(' AND ');
      const usuarios = await databaseService.getAll<Usuario>(
        this.entityType,
        where,
        params
      );

      return usuarios.map(this.parseUsuario);
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
      const id = usuario.id || `usr_${Date.now()}`;
      
      const usuarioData: any = {
        ...usuario,
        id,
        tipo: 'usuario',
        email: usuario.email.toLowerCase().trim(),
        permissoesWeb: JSON.stringify(usuario.permissoes?.web || {}),
        permissoesMobile: JSON.stringify(usuario.permissoes?.mobile || {}),
        rotasPermitidas: JSON.stringify(usuario.rotasPermitidas || []),
        syncStatus: 'pending',
        needsSync: true,
        createdAt: now,
        updatedAt: now,
      };

      // Verificar se existe
      const existing = await this.getByEmail(usuario.email);
      
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
  async update(usuario: Partial<Usuario> & { id: string }): Promise<Usuario | null> {
    try {
      const existing = await this.getById(usuario.id);
      if (!existing) {
        console.warn('[UsuarioRepository] Usuário não encontrado para atualização:', usuario.id);
        return null;
      }

      const usuarioAtualizado: any = {
        ...existing,
        ...usuario,
        updatedAt: new Date().toISOString(),
      };

      if (usuario.permissoes) {
        usuarioAtualizado.permissoesWeb = JSON.stringify(usuario.permissoes.web);
        usuarioAtualizado.permissoesMobile = JSON.stringify(usuario.permissoes.mobile);
      }

      if (usuario.rotasPermitidas) {
        usuarioAtualizado.rotasPermitidas = JSON.stringify(usuario.rotasPermitidas);
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
      const usuario = await this.getByEmail(email);
      
      if (!usuario) {
        console.log('[UsuarioRepository] Usuário não encontrado:', email);
        return null;
      }

      if (usuario.status !== 'Ativo') {
        console.log('[UsuarioRepository] Usuário inativo:', email);
        return null;
      }

      if (usuario.bloqueado) {
        console.log('[UsuarioRepository] Usuário bloqueado:', email);
        return null;
      }

      // Buscar a senha armazenada
      const result = await databaseService.getUsuarioByEmail(email);
      const senhaArmazenada = (result as any)?.senha;

      // Comparar senha (em produção usar bcrypt ou similar)
      if (senhaArmazenada && senhaArmazenada === senha) {
        // Atualizar último acesso
        await this.atualizarUltimoAcesso(usuario.id, 'Mobile');
        
        return {
          id: usuario.id,
          email: usuario.email,
          nome: usuario.nome,
          tipoPermissao: usuario.tipoPermissao,
          permissoes: usuario.permissoes,
          rotasPermitidas: usuario.rotasPermitidas,
          status: usuario.status,
        };
      }

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
      await databaseService.update(this.entityType, {
        id,
        senha: novaSenha, // Em produção, hash com bcrypt
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
      permissoes: {
        web: this.parseJSON(data.permissoesWeb, {}),
        mobile: this.parseJSON(data.permissoesMobile, {}),
      },
      rotasPermitidas: this.parseJSON(data.rotasPermitidas, []),
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
