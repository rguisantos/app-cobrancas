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
  
  // Ações
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  biometricLogin: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  isBiometricAvailable: () => Promise<{ available: boolean; enabled: boolean }>;
  
  // Utilitários
  hasPermission: (module: keyof PermissoesUsuario['web'] | keyof PermissoesUsuario['mobile'], platform: 'web' | 'mobile') => boolean;
  canAccessRota: (rotaId: string | number) => boolean;
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
    rotasPermitidas: Array<string | number>;
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

// ============================================================================
// PROVIDER
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
  onAuthChange?: (user: Usuario | null) => void;
}

export function AuthProvider({ children, onAuthChange }: AuthProviderProps) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignout, setIsSignout] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo | null>(null);

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
        setUser(parsedUser);
        setIsSignout(false);
        
        logger.info('[Auth] Sessão restaurada', { user: parsedUser.nome, role: parsedUser.tipoPermissao });
        
        onAuthChange?.(parsedUser);
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
  // REFRESH TOKEN PROATIVO
  // ==========================================================================

  useEffect(() => {
    if (!token || token.startsWith('loc_')) return; // Não refresh tokens locais

    const interval = setInterval(async () => {
      try {
        logger.info('[Auth] Refresh proativo do token...');
        const newToken = await authService.refreshToken();
        setToken(newToken);
      } catch (error) {
        logger.warn('[Auth] Falha no refresh proativo:', error);
        // Se o refresh falhar, a sessão pode estar expirada
        // O interceptor do ApiService vai lidar com isso na próxima requisição
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token]);

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
      setUser(usuarioContexto);
      setIsSignout(false);

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
  // BIOMETRIC LOGIN
  // ==========================================================================

  const biometricLogin = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const success = await authService.authenticateWithBiometrics();
      
      if (success) {
        const savedToken = await secureStorage.getAccessToken();
        const savedUserJson = await secureStorage.getUser();
        
        if (savedToken && savedUserJson) {
          const parsedUser = JSON.parse(savedUserJson) as Usuario;
          apiService.setToken(savedToken);
          setToken(savedToken);
          setUser(parsedUser);
          setIsSignout(false);
          onAuthChange?.(parsedUser);
          logger.info('[Auth] Login biométrico bem-sucedido');
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
      setUser(null);
      setIsSignout(true);
      setLockoutInfo(null);

      logger.info('[Auth] Logout realizado (dispositivo permanece ativado)');
      
      onAuthChange?.(null);

    } catch (error) {
      logger.error('[Auth] Erro no logout', error);
      setToken(null);
      setUser(null);
      setIsSignout(true);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  // ==========================================================================
  // REFRESH DE DADOS DO USUÁRIO
  // ==========================================================================

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      let usuarioServidor: any = null;
      try {
        const response = await apiService.getUsuarioAtual();
        if (response.success && response.data) {
          usuarioServidor = response.data;
          logger.info('[Auth] Dados do usuário atualizados do servidor');
        }
      } catch {
        logger.warn('[Auth] Sem conexão ao atualizar usuário — usando dados locais');
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
        setUser(usuarioAtualizado);
        await secureStorage.saveUser(JSON.stringify(usuarioAtualizado));

        if (usuarioServidor.status !== 'Ativo' || usuarioServidor.bloqueado) {
          logger.warn('[Auth] Usuário bloqueado/inativo no servidor — forçando logout');
          await logout();
          return;
        }
      } else {
        const usuarioLocal = await authService.getUsuarioLogado();
        if (usuarioLocal) {
          setUser(toUsuario(usuarioLocal));
          logger.info('[Auth] Usuário atualizado do cache local');
        }
      }
    } catch (error) {
      logger.error('[Auth] Erro ao atualizar usuário', error);
    }
  }, [user]);

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

  const canAccessRota = useCallback((rotaId: string | number): boolean => {
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
    login,
    logout,
    refreshUser,
    biometricLogin,
    setBiometricEnabled: handleSetBiometricEnabled,
    isBiometricAvailable: handleIsBiometricAvailable,
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
