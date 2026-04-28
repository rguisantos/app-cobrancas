/**
 * ApiService.ts
 * Serviço de comunicação com a API REST
 * Responsável por todas as requisições HTTP para sincronização
 */

import { 
  SyncPayload, 
  SyncResponse, 
  ChangeLog,
  Equipamento,
  SyncMetadata,
  SyncConflict,
  DeviceActivationRequest,
  DeviceActivationResponse
} from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';

// Chave do token no AsyncStorage (mesma do AuthContext)
const TOKEN_KEY = '@cobrancas:token';

// ============================================================================
// CONFIGURAÇÃO DA API
// ============================================================================

import Constants from 'expo-constants';

// Obter URL da API das variáveis de ambiente
const getApiUrl = (): string => {
  // Tentar pegar do extra do expo config
  const extraUrl = (Constants.expoConfig as any)?.extra?.API_URL;
  if (extraUrl) return extraUrl;
  
  // Tentar pegar do process.env
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  
  // Fallback
  return 'https://app-cobrancas-web.vercel.app';
};

const API_CONFIG = {
  baseURL: getApiUrl(),
  timeout: 30000, // 30 segundos
  retries: 3,
  retryDelay: 1000, // 1 segundo
};

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
  statusCode?: number;
}

export interface PushChangesRequest {
  deviceId: string;
  deviceKey: string;
  lastSyncAt: string;
  changes: ChangeLog[];
}

export interface PullChangesRequest {
  deviceId: string;
  deviceKey: string;
  lastSyncAt: string;
}
export interface RegistrarEquipamentoRequest {
  id: string;
  nome: string;
  chave: string;
  tipo: 'Celular' | 'Tablet' | 'Outro';
  dataCadastro: string;
}

export interface ResolverConflitoRequest {
  conflitoId: string;
  estrategia: 'local' | 'remote' | 'newest' | 'manual';
  versaoFinal: any;
}

export interface HealthCheckResponse {
  ok: boolean;
  timestamp: string;
  version?: string;
}

// ============================================================================
// CLASSE API SERVICE
// ============================================================================

class ApiService {
  private baseURL: string;
  private token: string | null = null;
  private abortController: AbortController | null = null;
  /**
   * Callback chamado quando o servidor retorna 401 (token expirado/inválido).
   * Registrado pelo AuthContext para forçar logout automático.
   */
  private onUnauthenticated: (() => void) | null = null;

  constructor() {
    this.baseURL = API_CONFIG.baseURL;

  }

  // ==========================================================================
  // CONFIGURAÇÃO
  // ==========================================================================

  /**
   * Define o token de autenticação
   */
  setToken(token: string | null): void {
    this.token = token;
    if (ENV.DEBUG) {
      console.log(`[ApiService] setToken: token ${token ? 'definido' : 'removido'}`);
    }
  }

  /**
   * Define a URL base da API
   */
  setBaseURL(url: string): void {
    this.baseURL = url;

  }
  /**
   * Registra callback para logout automático quando token expirar (401).
   */
  setOnUnauthenticated(callback: () => void): void {
    this.onUnauthenticated = callback;
  }

