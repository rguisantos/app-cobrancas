/**
 * ApiService.ts
 * Serviço de comunicação com a API REST
 * Responsável por todas as requisições HTTP para sincronização
 */

import { 
  SyncPayload, 
  SyncResponse, 
  SyncSnapshotResponse,
  ChangeLog,
  Equipamento,
  SyncMetadata,
  SyncConflict,
  DeviceActivationRequest,
  DeviceActivationResponse
} from '../types';
import { ENV } from '../config/env';

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
  
  // Nenhuma URL configurada — o app não funcionará sem uma URL válida
  throw new Error(
    'API_URL não configurada. Defina EXPO_PUBLIC_API_URL no .env ou extra.API_URL no app.json.'
  );
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
  /** Active AbortControllers keyed by requestId — allows per-request cancellation */
  private activeRequests: Map<string, AbortController> = new Map();
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
   * Cancela uma requisição específica por requestId, ou todas se omitido
   */
  cancelRequest(requestId?: string): void {
    if (requestId) {
      const controller = this.activeRequests.get(requestId);
      if (controller) {
        controller.abort();
        this.activeRequests.delete(requestId);
      }
    } else {
      // Cancel all active requests
      for (const [id, controller] of this.activeRequests) {
        controller.abort();
      }
      this.activeRequests.clear();
    }
  }

  // ==========================================================================
  // MÉTODOS DE REQUISIÇÃO BASE
  // ==========================================================================

  /**
   * Faz requisição HTTP com retry para erros de rede.
   * HTTP errors (4xx/5xx) NÃO são retentados — apenas falhas de conexão.
   */
  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = API_CONFIG.retries
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.request<T>(endpoint, options);
        // If it's a network error (no statusCode), retry
        if (!result.success && !result.statusCode && attempt < retries) {
          if (ENV.DEBUG) {
            console.log(`[API] Tentativa ${attempt + 1}/${retries} falhou (rede) — retentando...`);
          }
          await new Promise(r => setTimeout(r, API_CONFIG.retryDelay * (attempt + 1)));
          continue;
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          if (ENV.DEBUG) {
            console.log(`[API] Tentativa ${attempt + 1}/${retries} exceção — retentando...`);
          }
          await new Promise(r => setTimeout(r, API_CONFIG.retryDelay * (attempt + 1)));
        }
      }
    }

    return { success: false, error: lastError?.message || 'Erro de conexão' };
  }

  /**
   * Faz requisição HTTP genérica
   * Token é mantido em memória via setToken() pelo AuthContext —
   * não lemos AsyncStorage a cada request para evitar overhead e inconsistências.
   * O AuthContext sincroniza o token entre SecureStore e este serviço.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const method = options.method || 'GET';

    // Configurar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Criar AbortController com timeout para esta requisição
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    this.activeRequests.set(requestId, controller);

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const duration = Date.now() - startTime;

      // Tentar ler resposta
      let data: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text };
      }

      if (!response.ok) {
        if (ENV.DEBUG) {
          console.log(`[API] ${method} ${endpoint} → ${response.status} (${duration}ms)`);
        }

        // 401 = token inválido ou expirado → disparar logout automático
        if (response.status === 401 && this.onUnauthenticated && this.token) {
          this.onUnauthenticated();
        }

        return {
          success: false,
          error: data.message || data.error || `Erro HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      if (ENV.DEBUG) {
        console.log(`[API] ${method} ${endpoint} → ${response.status} (${duration}ms)`);
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
          console.log(`[API] ${method} ${endpoint} — cancelado (${duration}ms)`);
        }
        return {
          success: false,
          error: 'Requisição cancelada',
        };
      }

      // Erro de rede
      if (ENV.DEBUG) {
        console.log(`[API] ${method} ${endpoint} — erro de rede (${duration}ms): ${error instanceof Error ? error.message : String(error)}`);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    } finally {
      clearTimeout(timeoutId);
      this.activeRequests.delete(requestId);
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

    return this.requestWithRetry<T>(url, { method: 'GET' });
  }

  /**
   * Requisição POST
   */
  private async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Requisição PUT
   */
  private async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Requisição DELETE
   */
  private async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(endpoint, { method: 'DELETE' });
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
      console.log(`[API:SYNC:PUSH] ${payload.changes?.length || 0} changes, deviceId=${payload.deviceId}`);
    }

    const response = await this.post<SyncResponse>('/api/sync/push', payload);

    if (!response.success || !response.data) {
      if (ENV.DEBUG) {
        console.log(`[API:SYNC:PUSH] falha: ${response.error}`);
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
      const data = response.data;
      console.log(`[API:SYNC:PUSH] OK — conflicts=${data.conflicts?.length || 0}, errors=${data.errors?.length || 0}`);
    }
    return response.data;
  }

  /**
   * Busca mudanças do servidor (PULL)
   * Requer token JWT para autenticação
   * CORREÇÃO: Suporta paginação via hasMore — faz pull em loop até receber todos os dados
   */
  async pullChanges(payload: PullChangesRequest): Promise<SyncResponse> {
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

      const response = await this.post<SyncResponse>('/api/sync/pull', {
        ...payload,
        lastSyncAt: currentLastSyncAt,
      });

      if (!response.success || !response.data) {
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

      const data = response.data;
      const changes = data.changes || {};

      // Acumular resultados
      const allCh = allChanges.changes || {};
      allCh.clientes = [...(allCh.clientes || []), ...(changes.clientes || [])];
      allCh.produtos = [...(allCh.produtos || []), ...(changes.produtos || [])];
      allCh.locacoes = [...(allCh.locacoes || []), ...(changes.locacoes || [])];
      allCh.cobrancas = [...(allCh.cobrancas || []), ...(changes.cobrancas || [])];
      allCh.rotas = [...(allCh.rotas || []), ...(changes.rotas || [])];
      allCh.usuarios = [...(allCh.usuarios || []), ...(changes.usuarios || [])];
      allChanges.changes = allCh;
      allChanges.lastSyncAt = data.lastSyncAt;
      allChanges.conflicts = [...(allChanges.conflicts || []), ...(data.conflicts || [])];
      allChanges.errors = [...(allChanges.errors || []), ...(data.errors || [])];
      allChanges.isStale = data.isStale;

      // Verificar paginação
      hasMore = !!data.hasMore;
      currentLastSyncAt = data.lastSyncAt;
    }

    if (ENV.DEBUG) {
      const changes = allChanges.changes || {};
      const total = (changes.clientes?.length || 0) + (changes.produtos?.length || 0) +
        (changes.locacoes?.length || 0) + (changes.cobrancas?.length || 0) + (changes.rotas?.length || 0);
      console.log(`[API:SYNC:PULL] OK — ${pullRound} rounds, ${total} entidades`);
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
  // EQUIPAMENTOS (DEPRECATED)
  // ==========================================================================

  /**
   * @deprecated Use fluxo de ativação com PIN (ativarDispositivo) em vez de registro automático.
   * O admin deve criar o dispositivo no painel web, e o mobile ativa com PIN.
   * Este endpoint legado ainda funciona mas será removido em versão futura.
   */
  async registrarEquipamento(dados: { id: string; nome: string; chave: string; tipo: 'Celular' | 'Tablet' | 'Outro'; dataCadastro: string }): Promise<ApiResponse<{ success: boolean; id: string; _deprecated?: boolean }>> {
    const response = await this.post<{ success: boolean; id: string; _deprecated?: boolean }>('/api/equipamentos', dados);

    if (ENV.DEBUG) {
      console.log(`[DEVICE:REGISTER] DEPRECATED — ${response.success ? 'OK' : response.error}`);
    }

    return response;
  }

  /**
   * @deprecated Fluxo de equipamentos legado. Use ativação com PIN.
   */
  async atualizarEquipamento(dados: Partial<Equipamento> & { id: string }): Promise<ApiResponse<{ success: boolean }>> {
    return this.put(`/api/equipamentos/${dados.id}`, dados);
  }

  /**
   * @deprecated Fluxo de equipamentos legado. Use ativação com PIN.
   */
  async getEquipamentos(): Promise<ApiResponse<Equipamento[]>> {
    return this.get('/api/equipamentos');
  }

  /**
   * @deprecated Fluxo de equipamentos legado. Use ativação com PIN.
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
  async login(email: string, senha: string): Promise<ApiResponse<{ token: string; refreshToken?: string; user: any }>> {
    return this.post('/api/mobile/auth/login', { email, password: senha });
  }

  /**
   * CORREÇÃO: Renova token JWT via /api/mobile/auth/refresh
   * Deve ser chamado quando o token está próximo de expirar ou ao receber 401
   * Envia o refreshToken armazenado para obter novos tokens (rotação).
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<{ token: string; refreshToken?: string; user: any }>> {
    return this.post('/api/mobile/auth/refresh', { refreshToken });
  }

  /**
   * CORREÇÃO: Busca snapshot completo para device estale
   * Usado quando o dispositivo fica >30 dias sem sync
   */
  async getSnapshot(deviceId: string, deviceKey: string): Promise<ApiResponse<SyncSnapshotResponse>> {
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
   */
  async getUsuarioAtual(): Promise<ApiResponse<any>> {
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
  async getDashboardMobile(): Promise<ApiResponse<import('../types').DashboardMobileData>> {
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
  // HISTÓRICO DE RELÓGIO
  // ==========================================================================

  /**
   * Cria um registro de alteração de relógio no backend.
   * O backend cria o HistoricoRelogio E atualiza o numeroRelogio do produto
   * em uma única transação.
   *
   * @param dados - { produtoId, relogioNovo, motivo }
   */
  async criarHistoricoRelogio(dados: { produtoId: string; relogioNovo: string; motivo: string }): Promise<ApiResponse<any>> {
    return this.post('/api/historico-relogio', dados);
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
