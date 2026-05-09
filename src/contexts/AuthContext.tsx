/**
 * AuthContext.tsx
 *
 * Complete rewrite — simplified offline-first auth context.
 *
 * Key design decisions:
 * - NO LOCAL_ token prefix — uses a `isLocalSession` flag in SecureStore instead
 * - API-first login, local bcrypt fallback only on network errors
 * - Proactive token refresh every 12 minutes (token expires at 15 min)
 * - 3-branch navigation: NotAuth → Auth; Auth/noDevice → DeviceActivation; Auth+Device → App
 * - Biometric auth is 100% offline
 * - Lockout/rate-limiting handled by the API when online
 */

import React, {
  createContext,
  useState,
  useCallback,
  useEffect,
  useContext,
  useRef,
  ReactNode,
} from 'react';

import { Usuario, TipoPermissaoUsuario, PermissoesUsuario } from '../types';
import { databaseService } from '../services/DatabaseService';
import authService from '../services/AuthService';
import { apiService } from '../services/ApiService';
import { secureStorage } from '../services/SecureStorage';
import logger from '../utils/logger';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Refresh the JWT every 12 minutes (it expires at 15 min) */
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

/** Check connectivity every 30 seconds */
const CONNECTIVITY_CHECK_MS = 30 * 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface LockoutInfo {
  locked: boolean;
  minutosRestantes?: number;
}

export interface AuthContextType {
  // State
  user: Usuario | null;
  token: string | null;
  isLoading: boolean;
  isSignout: boolean;
  isAuthenticated: boolean;
  isLocalSession: boolean;
  isOffline: boolean;
  lockoutInfo: LockoutInfo | null;

  // Device activation
  isDeviceActivated: boolean;
  isCheckingDevice: boolean;
  refreshDeviceActivation: () => Promise<void>;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  biometricLogin: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  isBiometricAvailable: () => Promise<{ available: boolean; enabled: boolean }>;
  setUser: (user: Usuario | null) => void;

  // Permissions
  hasPermission: (
    module: keyof PermissoesUsuario['web'] | keyof PermissoesUsuario['mobile'],
    platform: 'web' | 'mobile',
  ) => boolean;
  canAccessRota: (rotaId: string) => boolean;
  isAdmin: () => boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a LoginResponse.user shape into the full Usuario type.
 */
const toUsuario = (
  authUser: {
    id: string;
    email: string;
    nome: string;
    tipoPermissao: TipoPermissaoUsuario;
    permissoes: PermissoesUsuario;
    rotasPermitidas: string[];
    status: 'Ativo' | 'Inativo';
  },
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
 * Lightweight connectivity check via API health endpoint.
 */
async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await apiService.healthCheck();
    return response.ok === true;
  } catch {
    return false;
  }
}

/**
 * Check whether the device is activated by reading sync_metadata from SQLite.
 */
