/**
 * AuthService.ts
 * Serviço de autenticação com persistência local SQLite
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config/config';
import logger from '../utils/logger';
import { usuarioRepository, UsuarioLogin } from '../repositories/UsuarioRepository';
import { databaseService } from './DatabaseService';
import { TipoPermissaoUsuario, PermissoesUsuario } from '../types';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nome: string;
    role: string;
    tipoPermissao: TipoPermissaoUsuario;
    permissoes: PermissoesUsuario;
    rotasPermitidas: Array<string | number>;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nome: string;
    role: string;
  };
}

// Permissões padrão por tipo
const PERMISSOES_PADRAO: Record<TipoPermissaoUsuario, PermissoesUsuario> = {
  Administrador: {
    web: { todosCadastros: true, locacaoRelocacaoEstoque: true, relatorios: true },
    mobile: { todosCadastros: true, alteracaoRelogio: true, locacaoRelocacaoEstoque: true, cobrancasFaturas: true },
  },
  Secretario: {
    web: { todosCadastros: true, locacaoRelocacaoEstoque: true, relatorios: true },
    mobile: { todosCadastros: true, alteracaoRelogio: false, locacaoRelocacaoEstoque: true, cobrancasFaturas: true },
  },
  'AcessoControlado': {
    web: { todosCadastros: false, locacaoRelocacaoEstoque: false, relatorios: false },
    mobile: { todosCadastros: false, alteracaoRelogio: false, locacaoRelocacaoEstoque: false, cobrancasFaturas: true },
  },
};

class AuthService {
  /**
   * Login com email e senha
   * Tenta autenticar localmente primeiro, depois na API
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      logger.info('Tentando login', { email });

      // 1. Tentar autenticação local primeiro
      const usuarioLocal = await usuarioRepository.autenticar(email, password);
      
      if (usuarioLocal) {
        const response: LoginResponse = {
          token: 'local_jwt_token_' + Date.now(),
          user: {
            id: usuarioLocal.id,
            email: usuarioLocal.email,
            nome: usuarioLocal.nome,
            role: usuarioLocal.tipoPermissao,
            tipoPermissao: usuarioLocal.tipoPermissao,
            permissoes: usuarioLocal.permissoes,
            rotasPermitidas: usuarioLocal.rotasPermitidas,
          },
        };

        logger.info('Login local bem-sucedido', { email });
        return response;
      }

      // 2. Se não encontrou localmente, tentar API (quando disponível)
      // TODO: Integrar com API real
      // const response = await ApiService.post('/auth/login', { email, password });

      // 3. Modo de desenvolvimento: criar usuário automaticamente se não existir
      if (email && password) {
        const novoUsuario = await this.criarUsuarioPadrao(email, password);
        
        const response: LoginResponse = {
          token: 'local_jwt_token_' + Date.now(),
          user: {
            id: novoUsuario.id,
            email: novoUsuario.email,
            nome: novoUsuario.nome,
            role: novoUsuario.tipoPermissao,
            tipoPermissao: novoUsuario.tipoPermissao,
            permissoes: novoUsuario.permissoes,
            rotasPermitidas: novoUsuario.rotasPermitidas,
          },
        };

        logger.info('Login com novo usuário criado', { email });
        return response;
      }

      throw new Error('Email e/ou senha incorretos');
    } catch (error) {
      logger.error('Erro ao fazer login', error);
      throw error;
    }
  }

  /**
   * Criar usuário padrão para desenvolvimento
   */
  private async criarUsuarioPadrao(email: string, password: string) {
    const nome = email.split('@')[0];
    const isAdmin = email.toLowerCase().includes('admin');
    const tipoPermissao: TipoPermissaoUsuario = isAdmin ? 'Administrador' : 'AcessoControlado';
    
    const usuario = await usuarioRepository.save({
      id: `usr_${Date.now()}`,
      tipo: 'usuario',
      nome,
      email,
      senha: password, // Em produção, hash com bcrypt
      cpf: '',
      telefone: '',
      tipoPermissao,
      permissoes: PERMISSOES_PADRAO[tipoPermissao],
      rotasPermitidas: [],
      status: 'Ativo',
      bloqueado: false,
      syncStatus: 'pending',
      needsSync: true,
      version: 1,
      deviceId: '',
    });

    return usuario;
  }

  /**
   * Registrar novo usuário
   */
  async register(
    nome: string,
    email: string,
    password: string,
    tipoPermissao: TipoPermissaoUsuario = 'AcessoControlado'
  ): Promise<RegisterResponse> {
    try {
      logger.info('Tentando registrar', { email });

      // Verificar se email já existe
      const existe = await usuarioRepository.emailExiste(email);
      if (existe) {
        throw new Error('Este email já está cadastrado');
      }

      // Criar usuário local
      const usuario = await usuarioRepository.save({
        id: `usr_${Date.now()}`,
        tipo: 'usuario',
        nome,
        email,
        senha: password, // Em produção, hash com bcrypt
        cpf: '',
        telefone: '',
        tipoPermissao,
        permissoes: PERMISSOES_PADRAO[tipoPermissao],
        rotasPermitidas: [],
        status: 'Ativo',
        bloqueado: false,
        syncStatus: 'pending',
        needsSync: true,
        version: 1,
        deviceId: '',
      });

      const response: RegisterResponse = {
        token: 'local_jwt_token_' + Date.now(),
        user: {
          id: usuario.id,
          email: usuario.email,
          nome: usuario.nome,
          role: usuario.tipoPermissao,
        },
      };

      logger.info('Registro bem-sucedido', { email });
      return response;
    } catch (error) {
      logger.error('Erro ao registrar', error);
      throw error;
    }
  }

  /**
   * Validar token JWT
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      logger.info('Validando token');

      // Verificar se há usuário logado no AsyncStorage
      const userStr = await AsyncStorage.getItem(CONFIG.userStorageKey);
      if (userStr) {
        return true;
      }

      // Token local é sempre válido se o usuário existe
      if (token && token.startsWith('local_')) {
        return true;
      }

      // TODO: Validar token com API real
      // const response = await ApiService.post('/auth/validate', { token });
      // return response.data.valid;

      return false;
    } catch (error) {
      logger.error('Erro ao validar token', error);
      return false;
    }
  }

  /**
   * Refresh token (quando expira)
   */
  async refreshToken(token: string): Promise<string> {
    try {
      logger.info('Tentando renovar token');

      // TODO: Integrar com API real
      // const response = await ApiService.post('/auth/refresh', { token });
      // return response.data.token;

      // Token local renovado
      const newToken = 'local_jwt_token_refreshed_' + Date.now();
      logger.info('Token renovado');
      return newToken;
    } catch (error) {
      logger.error('Erro ao renovar token', error);
      throw error;
    }
  }

  /**
   * Logout (limpar dados locais)
   */
  async logout(): Promise<void> {
    try {
      logger.info('Fazendo logout');

      // Limpar AsyncStorage
      await AsyncStorage.removeItem(CONFIG.tokenStorageKey);
      await AsyncStorage.removeItem(CONFIG.userStorageKey);

      logger.info('Logout bem-sucedido');
    } catch (error) {
      logger.error('Erro ao fazer logout', error);
      throw error;
    }
  }

  /**
   * Verificar se há usuário logado
   */
  async getUsuarioLogado(): Promise<LoginResponse['user'] | null> {
    try {
      const userStr = await AsyncStorage.getItem(CONFIG.userStorageKey);
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      logger.error('Erro ao buscar usuário logado', error);
      return null;
    }
  }

  /**
   * Inicializar dados de autenticação
   */
  async inicializar(): Promise<void> {
    try {
      // Garantir que o banco está inicializado
      await databaseService.initialize();
      
      // Verificar se existe algum usuário, se não, criar admin padrão
      const usuarios = await usuarioRepository.getAll();
      
      if (usuarios.length === 0) {
        logger.info('Criando usuário admin padrão...');
        await usuarioRepository.save({
          id: 'usr_admin',
          tipo: 'usuario',
          nome: 'Administrador',
          email: 'admin@locacao.com',
          senha: 'admin123', // Em produção, hash com bcrypt
          cpf: '',
          telefone: '',
          tipoPermissao: 'Administrador',
          permissoes: PERMISSOES_PADRAO['Administrador'],
          rotasPermitidas: [],
          status: 'Ativo',
          bloqueado: false,
          syncStatus: 'pending',
          needsSync: true,
          version: 1,
          deviceId: '',
        });
        logger.info('Usuário admin padrão criado: admin@locacao.com / admin123');
      }
    } catch (error) {
      logger.error('Erro ao inicializar autenticação:', error);
    }
  }
}

export default new AuthService();
