/**
 * AuthService.ts
 * Simplified authentication service — API-first with local offline fallback.
 *
 * Strategy:
 * 1. Online → API login, store user + tokens locally for offline use
 * 2. Offline → Local auth via bcrypt password check against stored user in SQLite
 * 3. No LOCAL_ token prefix — use a simple `isLocalSession` flag instead
 */

import * as LocalAuthentication from 'expo-local-authentication';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env';
import logger from '../utils/logger';
import { usuarioRepository, UsuarioLogin } from '../repositories/UsuarioRepository';
import { databaseService } from './DatabaseService';
import { apiService } from './ApiService';
import { secureStorage } from './SecureStorage';
import { TipoPermissaoUsuario, PermissoesUsuario } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  isLocalSession: boolean;
  user: {
    id: string;
    email: string;
    nome: string;
    role: string;
    tipoPermissao: TipoPermissaoUsuario;
    permissoes: PermissoesUsuario;
    rotasPermitidas: string[];
    status: 'Ativo' | 'Inativo';
  };
}

export interface LockoutInfo {
  locked: boolean;
  minutosRestantes?: number;
}

interface StoredUsuarioData {
  id: string;
  tipo: string;
  nome: string;
  email: string;
  senha: string;
  cpf: string;
  telefone: string;
  tipoPermissao: TipoPermissaoUsuario;
  permissoesWeb: string;
  permissoesMobile: string;
  rotasPermitidas: string;
  status: 'Ativo' | 'Inativo';
  bloqueado: boolean | number;
  tentativasLoginFalhas: number;
  bloqueadoAte: string | null;
  syncStatus: string;
  needsSync: boolean | number;
  version: number;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BCRYPT_ROUNDS = 10;

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

// ============================================================================
// HELPERS
// ============================================================================

async function hashSenha(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

// ============================================================================
// SERVICE
// ============================================================================

class AuthService {

  // ─── LOGIN ──────────────────────────────────────────────────────────

  /**
   * Login with email + password.
   * API-first: tries the server, falls back to local bcrypt only on network errors.
   * Auth errors (401/400/423/429) are never retried locally.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      logger.info('[AuthService] Login attempt', { email });

      // ── 1. API login (if not in mock mode) ──
      if (!ENV.USE_MOCK) {
        try {
          const apiResponse = await apiService.login(email, password);

          if (apiResponse.success && apiResponse.data) {
            const { token, refreshToken } = apiResponse.data;
            const user = apiResponse.data.user;

            // Persist tokens securely
            await secureStorage.saveAccessToken(token);
            if (refreshToken) {
              await secureStorage.saveRefreshToken(refreshToken);
            }

            // Store user locally for offline access
            await this.saveUserLocally(user, password);

            // Mark this is NOT a local-only session
            await secureStorage.setLocalSessionFlag(false);

            apiService.setToken(token);

            logger.info('[AuthService] API login successful', { email, userId: user.id });
            return { token, refreshToken, isLocalSession: false, user };
          }

          // ── Non-retryable API errors ──
          if (apiResponse.statusCode === 401 || apiResponse.statusCode === 400) {
            throw new Error('Email e/ou senha incorretos');
          }

          if (apiResponse.statusCode === 423) {
            const lockoutError: Error & { lockoutInfo?: LockoutInfo } = new Error(
              typeof apiResponse.error === 'string'
                ? apiResponse.error
                : 'Conta temporariamente bloqueada'
            );
            const responseData = apiResponse.data as any;
            if (responseData?.lockoutInfo) {
              lockoutError.lockoutInfo = {
                locked: true,
                minutosRestantes: responseData.lockoutInfo.minutosRestantes,
              };
            }
            throw lockoutError;
          }

          if (apiResponse.statusCode === 429) {
            throw new Error('Muitas tentativas de login. Aguarde alguns minutos.');
          }

          // Server error (5xx) or no statusCode → fall through to local fallback
          logger.warn('[AuthService] API unreachable or server error, trying local fallback', {
            statusCode: apiResponse.statusCode,
          });

        } catch (apiError) {
          // If it's an auth/lockout error we just threw, re-throw it
          if (apiError instanceof Error && !isNetworkError(apiError)) {
            const msg = apiError.message;
            if (
              msg === 'Email e/ou senha incorretos' ||
              msg.includes('bloqueada') ||
              msg.includes('Muitas tentativas')
            ) {
              throw apiError;
            }
          }
          // Network error → fall through to local fallback
          logger.warn('[AuthService] Network error, trying local fallback');
        }
      }

      // ── 2. Local fallback ──
      return await this.loginLocally(email, password);

    } catch (error) {
      logger.error('[AuthService] Login failed', error);
      throw error;
    }
  }

  /**
   * Authenticate against the local SQLite database using bcrypt.
   */
  private async loginLocally(email: string, password: string): Promise<LoginResponse> {
    logger.info('[AuthService] Attempting local authentication', { email });

    const usuarioLocal = await usuarioRepository.autenticar(email, password);

    if (!usuarioLocal) {
      throw new Error('Email e/ou senha incorretos');
    }

    // Generate a random session token (not a JWT — just a session identifier)
    const sessionToken = this.generateSessionToken(usuarioLocal.id);

    const user: LoginResponse['user'] = {
      id: usuarioLocal.id,
      email: usuarioLocal.email,
      nome: usuarioLocal.nome,
      role: usuarioLocal.tipoPermissao,
      tipoPermissao: usuarioLocal.tipoPermissao,
      permissoes: usuarioLocal.permissoes,
      rotasPermitidas: usuarioLocal.rotasPermitidas,
      status: usuarioLocal.status,
    };

    // Persist local session
    await secureStorage.saveAccessToken(sessionToken);
    await secureStorage.setLocalSessionFlag(true);
    apiService.setToken(sessionToken);

    logger.info('[AuthService] Local login successful', { email });
    return { token: sessionToken, isLocalSession: true, user };
  }

  /**
   * Generate a random session token for offline use.
   * No special prefix — just an opaque random string.
   */
  private generateSessionToken(userId: string): string {
    const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const timestamp = Date.now().toString(36);
    return `${timestamp}.${userId.slice(0, 8)}.${randomBytes}`;
  }

  // ─── LOCAL USER STORAGE ────────────────────────────────────────────

  /**
   * Save user to SQLite after a successful API login.
   * Password is stored as bcrypt hash — NEVER in plaintext.
   */
  private async saveUserLocally(user: LoginResponse['user'], password: string): Promise<void> {
    try {
      const existing = await databaseService.getUsuarioByEmail(user.email) as StoredUsuarioData | null;

      // Reuse existing bcrypt hash if it still matches; otherwise generate a new one
      let senhaHash: string;
      const existingHash = existing?.senha;
      if (existingHash && existingHash.startsWith('$2')) {
        const matches = await bcrypt.compare(password, existingHash);
        senhaHash = matches ? existingHash : await hashSenha(password);
      } else {
        senhaHash = await hashSenha(password);
      }

      const data: StoredUsuarioData = {
        id: user.id,
        tipo: 'usuario',
        nome: user.nome,
        email: user.email,
        senha: senhaHash,
        cpf: existing?.cpf || '',
        telefone: existing?.telefone || '',
        tipoPermissao: user.tipoPermissao,
        permissoesWeb: JSON.stringify(user.permissoes.web),
        permissoesMobile: JSON.stringify(user.permissoes.mobile),
        rotasPermitidas: JSON.stringify(user.rotasPermitidas),
        status: user.status,
        bloqueado: false,
        tentativasLoginFalhas: 0,
        bloqueadoAte: null,
        syncStatus: 'synced',
        needsSync: false,
        version: existing?.version || 1,
        deviceId: '',
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await databaseService.saveUsuario(data);
      logger.info('[AuthService] User saved locally', { email: user.email });
    } catch (error) {
      logger.error('[AuthService] Failed to save user locally', error);
    }
  }

  // ─── TOKEN REFRESH ─────────────────────────────────────────────────

  /**
   * Refresh the access token via the API.
   * - If offline: return the current token (offline-first, don't force re-login).
   * - If the refresh token is invalid (401): throw to trigger logout.
   * - If local session: no refresh needed (offline by definition).
   */
  async refreshToken(): Promise<string> {
    const currentToken = await secureStorage.getAccessToken();
    const isLocal = await secureStorage.isLocalSession();

    // Local session — nothing to refresh via API
    if (isLocal) {
      return currentToken!;
    }

    const storedRefreshToken = await secureStorage.getRefreshToken();

    // No refresh token — if we still have an access token, keep using it
    if (!storedRefreshToken) {
      if (currentToken) {
        logger.warn('[AuthService] No refresh token — keeping current session');
        return currentToken;
      }
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    try {
      const response = await apiService.refreshToken(storedRefreshToken);

      if (!response.success || !response.data?.token) {
        if (response.statusCode === 401 || response.statusCode === 400) {
          await secureStorage.clearAuthData();
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        // Other errors (5xx, network) — keep current token
        if (currentToken) {
          logger.warn('[AuthService] Refresh failed — keeping current token');
          return currentToken;
        }
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const { token, refreshToken: newRefresh, user } = response.data;

      await secureStorage.saveAccessToken(token);
      if (newRefresh) {
        await secureStorage.saveRefreshToken(newRefresh);
      }
      if (user) {
        await secureStorage.saveUser(JSON.stringify(user));
      }

      apiService.setToken(token);
      logger.info('[AuthService] Token refreshed successfully');
      return token;

    } catch (error) {
      if (isNetworkError(error) && currentToken) {
        logger.warn('[AuthService] Network error on refresh — keeping current session');
        return currentToken;
      }
      throw error;
    }
  }

  // ─── BIOMETRIC AUTH ────────────────────────────────────────────────

  /**
   * Authenticate via device biometric hardware.
   * 100% offline — no API calls.
   * Restores session from SecureStore and refreshes user data from SQLite.
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
        promptMessage: 'Autenticar',
        cancelLabel: 'Usar senha',
        disableDeviceFallback: false,
      });

      if (!result.success) return false;

      // Restore session from SecureStore
      const token = await secureStorage.getAccessToken();
      const userJson = await secureStorage.getUser();

      if (!token || !userJson) return false;

      apiService.setToken(token);

      // Try to refresh user data from SQLite (offline-first)
      try {
        const parsedUser = JSON.parse(userJson);
        const localUser = await usuarioRepository.getById(parsedUser.id);
        if (localUser) {
          const freshData: LoginResponse['user'] = {
            id: localUser.id,
            email: localUser.email,
            nome: localUser.nome,
            role: localUser.tipoPermissao,
            tipoPermissao: localUser.tipoPermissao,
            permissoes: localUser.permissoes,
            rotasPermitidas: localUser.rotasPermitidas,
            status: localUser.status,
          };
          await secureStorage.saveUser(JSON.stringify(freshData));
          logger.info('[AuthService] User data refreshed from SQLite after biometric auth');
        }
      } catch (dbError) {
        logger.warn('[AuthService] Could not read SQLite — using SecureStore data', dbError);
      }

      logger.info('[AuthService] Biometric auth successful');
      return true;

    } catch (error) {
      logger.error('[AuthService] Biometric auth error', error);
      return false;
    }
  }

  /**
   * Check if biometric hardware is available and whether the user has enabled it.
   */
  async isBiometricAvailable(): Promise<{ available: boolean; enabled: boolean }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const enabled = await secureStorage.isBiometricEnabled();
      return { available: hasHardware && isEnrolled, enabled };
    } catch {
      return { available: false, enabled: false };
    }
  }

  /**
   * Enable or disable biometric login.
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      const { available } = await this.isBiometricAvailable();
      if (!available) {
        throw new Error('Biometria não disponível neste dispositivo');
      }
    }
    await secureStorage.setBiometricEnabled(enabled);
    logger.info(`[AuthService] Biometric ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ─── LOGOUT ────────────────────────────────────────────────────────

  /**
   * Logout: revoke server session (best-effort), clear local auth data.
   * Device activation data is preserved.
   */
  async logout(): Promise<void> {
    try {
      logger.info('[AuthService] Logging out');

      // Try to revoke server session
      if (!ENV.USE_MOCK) {
        try {
          await apiService.logout();
        } catch { /* best-effort */ }
      }

      await secureStorage.clearAuthData();
      apiService.setToken(null);

      logger.info('[AuthService] Logout complete (device activation preserved)');
    } catch (error) {
      logger.error('[AuthService] Logout error', error);
      throw error;
    }
  }

  // ─── GET LOGGED-IN USER ────────────────────────────────────────────

  /**
   * Get the currently logged-in user.
   * Prefers fresh data from SQLite; falls back to SecureStore.
   */
  async getLoggedInUser(): Promise<LoginResponse['user'] | null> {
    try {
      const userStr = await secureStorage.getUser();
      if (!userStr) return null;

      const stored = JSON.parse(userStr) as LoginResponse['user'];

      // Try SQLite for fresher data (sync may have updated it)
      try {
        const localUser = await usuarioRepository.getById(stored.id);
        if (localUser) {
          return {
            id: localUser.id,
            email: localUser.email,
            nome: localUser.nome,
            role: localUser.tipoPermissao,
            tipoPermissao: localUser.tipoPermissao,
            permissoes: localUser.permissoes,
            rotasPermitidas: localUser.rotasPermitidas,
            status: localUser.status,
          };
        }
      } catch (dbError) {
        logger.warn('[AuthService] SQLite read failed — using SecureStore', dbError);
      }

      return stored;
    } catch (error) {
      logger.error('[AuthService] Error getting logged-in user', error);
      return null;
    }
  }

  // ─── INITIALIZATION ────────────────────────────────────────────────

  /**
   * Initialize the auth subsystem: database, SecureStore migration, mock user.
   */
  async initialize(): Promise<void> {
    try {
      await databaseService.initialize();
      await secureStorage.migrateFromAsyncStorage();

      if (ENV.USE_MOCK) {
        logger.info('[AuthService] Mock mode — ensuring admin user exists');
        const adminExists = await databaseService.getUsuarioByEmail('admin@locacao.com');
        if (!adminExists) {
          if (!ENV.MOCK_PASSWORD) {
            throw new Error('MOCK_PASSWORD not configured. Set it in .env for mock mode.');
          }
          const senhaHash = await hashSenha(ENV.MOCK_PASSWORD);
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
          logger.info('[AuthService] Mock admin user created');
        }
      }
    } catch (error) {
      logger.error('[AuthService] Initialization error', error);
    }
  }
}

export default new AuthService();
