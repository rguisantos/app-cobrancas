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
  SyncConflict
} from '../types';

// ============================================================================
// CONFIGURAÇÃO DA API
// ============================================================================

const API_CONFIG = {
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://api.diamondsistemas.com.br',
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
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Configurar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Adicionar token se existir
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
  
  }

    // Criar AbortController para esta requisição
    this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: this.abortController.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,          error: data.message || `Erro ${response.status}`,
          statusCode: response.status,
        };
    
  }

      return {
        success: true,
        data: data as T,
        statusCode: response.status,
      };
    } catch (error) {
      // Verificar se foi cancelado
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Requisição cancelada',
        };
    
  }

      // Erro de rede
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
  // SINCRONIZAÇÃO
  // ==========================================================================

  /**
   * Envia mudanças locais para o servidor (PUSH)
   */
  async pushChanges(payload: PushChangesRequest): Promise<SyncResponse> {
    const response = await this.post<SyncResponse>('/api/sync/push', payload);

    if (!response.success) {
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

    return response.data!;

  }

  /**   * Busca mudanças do servidor (PULL)
   */
  async pullChanges(payload: PullChangesRequest): Promise<SyncResponse> {
    const response = await this.post<SyncResponse>('/api/sync/pull', payload);

    if (!response.success) {
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

    return response.data!;

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
   * Registra novo equipamento no servidor
   */
  async registrarEquipamento(dados: RegistrarEquipamentoRequest): Promise<ApiResponse<{ success: boolean; id: string }>> {
    return this.post('/api/equipamentos', dados);

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
    return this.get('/api/locativas/ativas');

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
   */
  async login(email: string, senha: string): Promise<ApiResponse<{ token: string; usuario: any }>> {
    return this.post('/api/auth/login', { email, senha });

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