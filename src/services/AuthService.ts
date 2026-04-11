/**
 * AuthService.ts
 * Serviço de autenticação com persistência local SQLite
 * Integração: API Web + Fallback Local (Offline-first)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config/config';
import { ENV } from '../config/env';
import logger from '../utils/logger';
import { usuarioRepository, UsuarioLogin } from '../repositories/UsuarioRepository';
import { databaseService } from './DatabaseService';
import { apiService } from './ApiService';
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

const BCRYPT_ROUNDS = 10;

async function hashSenha(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

class AuthService {
  /**
   * Login com email e senha
   * Estratégia: API primeiro (se USE_MOCK=false), depois local (offline-first)
   * IMPORTANTE: Só usa fallback local se houver erro de CONEXÃO, não erro de autenticação
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      logger.info('Tentando login', { email, useMock: ENV.USE_MOCK });

      // 1. Se não está em modo mock, tentar API primeiro
      if (!ENV.USE_MOCK) {
        logger.info('[Auth] Modo produção - tentando login via API...');
        
        const apiResponse = await apiService.login(email, password);
        
        logger.info('[Auth] Resposta da API:', { 
          success: apiResponse.success, 
          statusCode: apiResponse.statusCode,
          error: apiResponse.error 
        });
        
        if (apiResponse.success && apiResponse.data) {
          const { token, user } = apiResponse.data;
          
          // Salvar token no ApiService para requisições futuras
          apiService.setToken(token);
          
          // Salvar usuário localmente para offline
          await this.salvarUsuarioLocal(user, password);
          
          logger.info('[Auth] Login via API bem-sucedido', { email, userId: user.id });
          return { token, user };
        }
        
        // Se a API retornou erro de autenticação (401) ou bad request (400),
        // NÃO tentar fallback local - a senha está errada
        if (apiResponse.statusCode === 401 || apiResponse.statusCode === 400) {
          logger.warn('[Auth] Credenciais inválidas na API - não tentando fallback local');
          throw new Error('Email e/ou senha incorretos');
        }
        
        // Se a API retornou outro erro (500, etc), logar e tentar fallback
        if (apiResponse.statusCode && apiResponse.statusCode >= 500) {
          logger.warn('[Auth] Erro no servidor API, tentando fallback local...', { 
            statusCode: apiResponse.statusCode 
          });
        }
        
        // Se não tem statusCode (erro de rede), tentar fallback local
        if (!apiResponse.statusCode) {
          logger.warn('[Auth] Erro de conexão com API, tentando fallback local...', { 
            error: apiResponse.error 
          });
        }
      }

      // 2. Tentar autenticação local (fallback ou modo mock)
      logger.info('[Auth] Tentando autenticação local...');
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

        logger.info('[Auth] Login local bem-sucedido', { email });
        return response;
      }

      // 3. Nenhum método funcionou
      logger.warn('[Auth] Login falhou - nenhum método funcionou', { email });
      throw new Error('Email e/ou senha incorretos');
    } catch (error) {
      logger.error('[Auth] Erro ao fazer login', error);
      throw error;
    }
  }

  /**
   * Salva usuário localmente após login via API.
   * A senha é sempre armazenada como hash bcrypt — NUNCA em texto plano.
   */
  private async salvarUsuarioLocal(user: LoginResponse['user'], password: string): Promise<void> {
    try {
      const usuarioExistente = await databaseService.getUsuarioByEmail(user.email);

      // Reutilizar hash existente se ainda bate; caso contrário gerar novo hash.
      let senhaHash: string;
      const hashExistente: string | undefined = (usuarioExistente as any)?.senha;
      if (hashExistente && hashExistente.startsWith('$2')) {
        const bate = await bcrypt.compare(password, hashExistente);
        senhaHash = bate ? hashExistente : await hashSenha(password);
      } else {
        senhaHash = await hashSenha(password);
      }

      const dadosUsuario = {
        id: user.id,
        tipo: 'usuario',
        nome: user.nome,
        email: user.email,
        senha: senhaHash,
        cpf: (usuarioExistente as any)?.cpf || '',
        telefone: (usuarioExistente as any)?.telefone || '',
        tipoPermissao: user.tipoPermissao,
        permissoesWeb: JSON.stringify(user.permissoes.web),
        permissoesMobile: JSON.stringify(user.permissoes.mobile),
        rotasPermitidas: JSON.stringify(user.rotasPermitidas),
        status: user.status,
        bloqueado: false,
        syncStatus: 'synced',
        needsSync: false,
        version: (usuarioExistente as any)?.version || 1,
        deviceId: '',
        createdAt: (usuarioExistente as any)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await databaseService.saveUsuario(dadosUsuario);
      logger.info('Usuário salvo localmente (bcrypt)', { email: user.email });
    } catch (error) {
      logger.error('Erro ao salvar usuário local', error);
    }
  }

  private async criarUsuarioPadrao(email: string, password: string) {
    const nome = email.split('@')[0];
    const isAdmin = email.toLowerCase().includes('admin');
    const tipoPermissao: TipoPermissaoUsuario = isAdmin ? 'Administrador' : 'AcessoControlado';
    const senhaHash = await hashSenha(password);

    return usuarioRepository.save({
      id: `usr_${Date.now()}`,
      tipo: 'usuario',
      nome,
      email,
      senha: senhaHash,
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
  }

  async register(
    nome: string,
    email: string,
    password: string,
    tipoPermissao: TipoPermissaoUsuario = 'AcessoControlado'
  ): Promise<RegisterResponse> {
    try {
      logger.info('Tentando registrar', { email });

      const existe = await usuarioRepository.emailExiste(email);
      if (existe) throw new Error('Este email já está cadastrado');

      const senhaHash = await hashSenha(password);

      const usuario = await usuarioRepository.save({
        id: `usr_${Date.now()}`,
        tipo: 'usuario',
        nome,
        email,
        senha: senhaHash,
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

      logger.info('Registro bem-sucedido', { email });
      return {
        token: 'local_jwt_token_' + Date.now(),
        user: { id: usuario.id, email: usuario.email, nome: usuario.nome, role: usuario.tipoPermissao },
      };
    } catch (error) {
      logger.error('Erro ao registrar', error);
      throw error;
    }
  }

  /**
   * Valida token:
   * - Token real (Bearer): confirma com /api/auth/me; offline → fallback AsyncStorage.
   * - Token local (local_*): válido apenas se houver usuário no AsyncStorage.
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      logger.info('Validando token');

      if (token && token.startsWith('local_')) {
        const userStr = await AsyncStorage.getItem(CONFIG.userStorageKey);
        return !!userStr;
      }

      try {
        const response = await apiService.getUsuarioAtual();
        return !!(response.success && response.data);
      } catch {
        // Sem conectividade — fallback offline
        logger.warn('Sem conexão ao validar token, usando fallback local');
        const userStr = await AsyncStorage.getItem(CONFIG.userStorageKey);
        return !!userStr;
      }
    } catch (error) {
      logger.error('Erro ao validar token', error);
      return false;
    }
  }

  /**
   * Refresh de token.
   * O servidor não possui endpoint de refresh (tokens reais têm 30 dias de validade).
   * Token expirado → lança erro para forçar re-login.
   * Token local → renova localmente (modo offline).
   */
  async refreshToken(token: string): Promise<string> {
    if (token && token.startsWith('local_')) {
      return 'local_jwt_token_refreshed_' + Date.now();
    }
    throw new Error('Token expirado. Por favor, faça login novamente.');
  }

  async logout(): Promise<void> {
    try {
      logger.info('Fazendo logout');
      await AsyncStorage.removeItem(CONFIG.tokenStorageKey);
      await AsyncStorage.removeItem(CONFIG.userStorageKey);
      try { await apiService.logout(); } catch { /* best-effort */ }
      logger.info('Logout bem-sucedido');
    } catch (error) {
      logger.error('Erro ao fazer logout', error);
      throw error;
    }
  }

  async getUsuarioLogado(): Promise<LoginResponse['user'] | null> {
    try {
      const userStr = await AsyncStorage.getItem(CONFIG.userStorageKey);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      logger.error('Erro ao buscar usuário logado', error);
      return null;
    }
  }

  async inicializar(): Promise<void> {
    try {
      await databaseService.initialize();

      if (ENV.USE_MOCK) {
        logger.info('Modo desenvolvimento: Verificando usuário admin mockado...');
        const adminExistente = await databaseService.getUsuarioByEmail('admin@locacao.com');

        if (!adminExistente) {
          logger.info('Criando usuário admin padrão para desenvolvimento...');
          const mockPassword = ENV.MOCK_PASSWORD || 'admin123';
          const senhaHash = await hashSenha(mockPassword);

          await databaseService.saveUsuario({
            id: 'usr_admin',
            tipo: 'usuario',
            nome: 'Administrador',
            email: 'admin@locacao.com',
            senha: senhaHash,
            cpf: '',
            telefone: '',
            tipoPermissao: 'Administrador',
            permissoesWeb: JSON.stringify(PERMISSOES_PADRAO['Administrador'].web),
            permissoesMobile: JSON.stringify(PERMISSOES_PADRAO['Administrador'].mobile),
            rotasPermitidas: '[]',
            status: 'Ativo',
            bloqueado: false,
            syncStatus: 'pending',
            needsSync: true,
            version: 1,
            deviceId: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          logger.info('Usuário admin de desenvolvimento criado (bcrypt)');
        }
      } else {
        logger.info('Modo produção: Usuários serão sincronizados do servidor');
      }
    } catch (error) {
      logger.error('Erro ao inicializar autenticação:', error);
    }
  }
}

export default new AuthService();
