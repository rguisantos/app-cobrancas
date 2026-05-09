/**
 * AuthContext.tsx
 * Contexto de Autenticação com persistência segura
 * Offline-first com sincronização
 * 
 * Refatorado para:
 * - Usar SecureStore para tokens
 * - Usar endpoint de refresh token
 * - Suportar autenticação biométrica
 * - Feedback de lockout e rate limiting
 * - Offline-first: funciona sem rede usando dados locais
 */

import React, { createContext, useState, useCallback, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Imports dos tipos e serviços
import { Usuario, TipoPermissaoUsuario, PermissoesUsuario } from '../types';
import { databaseService } from '../services/DatabaseService';
import authService from '../services/AuthService';
import { apiService } from '../services/ApiService';
import { syncService } from '../services/SyncService';
import { secureStorage } from '../services/SecureStorage';
import logger from '../utils/logger';

// ============================================================================
// CONFIGURAÇÃO E CONSTANTES
// ============================================================================

const STORAGE_KEYS = {
  TOKEN: '@cobrancas:token',         // Compatibilidade com versão anterior
  USER: '@cobrancas:user',
  DEVICE: '@cobrancas:device',
};

// Intervalo de refresh proativo (antes do token expirar)
const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutos (token expira em 15min)

// ============================================================================
// INTERFACES
// ============================================================================

export interface LockoutInfo {
  locked: boolean;
  minutosRestantes?: number;
}

export interface AuthContextType {
  // Estado
  user: Usuario | null;
  token: string | null;
  isLoading: boolean;
  isSignout: boolean;
  isAuthenticated: boolean;
  lockoutInfo: LockoutInfo | null;
  isOffline: boolean;
  
  // Ações
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  biometricLogin: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  isBiometricAvailable: () => Promise<{ available: boolean; enabled: boolean }>;
  setUser: (user: Usuario | null) => void;
  
  // Utilitários
  hasPermission: (module: keyof PermissoesUsuario['web'] | keyof PermissoesUsuario['mobile'], platform: 'web' | 'mobile') => boolean;
  canAccessRota: (rotaId: string) => boolean;
  isAdmin: () => boolean;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toUsuario = (
  authUser: {
    id: string;
    email: string;
    nome: string;
    tipoPermissao: TipoPermissaoUsuario;
    permissoes: PermissoesUsuario;
    rotasPermitidas: string[];
    status: 'Ativo' | 'Inativo';
  }
): Usuario => ({
  id: authUser.id,
  tipo: 'usuario',
  nome: authUser.nome,
  cpf: '',
  telefone: '',
  email: authUser.email,
  tipoPermissao: authUser.tipoPermissao,
  permissoes: authUser.permissoes,
  rotasPermitidas: authUser.rotasPermitidas,
  status: authUser.status,
  bloqueado: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  syncStatus: 'synced',
  needsSync: false,
  version: 1,
  deviceId: '',
});

/**
 * Verifica se há conectividade com a API.
 * Tenta um health check leve; se falhar com erro de rede, considera offline.
 */
async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await apiService.healthCheck();
    return response.ok === true;
  } catch {
    return false;
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
  onAuthChange?: (user: Usuario | null) => void;
}

export function AuthProvider({ children, onAuthChange }: AuthProviderProps) {
  const [user, setUserState] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignout, setIsSignout] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // ==========================================================================
  // setUser — permite que serviços externos (sync) atualizem o usuário
  // ==========================================================================

  const setUser = useCallback((newUser: Usuario | null) => {
    setUserState(newUser);
    if (newUser) {
      secureStorage.saveUser(JSON.stringify(newUser)).catch(err => {
        logger.warn('[Auth] Falha ao salvar usuário no SecureStorage via setUser', err);
      });
    }
  }, []);

  // ==========================================================================
  // BOOTSTRAP - Restaurar sessão ao iniciar
  // ==========================================================================

  const bootstrap = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('[Auth] Iniciando bootstrap...');

      // Inicializar o banco de dados e authService
      await authService.inicializar();

      // Restaurar sessão do SecureStore
      const savedToken = await secureStorage.getAccessToken();
      const savedUserJson = await secureStorage.getUser();

      if (savedToken && savedUserJson) {
        const parsedUser = JSON.parse(savedUserJson) as Usuario;
        
        // Sincronizar token com ApiService
        apiService.setToken(savedToken);
        logger.info('[Auth] Token sincronizado com ApiService no bootstrap');
        
        setToken(savedToken);
        setUserState(parsedUser);
        setIsSignout(false);
        
        logger.info('[Auth] Sessão restaurada', { user: parsedUser.nome, role: parsedUser.tipoPermissao });
        
        onAuthChange?.(parsedUser);

        // OFFLINE-FIRST: Verificar conectividade antes de tentar refresh proativo.
        // Se offline, pular refresh — a sessão local é suficiente para trabalhar.
        // O refresh será tentado quando a rede estiver disponível (veja o useEffect abaixo).
        const hasNetwork = await checkConnectivity();
        setIsOffline(!hasNetwork);

        if (!hasNetwork) {
          logger.info('[Auth] Sem conectividade no bootstrap — sessão local mantida, refresh adiado');
        } else if (!savedToken.startsWith('LOCAL_') && !savedToken.startsWith('local.')) {
          try {
            logger.info('[Auth] Tentando refresh proativo no bootstrap...');
            const newToken = await authService.refreshToken();
            if (newToken) {
              setToken(newToken);
              apiService.setToken(newToken);
              logger.info('[Auth] Token refreshed com sucesso no bootstrap');
            }
          } catch (refreshError) {
            logger.warn('[Auth] Refresh proativo falhou no bootstrap — sessão pode estar expirada:', refreshError);
            // Não fazer logout aqui — o interceptor do ApiService lidará com isso
          }
        }
      } else {
        setIsSignout(true);
        logger.info('[Auth] Nenhuma sessão ativa');
      }
    } catch (error) {
      logger.error('[Auth] Erro no bootstrap', error);
      setIsSignout(true);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // ==========================================================================
  // MONITORAMENTO DE CONECTIVIDADE — tentar refresh quando voltar online
  // ==========================================================================

  useEffect(() => {
    if (!token || isSignout) return;

    // Verificar conectividade periodicamente e tentar refresh quando voltar online
    const connectivityInterval = setInterval(async () => {
      try {
        const hasNetwork = await checkConnectivity();
        const wasOffline = isOffline;
        setIsOffline(!hasNetwork);

        // Se acabou de voltar online e temos um token JWT real, tentar refresh
        if (wasOffline && hasNetwork && token && !token.startsWith('LOCAL_') && !token.startsWith('local.')) {
          logger.info('[Auth] Conectividade restaurada — tentando refresh do token...');
          try {
            const newToken = await authService.refreshToken();
            if (newToken) {
              setToken(newToken);
              apiService.setToken(newToken);
              logger.info('[Auth] Token refreshed após reconexão');
            }
          } catch (refreshError) {
            logger.warn('[Auth] Falha no refresh após reconexão:', refreshError);
          }
        }
      } catch {
        // Silently ignore — connectivity check failed
      }
    }, 30 * 1000); // Verificar a cada 30 segundos

    return () => clearInterval(connectivityInterval);
  }, [token, isOffline, isSignout]);

  // ==========================================================================
  // REFRESH TOKEN PROATIVO
  // ==========================================================================

  useEffect(() => {
    // Only refresh real JWTs (not local tokens). Local tokens start with LOCAL_ or local.
    // Skip entirely if offline.
    if (!token || token.startsWith('LOCAL_') || token.startsWith('local.') || isOffline) return;

    const interval = setInterval(async () => {
      try {
        // Verificar conectividade antes de tentar refresh
        const hasNetwork = await checkConnectivity();
        setIsOffline(!hasNetwork);
        
        if (!hasNetwork) {
          logger.info('[Auth] Sem conectividade — refresh proativo adiado');
          return;
        }

        logger.info('[Auth] Refresh proativo do token...');
        const newToken = await authService.refreshToken();
        setToken(newToken);
      } catch (error) {
        logger.warn('[Auth] Falha no refresh proativo:', error);
        
        // Se o erro for de rede, marcar como offline
        if (error instanceof TypeError) {
          setIsOffline(true);
        }
        // Se o refresh falhar, a sessão pode estar expirada
        // O interceptor do ApiService vai lidar com isso na próxima requisição
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token, isOffline]);

  // ==========================================================================
  // LOGIN
  // ==========================================================================

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setLockoutInfo(null);
      logger.info('[Auth] ====== INICIANDO LOGIN ======', { email });

      const response = await authService.login(email, password);

      const { token: newToken, user: usuarioLogado } = response;

      logger.info('[Auth] Login bem-sucedido', { token: newToken ? 'recebido' : 'nulo', userId: usuarioLogado.id });

      // Passar token para o ApiService
      apiService.setToken(newToken);

      // Salvar dados do usuário no SecureStorage
      await secureStorage.saveAccessToken(newToken);
      await secureStorage.saveUser(JSON.stringify(usuarioLogado));

      // Atualizar estado
      setToken(newToken);
      const usuarioContexto = toUsuario(usuarioLogado);
      setUserState(usuarioContexto);
      setIsSignout(false);

      // Após login bem-sucedido, marcar como online
      setIsOffline(false);

      logger.info('[Auth] Login completo', { email, role: usuarioLogado.tipoPermissao });
      
      onAuthChange?.(usuarioContexto);

    } catch (error: any) {
      // Verificar se é erro de lockout
      if (error?.lockoutInfo) {
        setLockoutInfo(error.lockoutInfo);
      }
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      logger.error('[Auth] Erro no login', error);
      throw new Error(mensagem);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  // ==========================================================================
  // BIOMETRIC LOGIN — offline-first, sem chamadas de API
  // ==========================================================================

  const biometricLogin = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      // O fluxo biométrico é inteiramente local:
      // 1. Verificar se biometria está habilitada
      // 2. Autenticar via hardware biométrico
      // 3. Restaurar sessão do SecureStore
      // 4. Carregar dados frescos do SQLite local
      // Nenhuma chamada de API é feita.
      const success = await authService.authenticateWithBiometrics();
      
      if (success) {
        const savedToken = await secureStorage.getAccessToken();
        const savedUserJson = await secureStorage.getUser();
        
        if (savedToken && savedUserJson) {
          const parsedUser = JSON.parse(savedUserJson) as Usuario;
          apiService.setToken(savedToken);
          setToken(savedToken);
          setUserState(parsedUser);
          setIsSignout(false);
          onAuthChange?.(parsedUser);
          logger.info('[Auth] Login biométrico bem-sucedido');

          // Verificar conectividade em background (não bloquear o login)
          checkConnectivity().then(hasNetwork => {
            setIsOffline(!hasNetwork);
          });
        }
      }
      
      return success;
    } catch (error) {
      logger.error('[Auth] Erro no login biométrico', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  const handleSetBiometricEnabled = useCallback(async (enabled: boolean) => {
    await authService.setBiometricEnabled(enabled);
  }, []);

  const handleIsBiometricAvailable = useCallback(async () => {
    return authService.isBiometricAvailable();
  }, []);

  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('[Auth] Realizando logout');

      await authService.logout();

      // Limpar estado
      setToken(null);
      setUserState(null);
      setIsSignout(true);
      setLockoutInfo(null);
      setIsOffline(false);

      logger.info('[Auth] Logout realizado (dispositivo permanece ativado)');
      
      onAuthChange?.(null);

    } catch (error) {
      logger.error('[Auth] Erro no logout', error);
      setToken(null);
      setUserState(null);
      setIsSignout(true);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  // ==========================================================================
  // REFRESH DE DADOS DO USUÁRIO — offline-first
  // ==========================================================================

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      let usuarioServidor: any = null;

      // Tentar buscar do servidor apenas se houver conectividade
      const hasNetwork = await checkConnectivity();
      setIsOffline(!hasNetwork);

      if (hasNetwork) {
        try {
          const response = await apiService.getUsuarioAtual();
          if (response.success && response.data) {
            usuarioServidor = response.data;
            logger.info('[Auth] Dados do usuário atualizados do servidor');
          }
        } catch {
          logger.warn('[Auth] Erro ao buscar dados do servidor — usando dados locais');
          setIsOffline(true);
        }
      } else {
        logger.info('[Auth] Offline — usando dados locais do usuário');
      }

      if (usuarioServidor) {
        const usuarioAtualizado = toUsuario({
          id: usuarioServidor.id,
          email: usuarioServidor.email,
          nome: usuarioServidor.nome,
          tipoPermissao: usuarioServidor.tipoPermissao,
          permissoes: usuarioServidor.permissoes,
          rotasPermitidas: usuarioServidor.rotasPermitidas,
          status: usuarioServidor.status,
        });
        setUserState(usuarioAtualizado);
        await secureStorage.saveUser(JSON.stringify(usuarioAtualizado));

        if (usuarioServidor.status !== 'Ativo' || usuarioServidor.bloqueado) {
          logger.warn('[Auth] Usuário bloqueado/inativo no servidor — forçando logout');
          await logout();
          return;
        }
      } else {
        // OFFLINE-FIRST: Usar dados do SQLite local como fallback
        // Isso garante que o refreshUser() não falhe quando offline
        const usuarioLocal = await authService.getUsuarioLogado();
        if (usuarioLocal) {
          const usuarioAtualizado = toUsuario(usuarioLocal);
          setUserState(usuarioAtualizado);
          logger.info('[Auth] Usuário atualizado do cache local (offline)');
        }
      }
    } catch (error) {
      logger.error('[Auth] Erro ao atualizar usuário', error);
      // Não propagar erro — em modo offline-first, refreshUser não deve falhar
    }
  }, [user, logout]);

  // ==========================================================================
  // VERIFICAÇÃO DE PERMISSÕES
  // ==========================================================================

  const hasPermission = useCallback((
    module: keyof PermissoesUsuario['web'] | keyof PermissoesUsuario['mobile'],
    platform: 'web' | 'mobile'
  ): boolean => {
    if (!user) return false;
    
    if (user.tipoPermissao === 'Administrador') return true;
    
    const perms = user.permissoes?.[platform];
    return perms ? (perms as any)[module] ?? false : false;
  }, [user]);

  const canAccessRota = useCallback((rotaId: string): boolean => {
    if (!user) return false;
    
    if (user.tipoPermissao === 'Administrador') return true;
    
    // Normalizar tipos para comparação consistente (string vs number)
    const rotaIdStr = String(rotaId);
    return user.rotasPermitidas?.some(r => String(r) === rotaIdStr) ?? false;
  }, [user]);

  const isAdmin = useCallback((): boolean => {
    return user?.tipoPermissao === 'Administrador';
  }, [user]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const isAuthenticated = !!token && !!user && user.status === 'Ativo';

  // ==========================================================================
  // VALOR DO CONTEXT
  // ==========================================================================

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isSignout,
    isAuthenticated,
    lockoutInfo,
    isOffline,
    login,
    logout,
    refreshUser,
    biometricLogin,
    setBiometricEnabled: handleSetBiometricEnabled,
    isBiometricAvailable: handleIsBiometricAvailable,
    setUser,
    hasPermission,
    canAccessRota,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
}

export default AuthContext;