  /**
   * Cancela requisição em andamento
   */
  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
  
  }

  }

  // ==========================================================================
  // MÉTODOS DE REQUISIÇÃO BASE
  // ==========================================================================

  /**
   * Faz requisição HTTP genérica
   * SEMPRE lê o token do AsyncStorage antes de cada requisição para garantir sincronização
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    if (ENV.DEBUG) {
      console.log(`\n[API:${requestId}] ========== REQUEST START ==========`);
      console.log(`[API:${requestId}] URL: ${url}`);
      console.log(`[API:${requestId}] Method: ${options.method || 'GET'}`);
    }
    
    // CRÍTICO: Sempre ler token do AsyncStorage antes de cada requisição
    // Isso garante que o token esteja sempre sincronizado entre AuthContext e ApiService
    let tokenFromStorage: string | null = null;
    try {
      tokenFromStorage = await AsyncStorage.getItem(TOKEN_KEY);
      if (tokenFromStorage) {
        // Sincronizar token local com AsyncStorage
        this.token = tokenFromStorage;
        if (ENV.DEBUG) {
          console.log(`[API:${requestId}] Token lido do AsyncStorage`);
        }
      } else if (ENV.DEBUG) {
        console.warn(`[API:${requestId}] ⚠️ Nenhum token encontrado no AsyncStorage`);
      }
    } catch (storageError) {
      if (ENV.DEBUG) {
        console.error(`[API:${requestId}] Erro ao ler token do AsyncStorage:`, storageError);
      }
    }
    
    if (ENV.DEBUG) {
      console.log(`[API:${requestId}] Has Token: ${!!this.token}`);
    }
    
    // Configurar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Adicionar token se existir
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      if (ENV.DEBUG) {
        console.log(`[API:${requestId}] Authorization header adicionado`);
      }
    } else if (ENV.DEBUG) {
      console.warn(`[API:${requestId}] ⚠️ ATENÇÃO: Requisição sem token! Endpoint: ${endpoint}`);
    }
    
    // Log do body se existir
    if (options.body && ENV.DEBUG) {
      const bodyPreview = typeof options.body === 'string' 
        ? options.body.substring(0, 300) 
        : JSON.stringify(options.body).substring(0, 300);
      console.log(`[API:${requestId}] Body: ${bodyPreview}...`);
    }

    // Criar AbortController para esta requisição
    this.abortController = new AbortController();

    const startTime = Date.now();

    try {
      if (ENV.DEBUG) {
        console.log(`[API:${requestId}] Enviando requisição...`);
      }
      const response = await fetch(url, {
        ...options,
        headers,
        signal: this.abortController.signal,
      });

      const duration = Date.now() - startTime;
      if (ENV.DEBUG) {
        console.log(`[API:${requestId}] Status: ${response.status} (${duration}ms)`);
      }
      
      // Tentar ler resposta
      let data: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (ENV.DEBUG) {
          console.log(`[API:${requestId}] Response (text): ${text.substring(0, 200)}`);
        }
        data = { message: text };
      }
      
      if (ENV.DEBUG) {
        console.log(`[API:${requestId}] Response:`, JSON.stringify(data).substring(0, 300));
      }

      if (!response.ok) {
        if (ENV.DEBUG) {
          console.error(`[API:${requestId}] ❌ ERRO HTTP ${response.status}`);
          console.error(`[API:${requestId}] Error details:`, data);
          console.log(`[API:${requestId}] ========== REQUEST END (ERROR) ==========\n`);
        }

        // 401 = token inválido ou expirado → disparar logout automático
        if (response.status === 401 && this.onUnauthenticated && this.token) {
          if (ENV.DEBUG) {
            console.warn(`[API:${requestId}] 401 recebido — disparando logout automático`);
          }
          this.onUnauthenticated();
        }

        return {
          success: false,
          error: data.message || data.error || `Erro HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      if (ENV.DEBUG) {
        console.log(`[API:${requestId}] ✅ SUCESSO`);
        console.log(`[API:${requestId}] ========== REQUEST END (OK) ==========\n`);
      }
      return {
        success: true,
        data: data as T,
        statusCode: response.status,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Verificar se foi cancelado
      if (error instanceof Error && error.name === 'AbortError') {
        if (ENV.DEBUG) {
          console.log(`[API:${requestId}] Requisição cancelada após ${duration}ms`);
          console.log(`[API:${requestId}] ========== REQUEST END (CANCELLED) ==========\n`);
        }
        return {
          success: false,
          error: 'Requisição cancelada',
        };
      }

      // Erro de rede
      if (ENV.DEBUG) {
        console.error(`[API:${requestId}] ❌ ERRO DE REDE após ${duration}ms:`, error);
        console.error(`[API:${requestId}] Error type: ${error instanceof Error ? error.name : typeof error}`);
        console.error(`[API:${requestId}] Error message: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`[API:${requestId}] ========== REQUEST END (NETWORK ERROR) ==========\n`);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Requisição GET
   */
  private async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url = `${endpoint}?${queryString}`;
  
  }

    return this.request<T>(url, { method: 'GET' });

  }

  /**
   * Requisição POST
   */
  private async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),    });

  }

  /**
   * Requisição POST sem autenticação (para sync via deviceKey)
   * A sincronização usa deviceKey como credencial, não token JWT
   */
  private async postWithoutAuth<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    if (ENV.DEBUG) {
      console.log(`\n[SYNC:${requestId}] ========== SYNC REQUEST START ==========`);
      console.log(`[SYNC:${requestId}] URL: ${url}`);
      console.log(`[SYNC:${requestId}] Method: POST (sem token - autenticação via deviceKey)`);
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (ENV.DEBUG) {
      const bodyPreview = JSON.stringify(body).substring(0, 300);
      console.log(`[SYNC:${requestId}] Body: ${bodyPreview}...`);
    }

    this.abortController = new AbortController();
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      const duration = Date.now() - startTime;
      if (ENV.DEBUG) {
        console.log(`[SYNC:${requestId}] Status: ${response.status} (${duration}ms)`);
      }
      
      let data: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text };
      }
      
      if (ENV.DEBUG) {
        console.log(`[SYNC:${requestId}] Response:`, JSON.stringify(data).substring(0, 300));
      }

      if (!response.ok) {
        if (ENV.DEBUG) {
          console.error(`[SYNC:${requestId}] ❌ ERRO HTTP ${response.status}`);
          console.log(`[SYNC:${requestId}] ========== SYNC REQUEST END (ERROR) ==========\n`);
        }
        return {
          success: false,
          error: data.message || data.error || `Erro HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      if (ENV.DEBUG) {
        console.log(`[SYNC:${requestId}] ✅ SUCESSO`);
        console.log(`[SYNC:${requestId}] ========== SYNC REQUEST END (OK) ==========\n`);
      }
      return {
        success: true,
        data: data as T,
        statusCode: response.status,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      if (ENV.DEBUG) {
        console.error(`[SYNC:${requestId}] ❌ ERRO DE REDE após ${duration}ms:`, error);
        console.log(`[SYNC:${requestId}] ========== SYNC REQUEST END (NETWORK ERROR) ==========\n`);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Requisição PUT
   */
  private async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

  }

  /**
   * Requisição DELETE
   */
  private async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });

  }

  // ==========================================================================
  // SINCRONIZAÇÃO (requer token JWT para autenticação)
  // ==========================================================================

  /**
   * Envia mudanças locais para o servidor (PUSH)
   * Requer token JWT para autenticação
   */
  async pushChanges(payload: PushChangesRequest): Promise<SyncResponse> {
    if (ENV.DEBUG) {
      console.log(`\n[SYNC:PUSH] ========== INICIANDO PUSH ==========`);
      console.log(`[SYNC:PUSH] DeviceId: ${payload.deviceId}`);
      console.log(`[SYNC:PUSH] DeviceKey: ${payload.deviceKey?.substring(0, 20)}...`);
      console.log(`[SYNC:PUSH] LastSyncAt: ${payload.lastSyncAt}`);
      console.log(`[SYNC:PUSH] Changes count: ${payload.changes?.length || 0}`);
      console.log(`[SYNC:PUSH] Token disponível: ${!!this.token}`);
      
      if (payload.changes && payload.changes.length > 0) {
        console.log(`[SYNC:PUSH] Changes summary:`);
        payload.changes.forEach((c, i) => {
          console.log(`[SYNC:PUSH]   ${i + 1}. ${c.operation} ${c.entityType}:${c.entityId?.substring(0, 8)}...`);
        });
      }
    }
    
    // Usa post() que inclui o token JWT no header
    const response = await this.post<SyncResponse>('/api/sync/push', payload);

    if (!response.success) {
      if (ENV.DEBUG) {
        console.error(`[SYNC:PUSH] ❌ FALHA: ${response.error}`);
        console.log(`[SYNC:PUSH] ========== PUSH END (ERROR) ==========\n`);
      }
      return {
        success: false,
        lastSyncAt: new Date().toISOString(),
        changes: {
          clientes: [],
          produtos: [],
          locacoes: [],
          cobrancas: [],
          rotas: [],
        },
        conflicts: [],
        errors: [response.error || 'Falha ao enviar mudanças'],
      };
    }

    if (ENV.DEBUG) {
      console.log(`[SYNC:PUSH] ✅ SUCESSO`);
      console.log(`[SYNC:PUSH] Conflicts: ${response.data?.conflicts?.length || 0}`);
      console.log(`[SYNC:PUSH] Errors: ${response.data?.errors?.length || 0}`);
      console.log(`[SYNC:PUSH] ========== PUSH END (OK) ==========\n`);
    }
    return response.data!;
  }

  /**
   * Busca mudanças do servidor (PULL)
   * Requer token JWT para autenticação
   * CORREÇÃO: Suporta paginação via hasMore — faz pull em loop até receber todos os dados
   */
  async pullChanges(payload: PullChangesRequest): Promise<SyncResponse> {
    if (ENV.DEBUG) {
      console.log(`\n[SYNC:PULL] ========== INICIANDO PULL ==========`);
      console.log(`[SYNC:PULL] DeviceId: ${payload.deviceId}`);
      console.log(`[SYNC:PULL] DeviceKey: ${payload.deviceKey?.substring(0, 20)}...`);
      console.log(`[SYNC:PULL] LastSyncAt: ${payload.lastSyncAt}`);
      console.log(`[SYNC:PULL] Token disponível: ${!!this.token}`);
    }
    
    // CORREÇÃO: Fazer pull em loop para suportar paginação
    let allChanges: SyncResponse = {
      success: true,
      lastSyncAt: new Date().toISOString(),
      changes: {
        clientes: [],
        produtos: [],
        locacoes: [],
        cobrancas: [],
        rotas: [],
      },
      conflicts: [],
      errors: [],
    };

    let currentLastSyncAt = payload.lastSyncAt;
    let hasMore = true;
    let pullRound = 0;

    while (hasMore) {
      pullRound++;
      if (ENV.DEBUG) {
        console.log(`[SYNC:PULL] Round ${pullRound} — lastSyncAt: ${currentLastSyncAt}`);
      }

      const response = await this.post<SyncResponse>('/api/sync/pull', {
        ...payload,
        lastSyncAt: currentLastSyncAt,
      });

      if (!response.success) {
        if (ENV.DEBUG) {
          console.error(`[SYNC:PULL] ❌ FALHA: ${response.error}`);
          console.log(`[SYNC:PULL] ========== PULL END (ERROR) ==========\n`);
        }
        // Se já temos dados de rounds anteriores, retornar o que temos
        if (pullRound > 1) {
          allChanges.errors = [...(allChanges.errors || []), response.error || 'Falha em round de pull'];
          break;
        }
        return {
          success: false,
          lastSyncAt: new Date().toISOString(),
          changes: {
            clientes: [],
            produtos: [],
            locacoes: [],
            cobrancas: [],
            rotas: [],
          },
          conflicts: [],
          errors: [response.error || 'Falha ao buscar mudanças'],
        };
      }

      const data = response.data!;
      const changes = data.changes || {};

      // Acumular resultados
      const allCh = allChanges.changes || {};
      allCh.clientes = [...(allCh.clientes || []), ...(changes.clientes || [])];
      allCh.produtos = [...(allCh.produtos || []), ...(changes.produtos || [])];
      allCh.locacoes = [...(allCh.locacoes || []), ...(changes.locacoes || [])];
      allCh.cobrancas = [...(allCh.cobrancas || []), ...(changes.cobrancas || [])];
      allCh.rotas = [...(allCh.rotas || []), ...(changes.rotas || [])];
      allCh.usuarios = [...((allCh as any).usuarios || []), ...((changes as any).usuarios || [])];
      allChanges.changes = allCh;
      allChanges.lastSyncAt = data.lastSyncAt;
      allChanges.conflicts = [...(allChanges.conflicts || []), ...(data.conflicts || [])];
      allChanges.errors = [...(allChanges.errors || []), ...(data.errors || [])];
      allChanges.isStale = data.isStale;

      // Verificar paginação
      hasMore = !!data.hasMore;
      currentLastSyncAt = data.lastSyncAt;

      if (ENV.DEBUG) {
        console.log(`[SYNC:PULL] Round ${pullRound} — hasMore: ${hasMore}, lastSyncAt: ${data.lastSyncAt}`);
      }
    }

    if (ENV.DEBUG) {
      const changes = allChanges.changes || {};
      console.log(`[SYNC:PULL] ✅ SUCESSO (${pullRound} rounds)`);
      console.log(`[SYNC:PULL] Clientes: ${changes.clientes?.length || 0}`);
      console.log(`[SYNC:PULL] Produtos: ${changes.produtos?.length || 0}`);
      console.log(`[SYNC:PULL] Locações: ${changes.locacoes?.length || 0}`);
      console.log(`[SYNC:PULL] Cobranças: ${changes.cobrancas?.length || 0}`);
      console.log(`[SYNC:PULL] Rotas: ${changes.rotas?.length || 0}`);
      console.log(`[SYNC:PULL] ========== PULL END (OK) ==========\n`);
    }
    return allChanges;
  }

  /**
   * Health check da API
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await this.get<HealthCheckResponse>('/api/health');

    if (!response.success) {
      return {
        ok: false,
        timestamp: new Date().toISOString(),
      };
  
  }

    return response.data || { ok: false, timestamp: new Date().toISOString() };

  }

  // ==========================================================================
  // EQUIPAMENTOS
  // ==========================================================================

  /**
   * DEPRECATED: Usar fluxo de ativação com PIN (ativarDispositivo) em vez de registro automático.
   * O admin deve criar o dispositivo no painel web, e o mobile ativa com PIN.
   * Mantido para compatibilidade com versões antigas.
   */
  async registrarEquipamento(dados: RegistrarEquipamentoRequest): Promise<ApiResponse<{ success: boolean; id: string; _deprecated?: boolean }>> {
    if (ENV.DEBUG) {
      console.warn(`[DEVICE:REGISTER] ⚠️ DEPRECATED — Use fluxo de ativação com PIN`);
      console.log(`[DEVICE:REGISTER] ID: ${dados.id}`);
      console.log(`[DEVICE:REGISTER] Nome: ${dados.nome}`);
    }

    // Still calls the legacy endpoint (which now logs deprecation warning)
    const response = await this.post<{ success: boolean; id: string; _deprecated?: boolean }>('/api/equipamentos', dados);

    if (response.success) {
      if (ENV.DEBUG) {
        console.log(`[DEVICE:REGISTER] ✅ Dispositivo registrado: ${response.data?.id}`);
      }
    } else if (ENV.DEBUG) {
      console.error(`[DEVICE:REGISTER] ❌ Falha: ${response.error}`);
    }

    return response;
  }
  /**
   * Atualiza informações do equipamento
   */
  async atualizarEquipamento(dados: Partial<Equipamento> & { id: string }): Promise<ApiResponse<{ success: boolean }>> {
    return this.put(`/api/equipamentos/${dados.id}`, dados);

  }

  /**
   * Busca equipamentos do usuário
   */
  async getEquipamentos(): Promise<ApiResponse<Equipamento[]>> {
    return this.get('/api/equipamentos');

  }

  /**
   * Remove equipamento
   */
  async removerEquipamento(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.delete(`/api/equipamentos/${id}`);

  }

  // ==========================================================================
  // ATIVAÇÃO DE DISPOSITIVO
  // ==========================================================================

  /**
   * Ativa dispositivo com senha de 6 dígitos
   * Usado quando o dispositivo é novo e precisa ser ativado
   */
  async ativarDispositivo(dados: DeviceActivationRequest): Promise<ApiResponse<DeviceActivationResponse>> {
    return this.post('/api/dispositivos/ativar', dados);
  }

  /**
   * Verifica se o dispositivo precisa de ativação
   * Usa endpoint específico para verificar status
   */
  async verificarStatusDispositivo(deviceKey?: string): Promise<ApiResponse<{
    needsActivation: boolean;
    dispositivoId?: string;
    status?: string;
  }>> {
    const response = await this.post<{
      needsActivation: boolean;
      dispositivoId?: string;
      status?: string;
    }>('/api/dispositivos/status', { deviceKey });

    return response;
  }

  // ==========================================================================
  // CONFLITOS
  // ==========================================================================

  /**
   * Envia resolução de conflito para o servidor
   */
  async resolverConflito(dados: ResolverConflitoRequest): Promise<ApiResponse<{ success: boolean }>> {
    return this.post('/api/sync/conflict/resolve', dados);

  }

  /**
   * Busca lista de conflitos pendentes
   */
  async getConflitosPendentes(deviceId: string): Promise<ApiResponse<SyncConflict[]>> {
    return this.get(`/api/sync/conflicts?deviceId=${deviceId}`);

  }

  // ==========================================================================
  // CLIENTES (Endpoints para sync inicial)
  // ==========================================================================

  /**
   * Busca todos os clientes (sync inicial)
   */
  async getClientes(rotaId?: string): Promise<ApiResponse<any[]>> {
    const params = rotaId ? { rotaId } : undefined;
    return this.get('/api/clientes', params);
  }

  /**
   * Busca cliente por ID
   */
  async getCliente(id: string): Promise<ApiResponse<any>> {
    return this.get(`/api/clientes/${id}`);

  }

  // ==========================================================================
  // PRODUTOS
  // ==========================================================================

  /**
   * Busca todos os produtos (sync inicial)
   */
  async getProdutos(status?: string): Promise<ApiResponse<any[]>> {
    const params = status ? { status } : undefined;
    return this.get('/api/produtos', params);

  }

  /**
   * Busca produto por ID
   */
  async getProduto(id: string): Promise<ApiResponse<any>> {
    return this.get(`/api/produtos/${id}`);

  }

  // ==========================================================================
  // LOCAÇÕES
  // ==========================================================================

  /**
   * Busca locações por cliente
   */
  async getLocacoesPorCliente(clienteId: string): Promise<ApiResponse<any[]>> {
    return this.get(`/api/locacoes`, { clienteId });

  }

  /**
   * Busca locações ativas
   */
  async getLocacoesAtivas(): Promise<ApiResponse<any[]>> {
    return this.get('/api/locacoes/ativas');

  }

  // ==========================================================================
  // COBRANÇAS
  // ==========================================================================
  /**
   * Busca histórico de cobranças
   */
  async getCobrancas(clienteId?: string, produtoId?: string): Promise<ApiResponse<any[]>> {
    const params: Record<string, any> = {};
    if (clienteId) params.clienteId = clienteId;
    if (produtoId) params.produtoId = produtoId;
    return this.get('/api/cobrancas', params);

  }

  /**
   * Registra nova cobrança
   */
  async registrarCobranca(dados: any): Promise<ApiResponse<any>> {
    return this.post('/api/cobrancas', dados);

  }

  // ==========================================================================
  // ROTAS
  // ==========================================================================

  /**
   * Busca todas as rotas
   */
  async getRotas(status?: string): Promise<ApiResponse<any[]>> {
    const params = status ? { status } : undefined;
    return this.get('/api/rotas', params);

  }

  // ==========================================================================
  // USUÁRIOS
  // ==========================================================================

  /**
   * Login do usuário
   * NOTA: Usa /api/mobile/auth/login para evitar interceptação pelo NextAuth
   */
  async login(email: string, senha: string): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.post('/api/mobile/auth/login', { email, password: senha });
  }

  /**
   * CORREÇÃO: Renova token JWT via /api/mobile/auth/refresh
   * Deve ser chamado quando o token está próximo de expirar ou ao receber 401
   */
  async refreshToken(): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.post('/api/mobile/auth/refresh', {});
  }

  /**
   * CORREÇÃO: Busca snapshot completo para device estale
   * Usado quando o dispositivo fica >30 dias sem sync
   */
  async getSnapshot(deviceId: string, deviceKey: string): Promise<ApiResponse<any>> {
    return this.post('/api/sync/snapshot', { deviceId, deviceKey });
  }

  /**
   * Logout do usuário
   */
  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    return this.post('/api/auth/logout', {});

  }

  /**
   * Busca dados do usuário autenticado
   */  async getUsuarioAtual(): Promise<ApiResponse<any>> {
    return this.get('/api/auth/me');

  }

  /**
   * Altera senha do usuário
   */
  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.post('/api/auth/change-password', { senhaAtual, novaSenha });

  }

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================

  /**
   * Busca dados do dashboard mobile
   */
  async getDashboardMobile(): Promise<ApiResponse<any>> {
    return this.get('/api/dashboard/mobile');

  }

  /**
   * Busca dados do dashboard web
   */
  async getDashboardWeb(filtros?: any): Promise<ApiResponse<any>> {
    return this.get('/api/dashboard/web', filtros);

  }

  // ==========================================================================
  // RELATÓRIOS
  // ==========================================================================

  /**
   * Gera relatório financeiro
   */
  async getRelatorioFinanceiro(dataInicio: string, dataFim: string): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/financeiro', { dataInicio, dataFim });

  }

  /**
   * Gera relatório de produtos
   */
  async getRelatorioProdutos(status?: string): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/produtos', { status });

  }

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================
  /**
   * Verifica se há conexão com a API
   */
  async isConnected(): Promise<boolean> {
    const response = await this.healthCheck();
    return response.ok;

  }

  /**
   * Aguarda conexão ficar disponível
   */
  async waitForConnection(maxAttempts: number = 10): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const connected = await this.isConnected();
      if (connected) return true;
      
      // Aguarda antes de próxima tentativa
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelay));
  
  }
    
    return false;

  }
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export const apiService = new ApiService();
export default apiService;
