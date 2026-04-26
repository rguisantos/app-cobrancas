/**
 * AuthService.ts
 * Serviço de autenticação com persistência local SQLite
 * Integração: API Web + Fallback Local (Offline-first)
 * 
 * Refatorado para:
 * - Usar SecureStore para tokens (criptografia nativa)
 * - Usar endpoint de refresh token para renovação
 * - Suportar autenticação biométrica
 * - Feedback de lockout e rate limiting
 */

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../config/config';
import { ENV } from '../config/env';
import logger from '../utils/logger';
import { usuarioRepository, UsuarioLogin } from '../repositories/UsuarioRepository';
import { databaseService } from './DatabaseService';
import { apiService } from './ApiService';
import { secureStorage } from './SecureStorage';
import { TipoPermissaoUsuario, PermissoesUsuario } from '../types';

interface LoginResponse {
  token: string;
  refreshToken?: string;
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

interface LockoutInfo {
  locked: boolean;
  minutosRestantes?: number;
}

const PERMISSOES_PADRAO: Record<TipoPermissaoUsuario, PermissoesUsuario> = {
  Administrador: {
    web: {
      clientes: true, produtos: true, rotas: true,
      locacaoRelocacaoEstoque: true, cobrancas: true, manutencoes: true, relogios: true,
      relatorios: true, dashboard: true, agenda: true, mapa: true,
      adminCadastros: true, adminUsuarios: true, adminDispositivos: true, adminSincronizacao: true, adminAuditoria: true,
    },
    mobile: {
      clientes: true, produtos: true,
      alteracaoRelogio: true, locacaoRelocacaoEstoque: true, cobrancasFaturas: true, manutencoes: true,
      relatorios: true, sincronizacao: true,
    },
  },
  Secretario: {
    web: {
      clientes: true, produtos: true, rotas: true,
      locacaoRelocacaoEstoque: true, cobrancas: true, manutencoes: true, relogios: true,
      relatorios: true, dashboard: true, agenda: true, mapa: true,
      adminCadastros: false, adminUsuarios: false, adminDispositivos: false, adminSincronizacao: false, adminAuditoria: false,
    },
    mobile: {
      clientes: true, produtos: true,
      alteracaoRelogio: false, locacaoRelocacaoEstoque: true, cobrancasFaturas: true, manutencoes: true,
      relatorios: true, sincronizacao: true,
    },
  },
  'AcessoControlado': {
    web: {
      clientes: false, produtos: false, rotas: false,
      locacaoRelocacaoEstoque: false, cobrancas: false, manutencoes: false, relogios: false,
      relatorios: false, dashboard: true, agenda: false, mapa: false,
      adminCadastros: false, adminUsuarios: false, adminDispositivos: false, adminSincronizacao: false, adminAuditoria: false,
    },
    mobile: {
      clientes: false, produtos: false,
      alteracaoRelogio: false, locacaoRelocacaoEstoque: false, cobrancasFaturas: true, manutencoes: false,
      relatorios: false, sincronizacao: true,
    },
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
   * 
   * Retorna informações detalhadas sobre lockout e rate limiting.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      logger.info('Tentando login', { email, useMock: ENV.USE_MOCK });

      // 1. Se não está em modo mock, tentar API primeiro
      if (!ENV.USE_MOCK) {
        logger.info('[Auth] Modo produção - tentando login via API...');
        
        const apiResponse = await apiService.login(email, password);
        
        if (apiResponse.success && apiResponse.data) {
          const { token, user } = apiResponse.data;
          
          // Salvar token no ApiService para requisições futuras
          apiService.setToken(token);
          
          // Salvar tokens de forma segura
          await secureStorage.saveAccessToken(token);
          if (apiResponse.data.refreshToken) {
            await secureStorage.saveRefreshToken(apiResponse.data.refreshToken);
          }
          
          // Salvar usuário localmente para offline
          await this.salvarUsuarioLocal(user, password);
          
          logger.info('[Auth] Login via API bem-sucedido', { email, userId: user.id });
          return { token, refreshToken: apiResponse.data.refreshToken, user };
        }
        
        // Se a API retornou erro de autenticação (401) ou bad request (400),
        // NÃO tentar fallback local - a senha está errada
        if (apiResponse.statusCode === 401 || apiResponse.statusCode === 400) {
          logger.warn('[Auth] Credenciais inválidas na API - não tentando fallback local');
          throw new Error('Email e/ou senha incorretos');
        }
        
        // Se a API retornou conta bloqueada (423)
        if (apiResponse.statusCode === 423) {
          logger.warn('[Auth] Conta bloqueada por tentativas falhas');
          const lockoutError: Error & { lockoutInfo?: LockoutInfo } = new Error(
            apiResponse.error || 'Conta temporariamente bloqueada'
          );
          // Tentar extrair informações de lockout do erro
          if (typeof apiResponse.error === 'string' && apiResponse.error.includes('minutos')) {
            const match = apiResponse.error.match(/(\d+)\s*minutos/);
            if (match) {
              lockoutError.lockoutInfo = { locked: true, minutosRestantes: parseInt(match[1]) };
            }
          }
          throw lockoutError;
        }
        
        // Se a API retornou rate limiting (429)
        if (apiResponse.statusCode === 429) {
          logger.warn('[Auth] Rate limiting atingido');
          throw new Error('Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.');
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
        // Gerar token local criptograficamente seguro (sem prefixo óbvio)
        const localToken = await this.gerarTokenLocal(usuarioLocal.id);
        
        const response: LoginResponse = {
          token: localToken,
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

        // Salvar token local de forma segura
        await secureStorage.saveAccessToken(localToken);

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
   * Gera um token local seguro para autenticação offline.
   * Usa timestamp + random bytes para garantir unicidade e não-previsibilidade.
   */
  private async gerarTokenLocal(usuarioId: string): Promise<string> {
    // Token local com estrutura não-óbvia, criptograficamente seguro
    const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const timestamp = Date.now().toString(36);
    const userIdHash = usuarioId.slice(0, 8);
    return `loc_${timestamp}_${userIdHash}_${randomPart}`;
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
        token: await this.gerarTokenLocal(usuario.id),
        user: { id: usuario.id, email: usuario.email, nome: usuario.nome, role: usuario.tipoPermissao },
      };
    } catch (error) {
      logger.error('Erro ao registrar', error);
      throw error;
    }
  }

  /**
   * Valida token:
   * - Token real (Bearer): confirma com /api/auth/me; offline → fallback SecureStore.
   * - Token local (loc_*): válido apenas se houver usuário no armazenamento.
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      logger.info('Validando token');

      if (token && token.startsWith('loc_')) {
        const userJson = await secureStorage.getUser();
        return !!userJson;
      }

      try {
        const response = await apiService.getUsuarioAtual();
        return !!(response.success && response.data);
      } catch {
        // Sem conectividade — fallback offline
        logger.warn('Sem conexão ao validar token, usando fallback local');
        const userJson = await secureStorage.getUser();
        return !!userJson;
      }
    } catch (error) {
      logger.error('Erro ao validar token', error);
      return false;
    }
  }

  /**
   * Refresh de token via endpoint dedicado.
   * Usa o refresh token armazenado no SecureStore para obter novos tokens.
   * Se o refresh falhar (expirado/revogado), força re-login.
   */
  async refreshToken(): Promise<string> {
    const currentToken = await secureStorage.getAccessToken();
    
    // Token local não pode ser renovado via API
    if (currentToken && currentToken.startsWith('loc_')) {
      // Renovar token local mantendo a sessão offline
      const userJson = await secureStorage.getUser();
      if (userJson) {
        const user = JSON.parse(userJson);
        const newLocalToken = await this.gerarTokenLocal(user.id);
        await secureStorage.saveAccessToken(newLocalToken);
        apiService.setToken(newLocalToken);
        return newLocalToken;
      }
      throw new Error('Sessão local expirada. Faça login novamente.');
    }

    // Tentar refresh via API
    const storedRefreshToken = await secureStorage.getRefreshToken();
    
    if (!storedRefreshToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    try {
      const response = await fetch(`${ENV.API_URL}/api/mobile/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) {
        // Refresh token inválido ou expirado — limpar e forçar re-login
        await secureStorage.clearAuthData();
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const data = await response.json();

      if (data.success && data.token) {
        // Salvar novos tokens
        await secureStorage.saveAccessToken(data.token);
        if (data.refreshToken) {
          await secureStorage.saveRefreshToken(data.refreshToken);
        }
        apiService.setToken(data.token);

        // Atualizar dados do usuário se retornados
        if (data.user) {
          await secureStorage.saveUser(JSON.stringify(data.user));
        }

        logger.info('[Auth] Token renovado com sucesso via refresh');
        return data.token;
      }

      throw new Error('Falha ao renovar sessão. Faça login novamente.');
    } catch (error) {
      if (error instanceof TypeError) {
        // Erro de rede — não podemos renovar, mas a sessão local ainda é válida
        logger.warn('[Auth] Sem conexão ao renovar token — sessão local mantida');
        return currentToken || '';
      }
      throw error;
    }
  }

  /**
   * Autenticação biométrica.
   * Verifica se o dispositivo suporta biometria e se o usuário habilitou.
   * Retorna true se a autenticação foi bem-sucedida.
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      const biometricEnabled = await secureStorage.isBiometricEnabled();
      if (!biometricEnabled) return false;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return false;

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autenticar no App Cobranças',
        cancelLabel: 'Usar senha',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Restaurar sessão do SecureStore
        const token = await secureStorage.getAccessToken();
        const userJson = await secureStorage.getUser();
        
        if (token && userJson) {
          apiService.setToken(token);
          logger.info('[Auth] Autenticação biométrica bem-sucedida');
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[Auth] Erro na autenticação biométrica:', error);
      return false;
    }
  }

  /**
   * Verifica se a biometria está disponível e habilitada.
   */
  async isBiometricAvailable(): Promise<{ available: boolean; enabled: boolean }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const enabled = await secureStorage.isBiometricEnabled();
      
      return {
        available: hasHardware && isEnrolled,
        enabled,
      };
    } catch {
      return { available: false, enabled: false };
    }
  }

  /**
   * Habilita ou desabilita login biométrico.
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      const { available } = await this.isBiometricAvailable();
      if (!available) {
        throw new Error('Biometria não disponível neste dispositivo');
      }
    }
    await secureStorage.setBiometricEnabled(enabled);
    logger.info(`[Auth] Biometria ${enabled ? 'habilitada' : 'desabilitada'}`);
  }

  async logout(): Promise<void> {
    try {
      logger.info('Fazendo logout');
      
      // Tentar revogar sessão no servidor
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken && !ENV.USE_MOCK) {
        try {
          await apiService.logout();
        } catch { /* best-effort */ }
      }
      
      // Limpar dados de autenticação (mantém dados do dispositivo)
      await secureStorage.clearAuthData();
      
      // Limpar token do ApiService
      apiService.setToken(null);
      
      logger.info('Logout bem-sucedido (dispositivo permanece ativado)');
    } catch (error) {
      logger.error('Erro ao fazer logout', error);
      throw error;
    }
  }

  async getUsuarioLogado(): Promise<LoginResponse['user'] | null> {
    try {
      const userStr = await secureStorage.getUser();
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      logger.error('Erro ao buscar usuário logado', error);
      return null;
    }
  }

  async inicializar(): Promise<void> {
    try {
      await databaseService.initialize();
      
      // Migrar tokens do AsyncStorage antigo para SecureStore
      await secureStorage.migrateFromAsyncStorage();

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
