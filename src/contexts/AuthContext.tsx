/**
 * AuthContext.tsx
 * Contexto de Autenticação com persistência SQLite local
 * Offline-first com sincronização
 */

import React, { createContext, useState, useCallback, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Imports dos tipos e serviços
import { Usuario, TipoPermissaoUsuario, PermissoesUsuario } from '../types';
import { databaseService } from '../services/DatabaseService';
import authService from '../services/AuthService';
import { apiService } from '../services/ApiService';
import { syncService } from '../services/SyncService';
import logger from '../utils/logger';

// ============================================================================
// CONFIGURAÇÃO E CONSTANTES
// ============================================================================

const STORAGE_KEYS = {
  TOKEN: '@cobrancas:token',
  USER: '@cobrancas:user',
  DEVICE: '@cobrancas:device',
};

// ============================================================================
// INTERFACES
// ============================================================================

export interface AuthContextType {
  // Estado
  user: Usuario | null;
  token: string | null;
  isLoading: boolean;
  isSignout: boolean;
  isAuthenticated: boolean;
  
  // Ações
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  
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

  // ==========================================================================
  // BOOTSTRAP - Restaurar sessão ao iniciar
  // ==========================================================================

  const bootstrap = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('[Auth] Iniciando bootstrap...');

      // Inicializar o banco de dados e authService
      await authService.inicializar();

      const [savedToken, savedUserJson] = await AsyncStorage.multiGet([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
      ]);

      if (savedToken[1] && savedUserJson[1]) {
        const parsedUser = JSON.parse(savedUserJson[1]) as Usuario;
        
        // IMPORTANTE: Sincronizar token com ApiService
        apiService.setToken(savedToken[1]);
        logger.info('[Auth] Token sincronizado com ApiService no bootstrap');
        
        setToken(savedToken[1]);
        setUser(parsedUser);
        setIsSignout(false);
        
        logger.info('[Auth] Sessao restaurada', { user: parsedUser.nome, role: parsedUser.tipoPermissao });
        
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
  // LOGIN
  // ==========================================================================

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      logger.info('[Auth] ====== INICIANDO LOGIN ======', { email });

      // Usar o AuthService que autentica com API ou SQLite local
      const response = await authService.login(email, password);

      const { token: newToken, user: usuarioLogado } = response;

      logger.info('[Auth] Login bem-sucedido', { token: newToken ? 'recebido' : 'nulo', userId: usuarioLogado.id });

      // Passar token para o ApiService (para requisições autenticadas)
      apiService.setToken(newToken);
      logger.info('[Auth] Token configurado no ApiService');
      
      // Verificar se foi configurado
      const tokenVerificado = apiService['token'];
      logger.info('[Auth] Verificação do token no ApiService:', { hasToken: !!tokenVerificado, tokenPreview: tokenVerificado ? tokenVerificado.substring(0, 20) + '...' : 'nulo' });

      // Salvar no AsyncStorage
      logger.info('[Auth] Salvando token no AsyncStorage...', { key: STORAGE_KEYS.TOKEN, tokenPreview: newToken.substring(0, 30) + '...' });
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TOKEN, newToken],
        [STORAGE_KEYS.USER, JSON.stringify(usuarioLogado)],
      ]);
      
      // Verificar se foi salvo corretamente
      const verifyToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      logger.info('[Auth] Verificação AsyncStorage:', { saved: !!verifyToken, tokenMatch: verifyToken === newToken });

      // Atualizar estado
      setToken(newToken);
      const usuarioContexto = toUsuario(usuarioLogado);
      setUser(usuarioContexto);
      setIsSignout(false);

      logger.info('[Auth] Login completo', { email, role: usuarioLogado.tipoPermissao });
      
      // NÃO registrar dispositivo automaticamente - o AppNavigator vai verificar
      // se o dispositivo está ativado e mostrar a tela de ativação se necessário
      logger.info('[Auth] Verificação de dispositivo será feita no AppNavigator');
      
      onAuthChange?.(usuarioContexto);

    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      logger.error('[Auth] Erro no login', error);
      throw new Error(mensagem);
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('[Auth] Realizando logout');

      // Limpar apenas dados do usuário, MANTER dados do dispositivo
      // O dispositivo deve permanecer ativado mesmo após logout
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
      ]);

      // Limpar token do ApiService
      apiService.setToken(null);

      // Limpar estado do usuário
      setToken(null);
      setUser(null);
      setIsSignout(true);

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
      // Tentar buscar dados atualizados do servidor (permissões, bloqueio, etc.)
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
        // Dados do servidor: atualizar AsyncStorage e estado
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
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(usuarioAtualizado));

        // Se usuário foi bloqueado ou inativado, forçar logout
        if (usuarioServidor.status !== 'Ativo' || usuarioServidor.bloqueado) {
          logger.warn('[Auth] Usuário bloqueado/inativo no servidor — forçando logout');
          await logout();
          return;
        }
      } else {
        // Fallback offline: recarregar do AsyncStorage local
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
    
    // Admin tem tudo
    if (user.tipoPermissao === 'Administrador') return true;
    
    // Verificar permissão específica
    const perms = user.permissoes?.[platform];
    return perms ? (perms as any)[module] ?? false : false;
  }, [user]);

  const canAccessRota = useCallback((rotaId: string | number): boolean => {
    if (!user) return false;
    
    // Admin vê todas as rotas
    if (user.tipoPermissao === 'Administrador') return true;
    
    // Usuário controlado: verificar se rota está na lista permitida
    return user.rotasPermitidas?.includes(rotaId) ?? false;
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
    login,
    logout,
    refreshUser,
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