async function checkDeviceActivation(): Promise<boolean> {
  try {
    const metadata = await databaseService.getSyncMetadata();
    return !!(metadata.deviceId && metadata.deviceKey);
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
  // ── Core auth state ──
  const [user, setUserState] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignout, setIsSignout] = useState(false);
  const [isLocalSession, setIsLocalSession] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo | null>(null);

  // ── Device activation state ──
  const [isDeviceActivated, setIsDeviceActivated] = useState(false);
  const [isCheckingDevice, setIsCheckingDevice] = useState(false);

  // ── Refs for interval management ──
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectivityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasOfflineRef = useRef(false);

  // ==========================================================================
  // setUser — allows external services (e.g. sync) to update the user
  // ==========================================================================

  const setUser = useCallback((newUser: Usuario | null) => {
    setUserState(newUser);
    if (newUser) {
      secureStorage.saveUser(JSON.stringify(newUser)).catch(err => {
        logger.warn('[Auth] Failed to save user to SecureStorage via setUser', err);
      });
    }
  }, []);

  // ==========================================================================
  // BOOTSTRAP — restore session on app start
  // ==========================================================================

  const bootstrap = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('[Auth] Bootstrap starting...');

      // Initialize the database and auth service
      await authService.initialize();

      // Restore session from SecureStore
      const savedToken = await secureStorage.getAccessToken();
      const savedUserJson = await secureStorage.getUser();
      const savedIsLocal = await secureStorage.isLocalSession();

      if (savedToken && savedUserJson) {
        const parsedUser = JSON.parse(savedUserJson) as Usuario;

        // Sync token with ApiService
        apiService.setToken(savedToken);
        setToken(savedToken);
        setUserState(parsedUser);
        setIsLocalSession(savedIsLocal);
        setIsSignout(false);

        logger.info('[Auth] Session restored', {
          user: parsedUser.nome,
          role: parsedUser.tipoPermissao,
          isLocal: savedIsLocal,
        });

        onAuthChange?.(parsedUser);

        // Check connectivity — if online, try proactive token refresh
        const hasNetwork = await checkConnectivity();
        setIsOffline(!hasNetwork);
        wasOfflineRef.current = !hasNetwork;

        if (hasNetwork && !savedIsLocal) {
          try {
            logger.info('[Auth] Proactive token refresh on bootstrap...');
            const newToken = await authService.refreshToken();
            setToken(newToken);
            logger.info('[Auth] Token refreshed on bootstrap');
          } catch (refreshError) {
            logger.warn('[Auth] Proactive refresh failed on bootstrap:', refreshError);
            // Don't force logout — the ApiService interceptor handles 401s
          }
        }

        // Check device activation
        const activated = await checkDeviceActivation();
        setIsDeviceActivated(activated);

      } else {
        setIsSignout(true);
        logger.info('[Auth] No active session');
      }
    } catch (error) {
      logger.error('[Auth] Bootstrap error', error);
      setIsSignout(true);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // ==========================================================================
  // CONNECTIVITY MONITORING — try refresh when coming back online
  // ==========================================================================

  useEffect(() => {
    if (!token || isSignout) return;

    connectivityIntervalRef.current = setInterval(async () => {
      try {
        const hasNetwork = await checkConnectivity();
        const wasOffline = wasOfflineRef.current;
        wasOfflineRef.current = !hasNetwork;
        setIsOffline(!hasNetwork);

        // Just came back online with a real JWT — refresh it
        if (wasOffline && hasNetwork && token && !isLocalSession) {
          logger.info('[Auth] Connectivity restored — refreshing token...');
          try {
            const newToken = await authService.refreshToken();
            setToken(newToken);
            logger.info('[Auth] Token refreshed after reconnection');
          } catch (refreshError) {
            logger.warn('[Auth] Refresh after reconnection failed:', refreshError);
          }
        }
      } catch {
        // Silently ignore — connectivity check failed
      }
    }, CONNECTIVITY_CHECK_MS);

    return () => {
      if (connectivityIntervalRef.current) {
        clearInterval(connectivityIntervalRef.current);
      }
    };
  }, [token, isSignout, isLocalSession]);

  // ==========================================================================
  // PROACTIVE TOKEN REFRESH — every 12 minutes
  // ==========================================================================

  useEffect(() => {
    // Only refresh real JWTs, not local sessions
    if (!token || isLocalSession || isOffline) return;

    refreshIntervalRef.current = setInterval(async () => {
      try {
        const hasNetwork = await checkConnectivity();
        setIsOffline(!hasNetwork);
        wasOfflineRef.current = !hasNetwork;

        if (!hasNetwork) {
          logger.info('[Auth] Offline — proactive refresh deferred');
          return;
        }

        logger.info('[Auth] Proactive token refresh...');
        const newToken = await authService.refreshToken();
        setToken(newToken);
      } catch (error) {
        logger.warn('[Auth] Proactive refresh failed:', error);
        if (error instanceof TypeError) {
          setIsOffline(true);
          wasOfflineRef.current = true;
        }
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [token, isLocalSession, isOffline]);

  // ==========================================================================
  // DEVICE ACTIVATION CHECK — when auth state changes
  // ==========================================================================

  useEffect(() => {
    const checkDevice = async () => {
      if (!token || !user || isSignout) {
        setIsDeviceActivated(false);
        return;
      }

      setIsCheckingDevice(true);
      try {
        const activated = await checkDeviceActivation();
        setIsDeviceActivated(activated);
      } catch (error) {
        logger.warn('[Auth] Device activation check failed', error);
      } finally {
        setIsCheckingDevice(false);
      }
    };

    checkDevice();
  }, [token, user, isSignout]);

  // ==========================================================================
  // LOGIN
  // ==========================================================================

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setLockoutInfo(null);
      logger.info('[Auth] Login starting', { email });

      const response = await authService.login(email, password);
      const { token: newToken, isLocalSession: isLocal, user: usuarioLogado } = response;

      // Pass token to ApiService
      apiService.setToken(newToken);

      // Persist to SecureStore
      await secureStorage.saveAccessToken(newToken);
      await secureStorage.saveUser(JSON.stringify(usuarioLogado));
      await secureStorage.setLocalSessionFlag(isLocal);

      // Update state
      const usuarioContexto = toUsuario(usuarioLogado);
      setToken(newToken);
      setUserState(usuarioContexto);
      setIsLocalSession(isLocal);
      setIsSignout(false);
      setIsOffline(isLocal); // Local session implies offline

      logger.info('[Auth] Login complete', {
        email,
        role: usuarioLogado.tipoPermissao,
        isLocal,
      });

      onAuthChange?.(usuarioContexto);

      // Check device activation after login
      const activated = await checkDeviceActivation();
      setIsDeviceActivated(activated);

    } catch (error: any) {
      if (error?.lockoutInfo) {
        setLockoutInfo(error.lockoutInfo);
      }
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      logger.error('[Auth] Login error', error);
      throw new Error(mensagem);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  // ==========================================================================
  // BIOMETRIC LOGIN — 100% offline, no API calls
  // ==========================================================================

  const biometricLogin = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);

      const success = await authService.authenticateWithBiometrics();

      if (success) {
        const savedToken = await secureStorage.getAccessToken();
        const savedUserJson = await secureStorage.getUser();
        const savedIsLocal = await secureStorage.isLocalSession();

        if (savedToken && savedUserJson) {
          const parsedUser = JSON.parse(savedUserJson) as Usuario;
          apiService.setToken(savedToken);
          setToken(savedToken);
          setUserState(parsedUser);
          setIsLocalSession(savedIsLocal);
          setIsSignout(false);
          onAuthChange?.(parsedUser);
          logger.info('[Auth] Biometric login successful');

          // Check connectivity in background
          checkConnectivity().then(hasNetwork => {
            setIsOffline(!hasNetwork);
            wasOfflineRef.current = !hasNetwork;
          });

          // Check device activation
          const activated = await checkDeviceActivation();
          setIsDeviceActivated(activated);
        }
      }

      return success;
    } catch (error) {
      logger.error('[Auth] Biometric login error', error);
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
      logger.info('[Auth] Logging out');

      await authService.logout();

      setToken(null);
      setUserState(null);
      setIsSignout(true);
      setIsLocalSession(false);
      setLockoutInfo(null);
      setIsOffline(false);
      setIsDeviceActivated(false);
      wasOfflineRef.current = false;

      logger.info('[Auth] Logout complete (device activation preserved)');

      onAuthChange?.(null);

    } catch (error) {
      logger.error('[Auth] Logout error', error);
      setToken(null);
      setUserState(null);
      setIsSignout(true);
      setIsLocalSession(false);
      setIsDeviceActivated(false);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  // ==========================================================================
  // REFRESH USER DATA — offline-first
  // ==========================================================================

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      let serverUser: any = null;

      const hasNetwork = await checkConnectivity();
      setIsOffline(!hasNetwork);
      wasOfflineRef.current = !hasNetwork;

      if (hasNetwork) {
        try {
          const response = await apiService.getUsuarioAtual();
          if (response.success && response.data) {
            serverUser = response.data;
            logger.info('[Auth] User data refreshed from server');
          }
        } catch {
          logger.warn('[Auth] Failed to fetch from server — using local data');
          setIsOffline(true);
          wasOfflineRef.current = true;
        }
      } else {
        logger.info('[Auth] Offline — using local user data');
      }

      if (serverUser) {
        const updatedUser = toUsuario({
          id: serverUser.id,
          email: serverUser.email,
          nome: serverUser.nome,
          tipoPermissao: serverUser.tipoPermissao,
          permissoes: serverUser.permissoes,
          rotasPermitidas: serverUser.rotasPermitidas,
          status: serverUser.status,
        });
        setUserState(updatedUser);
        await secureStorage.saveUser(JSON.stringify(updatedUser));

        // If server says user is inactive/blocked, force logout
        if (serverUser.status !== 'Ativo' || serverUser.bloqueado) {
          logger.warn('[Auth] User blocked/inactive on server — forcing logout');
          await logout();
          return;
        }
      } else {
        // Offline — try local SQLite data
        const localUser = await authService.getLoggedInUser();
        if (localUser) {
          setUserState(toUsuario(localUser));
          logger.info('[Auth] User refreshed from local cache');
        }
      }
    } catch (error) {
      logger.error('[Auth] Error refreshing user', error);
      // Don't throw — in offline-first mode, refreshUser should not fail
    }
  }, [user, logout]);

  // ==========================================================================
  // REFRESH DEVICE ACTIVATION — for use by DeviceActivationScreen & AppNavigator
  // ==========================================================================

  const refreshDeviceActivation = useCallback(async () => {
    if (!token || !user || isSignout) {
      setIsDeviceActivated(false);
      return;
    }

    setIsCheckingDevice(true);
    try {
      const activated = await checkDeviceActivation();
      setIsDeviceActivated(activated);
    } catch (error) {
      logger.warn('[Auth] Device activation refresh failed', error);
    } finally {
      setIsCheckingDevice(false);
    }
  }, [token, user, isSignout]);

  // ==========================================================================
  // PERMISSION CHECKS
  // ==========================================================================

  const hasPermission = useCallback(
    (
      module: keyof PermissoesUsuario['web'] | keyof PermissoesUsuario['mobile'],
      platform: 'web' | 'mobile',
    ): boolean => {
      if (!user) return false;
      if (user.tipoPermissao === 'Administrador') return true;

      const perms = user.permissoes?.[platform];
      return perms ? (perms as any)[module] ?? false : false;
    },
    [user],
  );

  const canAccessRota = useCallback((rotaId: string): boolean => {
    if (!user) return false;
    if (user.tipoPermissao === 'Administrador') return true;

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
  // CONTEXT VALUE
  // ==========================================================================

  const value: AuthContextType = {
    // State
    user,
    token,
    isLoading,
    isSignout,
    isAuthenticated,
    isLocalSession,
    isOffline,
    lockoutInfo,

    // Device activation
    isDeviceActivated,
    isCheckingDevice,
    refreshDeviceActivation,

    // Actions
    login,
    logout,
    refreshUser,
    biometricLogin,
    setBiometricEnabled: handleSetBiometricEnabled,
    isBiometricAvailable: handleIsBiometricAvailable,
    setUser,

    // Permissions
    hasPermission,
    canAccessRota,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;
