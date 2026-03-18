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
    status: 'Ativo' | 'Inativo';
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

      // 1. Tentar autenticação local
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
            status: usuarioLocal.status,
          },
        };

        logger.info('Login local bem-sucedido', { email });
        return response;
      }

      // 2. Se não encontrou localmente, tentar API (quando disponível)
      // TODO: Integrar com API real
      // const response = await ApiService.post('/auth/login', { email, password });

      // Não criar usuário automaticamente - apenas retornar erro
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
      bloqueado: 0, // Integer para SQLite
      syncStatus: 'pending',
      needsSync: 1,
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
        bloqueado: 0, // Integer para SQLite
        syncStatus: 'pending',
        needsSync: 1,
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
      
      logger.info('Verificando usuário admin...');
      
      // Buscar admin existente diretamente do banco
      const adminExistente = await databaseService.getUsuarioByEmail('admin@locacao.com');
      
      if (!adminExistente) {
        // Criar novo admin
        logger.info('Criando usuário admin padrão...');
        await databaseService.saveUsuario({
          id: 'usr_admin',
          tipo: 'usuario',
          nome: 'Administrador',
          email: 'admin@locacao.com',
          senha: 'admin123',
          cpf: '',
          telefone: '',
          tipoPermissao: 'Administrador',
          permissoesWeb: JSON.stringify(PERMISSOES_PADRAO['Administrador'].web),
          permissoesMobile: JSON.stringify(PERMISSOES_PADRAO['Administrador'].mobile),
          rotasPermitidas: '[]',
          status: 'Ativo',
          bloqueado: 0, // Integer para SQLite
          syncStatus: 'pending',
          needsSync: 1,
          version: 1,
          deviceId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        logger.info('Usuário admin criado: admin@locacao.com / admin123');
      } else {
        // Garantir que o admin tem a senha correta
        logger.info('Admin já existe, verificando credenciais...');
        
        if ((adminExistente as any).senha !== 'admin123' || (adminExistente as any).status !== 'Ativo') {
          logger.info('Atualizando credenciais do admin...');
          await databaseService.saveUsuario({
            id: adminExistente.id || 'usr_admin',
            tipo: 'usuario',
            nome: 'Administrador',
            email: 'admin@locacao.com',
            senha: 'admin123',
            cpf: (adminExistente as any).cpf || '',
            telefone: (adminExistente as any).telefone || '',
            tipoPermissao: 'Administrador',
            permissoesWeb: JSON.stringify(PERMISSOES_PADRAO['Administrador'].web),
            permissoesMobile: JSON.stringify(PERMISSOES_PADRAO['Administrador'].mobile),
            rotasPermitidas: '[]',
            status: 'Ativo',
            bloqueado: 0, // Integer para SQLite
            syncStatus: 'pending',
            needsSync: 1,
            version: ((adminExistente as any).version || 0) + 1,
            deviceId: '',
            createdAt: (adminExistente as any).createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          logger.info('Credenciais do admin atualizadas');
        }
      }
      
      // Verificar se ficou correto
      const verificado = await databaseService.getUsuarioByEmail('admin@locacao.com');
      logger.info('Verificação admin:', { 
        email: (verificado as any)?.email, 
        senha: (verificado as any)?.senha ? '***definida***' : 'NÃO DEFINIDA',
        status: (verificado as any)?.status 
      });
      
    } catch (error) {
      logger.error('Erro ao inicializar autenticação:', error);
    }
  }
}

export default new AuthService();
