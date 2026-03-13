/**
 * AuthContext.tsx
 * Contexto de Autenticação com integração Sync + Types
 * Offline-first com persistência via AsyncStorage
 */

import React, { createContext, useState, useCallback, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Imports dos tipos e serviços
import { Usuario, TipoPermissaoUsuario, PermissoesUsuario, SyncMetadata } from '../types';
import { apiService } from '../services/ApiService';
import { databaseService } from '../services/DatabaseService';
import logger from '../utils/logger';
import { ENV } from '../config/env';

// ============================================================================
// CONFIGURAÇÃO E CONSTANTES
// ============================================================================

const STORAGE_KEYS = {
  TOKEN: '@diamond:token',
  USER: '@diamond:user',
  DEVICE: '@diamond:device',
  SYNC_META: '@diamond:sync_meta',
};

const API_CONFIG = {
  useMock: ENV.USE_MOCK, // Controle via config/env.ts
  mockDelay: 800, // Simular latência de rede
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
  hasPermission: (module: keyof PermissoesUsuario['web'] | keyof PermissoesUsuario['mobile'], platform: 'web' | 'mobile') => boolean;  canAccessRota: (rotaId: string | number) => boolean;
  isAdmin: () => boolean;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
  onAuthChange?: (user: Usuario | null) => void; // Callback opcional
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

      const [savedToken, savedUserJson, savedDevice] = await AsyncStorage.multiGet([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER,
        STORAGE_KEYS.DEVICE,
      ]);

      if (savedToken[1] && savedUserJson[1]) {
        const parsedUser = JSON.parse(savedUserJson[1]) as Usuario;
        
        setToken(savedToken[1]);
        setUser(parsedUser);
        setIsSignout(false);
        
        // Configurar token na API
        apiService.setToken(savedToken[1]);
                // Inicializar dispositivo para sync se necessário
        if (savedDevice[1]) {
          const device = JSON.parse(savedDevice[1]);
          await databaseService.setDeviceId(device.id, device.nome, device.chave);
      
  }
        
        logger.info('[Auth] Sessão restaurada', { user: parsedUser.nome, role: parsedUser.tipoPermissao });
        
        // Callback opcional
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
      logger.info('[Auth] Tentando login', { email });

      let response: any;

      if (API_CONFIG.useMock) {
        // --- MODO MOCK (Desenvolvimento) ---
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.mockDelay));
        
        // Usuário Admin (acesso total)
        const mockAdmin: Usuario = {
          id: '1',
          nome: 'Carlos',
          cpf: '399.416.471-00',
          telefone: '67993034230',
          email,
          tipoPermissao: 'Administrador',
          permissoes: {            web: { todosCadastros: true, locacaoRelocacaoEstoque: true, relatorios: true },
            mobile: { todosCadastros: true, alteracaoRelogio: true, locacaoRelocacaoEstoque: true, cobrancasFaturas: true }
          },
          rotasPermitidas: [], // Admin vê todas as rotas
          status: 'Ativo',
          // Campos obrigatórios de SyncableEntity
          tipo: 'usuario',
          syncStatus: 'synced',
          needsSync: false,
          version: 1,
          deviceId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Usuário com Acesso Controlado (ex: Robson - só Linha Aquidauana)
        // const mockControlado: Usuario = {
        //   id: '9',
        //   nome: 'Robson Roberto dos Santos',
        //   cpf: '000.000.000-00',
        //   telefone: '67999999999',
        //   email,
        //   tipoPermissao: 'AcessoControlado',
        //   permissoes: {
        //     web: { todosCadastros: false, locacaoRelocacaoEstoque: true, relatorios: false },
        //     mobile: { todosCadastros: false, alteracaoRelogio: true, locacaoRelocacaoEstoque: true, cobrancasFaturas: true }
        //   },
        //   rotasPermitidas: [1], // Apenas rota ID 1
        //   status: 'Ativo',
        //   tipo: 'usuario',
        //   syncStatus: 'synced',
        //   needsSync: false,
        //   version: 1,
        //   deviceId: '',
        //   createdAt: new Date().toISOString(),
        //   updatedAt: new Date().toISOString(),
        // };

        response = {
          success: true,
          data: {
            token: `mock_token_${Date.now()}`,
            usuario: mockAdmin, // Troque para mockControlado para testar acesso restrito
        
  }
        };
      } else {
        // --- MODO PRODUÇÃO (API Real) ---
        response = await apiService.login(email, password);
        
        if (!response.success) {          throw new Error(response.error || 'Falha na autenticação');
      
  }
    
  }

      const { token: newToken, usuario } = response.data;

      // Salvar no AsyncStorage
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TOKEN, newToken],
        [STORAGE_KEYS.USER, JSON.stringify(usuario)],
      ]);

      // Atualizar estado
      setToken(newToken);
      setUser(usuario);
      setIsSignout(false);

      // Configurar API com novo token
      apiService.setToken(newToken);

      // Registrar dispositivo para sync (se ainda não registrado)
      await registrarDispositivo(usuario);

      logger.info('[Auth] Login bem-sucedido', { email, role: usuario.tipoPermissao });
      
      // Callback opcional
      onAuthChange?.(usuario);

    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      logger.error('[Auth] Erro no login', error);
      throw new Error(mensagem);
    } finally {
      setIsLoading(false);
  
  }
  }, [onAuthChange]);

  // ==========================================================================
  // REGISTRO DE DISPOSITIVO PARA SYNC
  // ==========================================================================

  const registrarDispositivo = useCallback(async (usuario: Usuario) => {
    try {
      // Verificar se já temos dispositivo registrado
      const savedDevice = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE);
      
      if (savedDevice) {
        const device = JSON.parse(savedDevice);
        await databaseService.setDeviceId(device.id, device.nome, device.chave);
        return;    
  }

      // Gerar novo dispositivo
      const deviceId = `mobile_${usuario.id}_${Date.now()}`;
      const deviceName = `Celular ${usuario.nome.split(' ')[0]}`;
      const deviceKey = Math.random().toString(36).substr(2, 6).toUpperCase();

      const deviceData = {
        id: deviceId,
        nome: deviceName,
        chave: deviceKey,
        tipo: 'Celular' as const,
        dataCadastro: new Date().toISOString(),
      };

      // Salvar localmente
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE, JSON.stringify(deviceData));
      
      // Configurar no banco local
      await databaseService.setDeviceId(deviceId, deviceName, deviceKey);

      // Enviar para servidor (se não for mock)
      if (!API_CONFIG.useMock) {
        await apiService.registrarEquipamento(deviceData);
    
  }

      logger.info('[Auth] Dispositivo registrado', { deviceId, deviceName });
    } catch (error) {
      logger.error('[Auth] Erro ao registrar dispositivo', error);
      // Não falhar o login por causa disso
  
  }
  }, []);

  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info('[Auth] Realizando logout');

      // Chamar API se não for mock
      if (!API_CONFIG.useMock) {
        await apiService.logout().catch(() => {}); // Ignorar erros no logout
    
  }

      // Limpar AsyncStorage
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,        STORAGE_KEYS.USER,
        // Manter DEVICE para não precisar re-registrar no próximo login
        // STORAGE_KEYS.DEVICE,
      ]);

      // Limpar estado
      setToken(null);
      setUser(null);
      apiService.setToken(null);
      setIsSignout(true);

      logger.info('[Auth] Logout realizado');
      
      // Callback opcional
      onAuthChange?.(null);

    } catch (error) {
      logger.error('[Auth] Erro no logout', error);
      // Forçar logout mesmo com erro
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
    if (!token || API_CONFIG.useMock) return;

    try {
      const response = await apiService.getUsuarioAtual();
      
      if (response.success && response.data) {
        const usuarioAtualizado = response.data as Usuario;
        
        setUser(usuarioAtualizado);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(usuarioAtualizado));
        
        logger.info('[Auth] Usuário atualizado');
    
  }
    } catch (error) {
      logger.error('[Auth] Erro ao atualizar usuário', error);
  
  }
  }, [token]);
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
    return user.rotasPermitidas.includes(rotaId);
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
    // Estado
    user,
    token,
    isLoading,
    isSignout,
    isAuthenticated,
        // Ações
    login,
    logout,
    refreshUser,
    
    // Utilitários de permissão
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

// ============================================================================
// EXPORTAÇÃO PADRÃO
// ============================================================================

export default AuthContext;