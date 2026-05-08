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
  private requestScopes: Map<string, string> = new Map();
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
        this.requestScopes.delete(requestId);
      }
    } else {
      // Cancel all active requests
      for (const [id, controller] of this.activeRequests) {
        controller.abort();
        this.requestScopes.delete(id);
      }
      this.activeRequests.clear();
    }
  }

  /**
   * Cancela todas as requisições associadas a um escopo lógico.
   */
  cancelScope(scope: string): void {
    for (const [id, requestScope] of this.requestScopes) {
      if (requestScope !== scope) continue;
      const controller = this.activeRequests.get(id);
      if (controller) {
        controller.abort();
      }
      this.activeRequests.delete(id);
      this.requestScopes.delete(id);
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
    retries: number = API_CONFIG.retries,
    requestScope?: string
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.request<T>(endpoint, options, requestScope);
        if (result.error === 'Requisição cancelada') {
          return result;
        }
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
    options: RequestInit = {},
    requestScope?: string
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
    if (requestScope) {
      this.requestScopes.set(requestId, requestScope);
    }

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
          data: data as T | undefined,
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
      this.requestScopes.delete(requestId);
    }
  }

  /**
   * Requisição GET
   */
  private async get<T>(endpoint: string, params?: Record<string, any>, requestScope?: string): Promise<ApiResponse<T>> {
    let url = endpoint;
    
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url = `${endpoint}?${queryString}`;
    }

    return this.requestWithRetry<T>(url, { method: 'GET' }, API_CONFIG.retries, requestScope);
  }

  /**
   * Requisição POST
   */
  async post<T>(endpoint: string, body: any, requestScope?: string): Promise<ApiResponse<T>> {
    return this.requestWithRetry<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }, API_CONFIG.retries, requestScope);
  }

  /**
   * Requisição PUT
   */
  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
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

    const response = await this.post<SyncResponse>('/api/sync/push', payload, 'sync');

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
          usuarios: [],
          manutencoes: [],
          metas: [],
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
   * Busca mudanças do servidor (PULL) — single round only.
   * 
   * Requer token JWT para autenticação.
   * 
   * NOTE: Pagination is handled by SyncService.pullChanges(), NOT here.
   * This method does a single POST /api/sync/pull request and returns the
   * raw response. The caller (SyncService) is responsible for looping with
   * hasMore pagination. The old pagination logic that was in this method
   * has been removed to avoid duplicate pagination — SyncService is the
   * single entry point for PULL operations.
   */
  async pullChanges(payload: PullChangesRequest): Promise<SyncResponse> {
    if (ENV.DEBUG) {
      console.log(`[API:SYNC:PULL] deviceId=${payload.deviceId}, lastSyncAt=${payload.lastSyncAt}`);
    }

    // Single round — pagination is handled by SyncService.pullChanges()
    const response = await this.post<SyncResponse>('/api/sync/pull', payload, 'sync');

    if (!response.success || !response.data) {
      if (ENV.DEBUG) {
        console.log(`[API:SYNC:PULL] falha: ${response.error}`);
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
          usuarios: [],
          manutencoes: [],
          metas: [],
        },
        conflicts: [],
        errors: [response.error || 'Falha ao buscar mudanças'],
      };
    }

    if (ENV.DEBUG) {
      const data = response.data;
      const changes = data.changes || {};
      const total = (changes.clientes?.length || 0) + (changes.produtos?.length || 0) +
        (changes.locacoes?.length || 0) + (changes.cobrancas?.length || 0) +
        (changes.rotas?.length || 0) + (changes.usuarios?.length || 0) +
        (changes.manutencoes?.length || 0) + (changes.metas?.length || 0);
      console.log(`[API:SYNC:PULL] OK — ${total} entidades, hasMore=${!!data.hasMore}, conflicts=${data.conflicts?.length || 0}, errors=${data.errors?.length || 0}`);
    }
    return response.data;
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
    // Compatibilidade: backend novo usa `senha`; legado pode aceitar `password`.
    return this.post('/api/mobile/auth/login', { email, senha, password: senha });
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

  /**
   * Solicita e-mail de recuperação de senha
   * Backend: POST /api/auth/forgot-password { email }
   */
  async forgotPassword(email: string): Promise<ApiResponse<{ success: boolean; message?: string }>> {
    return this.post('/api/auth/forgot-password', { email });
  }

  /**
   * Redefine a senha usando o token de recuperação
   * Backend: POST /api/auth/reset-password { token, novaSenha, confirmarSenha }
   */
  async resetPassword(token: string, novaSenha: string, confirmarSenha: string): Promise<ApiResponse<{ success: boolean; message?: string }>> {
    return this.post('/api/auth/reset-password', { token, novaSenha, confirmarSenha });
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
  // RELATÓRIOS EXPANDIDOS
  // ==========================================================================

  /**
   * Relatório de inadimplência — clientes com cobranças atrasadas
   */
  async getRelatorioInadimplencia(filters?: { rotaId?: string; dataInicio?: string; dataFim?: string }): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (filters?.rotaId) params.set('rotaId', filters.rotaId);
    if (filters?.dataInicio) params.set('dataInicio', filters.dataInicio);
    if (filters?.dataFim) params.set('dataFim', filters.dataFim);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/relatorios/inadimplencia${query}`);
  }

  /**
   * Relatório de estoque — produtos disponíveis (não locados)
   */
  async getRelatorioEstoque(filters?: { tipoId?: string; estabelecimento?: string; conservacao?: string }): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (filters?.tipoId) params.set('tipoId', filters.tipoId);
    if (filters?.estabelecimento) params.set('estabelecimento', filters.estabelecimento);
    if (filters?.conservacao) params.set('conservacao', filters.conservacao);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/relatorios/estoque${query}`);
  }

  /**
   * Relatório de recebimentos — cobranças pagas em um período
   */
  async getRelatorioRecebimentos(dataInicio: string, dataFim: string, rotaId?: string): Promise<ApiResponse<any>> {
    const params: Record<string, string> = { dataInicio, dataFim };
    if (rotaId) params.rotaId = rotaId;
    return this.get('/api/relatorios/recebimentos', params);
  }

  /**
   * Relatório de manutenções — trocas de pano e manutenções
   */
  async getRelatorioManutencoes(params?: { periodo?: string; dataInicio?: string; dataFim?: string; tipo?: string }): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/manutencoes', params as Record<string, any>);
  }

  /**
   * Relatório de rotas — desempenho por rota
   */
  async getRelatorioRotas(params?: { periodo?: string; dataInicio?: string; dataFim?: string }): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/rotas', params as Record<string, any>);
  }

  /**
   * Relatório operacional — resumo diário
   */
  async getRelatorioOperacional(params?: { periodo?: string; dataInicio?: string; dataFim?: string; rotaId?: string }): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/operacional', params as Record<string, any>);
  }

  /**
   * Relatório comparativo — comparação entre dois períodos
   */
  async getRelatorioComparativo(periodo1Inicio: string, periodo1Fim: string, periodo2Inicio: string, periodo2Fim: string, rotaId?: string): Promise<ApiResponse<any>> {
    const params: Record<string, string> = { periodo1Inicio, periodo1Fim, periodo2Inicio, periodo2Fim };
    if (rotaId) params.rotaId = rotaId;
    return this.get('/api/relatorios/comparativo', params);
  }

  /**
   * Relatório de locações
   */
  async getRelatorioLocacoes(params?: { periodo?: string; dataInicio?: string; dataFim?: string; rotaId?: string }): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/locacoes', params as Record<string, any>);
  }

  /**
   * Relatório de clientes
   */
  async getRelatorioClientes(params?: { periodo?: string; dataInicio?: string; dataFim?: string; rotaId?: string }): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/clientes', params as Record<string, any>);
  }

  /**
   * Relatório de relógios (histórico de troca)
   */
  async getRelatorioRelogios(params?: { periodo?: string; dataInicio?: string; dataFim?: string }): Promise<ApiResponse<any>> {
    return this.get('/api/relatorios/relogios', params as Record<string, any>);
  }

  /**
   * Exporta relatório em PDF, CSV ou XLSX
   * Retorna blob para download/share
   */
  async exportarRelatorio(tipo: string, formato: 'pdf' | 'csv' | 'xlsx', params?: { periodo?: string; dataInicio?: string; dataFim?: string; rotaId?: string }): Promise<ApiResponse<Blob>> {
    const queryParams: Record<string, string> = { formato, ...(params as Record<string, string> || {}) };
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `/api/relatorios/${tipo}/exportar?${queryString}`;

    // Use direct fetch for blob response
    const fullUrl = `${this.baseURL}${url}`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(fullUrl, { headers });
      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: text || `Erro HTTP ${response.status}`, statusCode: response.status };
      }
      const blob = await response.blob();
      return { success: true, data: blob, statusCode: response.status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erro ao exportar' };
    }
  }

  // ==========================================================================
  // BUSCA GLOBAL
  // ==========================================================================

  /**
   * Busca global em todas as entidades
   */
  async buscaGlobal(termo: string): Promise<ApiResponse<any>> {
    return this.get(`/api/busca-global?q=${encodeURIComponent(termo)}`);
  }

  // ==========================================================================
  // NOTIFICAÇÕES
  // ==========================================================================

  /**
   * Busca notificações do usuário logado
   */
  async getNotificacoes(): Promise<ApiResponse<any[]>> {
    return this.get('/api/notificacoes');
  }

  /**
   * Marca notificação como lida
   */
  async marcarNotificacaoLida(id: string): Promise<ApiResponse<any>> {
    return this.put(`/api/notificacoes/${id}`, { lida: true });
  }

  // ==========================================================================
  // AGENDA
  // ==========================================================================

  /**
   * Busca agenda de cobranças por data
   */
  async getAgenda(data?: string): Promise<ApiResponse<any>> {
    const query = data ? `?data=${data}` : '';
    return this.get(`/api/agenda${query}`);
  }

  // ==========================================================================
  // HISTÓRICO DE PAGAMENTOS
  // ==========================================================================

  /**
   * Busca histórico de pagamentos de uma cobrança
   */
  async getHistoricoPagamentos(cobrancaId: string): Promise<ApiResponse<any[]>> {
    return this.get(`/api/historico-pagamentos?cobrancaId=${cobrancaId}`);
  }

  // ==========================================================================
  // RECIBOS
  // ==========================================================================

  /**
   * Busca recibo completo de uma cobrança (A4)
   */
  async getRecibo(cobrancaId: string): Promise<ApiResponse<any>> {
    return this.get(`/api/cobrancas/${cobrancaId}/recibo`);
  }

  /**
   * Busca recibo térmico de uma cobrança (58mm)
   */
  async getReciboTermico(cobrancaId: string): Promise<ApiResponse<any>> {
    return this.get(`/api/cobrancas/${cobrancaId}/recibo-termico`);
  }

  // ==========================================================================
  // MAPA
  // ==========================================================================

  /**
   * Busca dados do mapa (clientes com coordenadas)
   */
  async getMapaData(): Promise<ApiResponse<any>> {
    return this.get('/api/mapa');
  }

  /**
   * Geocodifica um endereço
   */
  async geocodificar(endereco: string): Promise<ApiResponse<any>> {
    return this.get('/api/mapa/geocodificar', { endereco });
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
