/**
 * DashboardContext.tsx
 * Contexto para gerenciamento de dados do Dashboard
 * Integração: Repositórios + Services + Tipos
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
  DashboardMobileData, 
  DashboardMobileMetricas,
  DashboardWebData,
  DashboardWebGanhos,
  ClienteNaoCobrado,
  DashboardProdutosLocadosEstoque
} from '../types';
import { clienteRepository } from '../repositories/ClienteRepository';
import { produtoRepository } from '../repositories/ProdutoRepository';
import { locacaoRepository } from '../repositories/LocacaoRepository';
import { cobrancaRepository } from '../repositories/CobrancaRepository';
import { apiService } from '../services/ApiService';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface DashboardState {
  // Dados do Dashboard Mobile
  mobile: DashboardMobileData | null;
  
  // Dados do Dashboard Web
  web: DashboardWebData | null;
  
  // Estado
  carregando: boolean;
  erro: string | null;
  ultimaAtualizacao: string | null;
  
  // Métricas rápidas (para acesso direto)
  metricas: DashboardMobileMetricas | null;
}

export interface DashboardContextData extends DashboardState {
  // Carregamento
  carregarDashboard: (tipo: 'mobile' | 'web') => Promise<void>;
  carregarTodos: () => Promise<void>;
  
  // Atualização
  atualizarMetricas: () => Promise<void>;
  refresh: () => Promise<void>;
    // Dados específicos
  getClientesNaoCobrados: () => Promise<ClienteNaoCobrado[]>;
  getProdutosLocadosEstoque: () => Promise<DashboardProdutosLocadosEstoque>;
  getGanhosMes: () => Promise<DashboardWebGanhos>;
  
  // Utilitários
  limparDados: () => void;
  getResumoRapido: () => Promise<DashboardMobileMetricas>;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const DashboardContext = createContext<DashboardContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface DashboardProviderProps {
  children: ReactNode;
  usuarioNome?: string;
  usuarioTipo?: string;
}

export function DashboardProvider({ children, usuarioNome = 'Usuário', usuarioTipo = 'Administrador' }: DashboardProviderProps) {
  // Estado
  const [mobile, setMobile] = useState<DashboardMobileData | null>(null);
  const [web, setWeb] = useState<DashboardWebData | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<DashboardMobileMetricas | null>(null);

  // ==========================================================================
  // CÁLCULOS DE MÉTRICAS
  // ==========================================================================

  /**
   * Calcula métricas rápidas para dashboard mobile
   */
  const calcularMetricasMobile = useCallback(async (): Promise<DashboardMobileMetricas> => {
    try {
      const [
        totalClientes,
        totalProdutos,
        resumoLocacoes,
        cobrancasPendentes
      ] = await Promise.all([        clienteRepository.count({ status: 'Ativo' }),
        produtoRepository.count(),
        locacaoRepository.getResumo(),
        cobrancaRepository.getPendentes(),
      ]);

      const metricas: DashboardMobileMetricas = {
        totalClientes,
        totalProdutos,
        cobrancasPendentes: cobrancasPendentes.length,
        produtosLocados: resumoLocacoes.totalAtivas,
        produtosEstoque: resumoLocacoes.totalLocacoes - resumoLocacoes.totalAtivas,
      };

      return metricas;
    } catch (error) {
      console.error('[DashboardContext] Erro ao calcular métricas:', error);
      return {
        totalClientes: 0,
        cobrancasPendentes: 0,
        totalProdutos: 0,
      };
    }
  }, []);

  /**
   * Calcula ganhos do mês para dashboard web
   */
  const calcularGanhosMes = useCallback(async (): Promise<DashboardWebGanhos> => {
    try {
      const hoje = new Date();
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

      const resumo = await cobrancaRepository.getResumoFinanceiro(
        primeiroDia.toISOString(),
        ultimoDia.toISOString()
      );

      // Separar ganhos por tipo de cobrança
      // (Esta é uma simplificação - idealmente viria da API)
      const ganhoComPercentual = resumo.totalRecebido * 0.95; // 95% das cobranças são por %
      const ganhoComPeriodo = resumo.totalRecebido * 0.05; // 5% são por período

      return {
        ganhoAtualMes: resumo.totalRecebido,
        ganhoComPercentual: Math.round(ganhoComPercentual * 100) / 100,
        ganhoComPeriodo: Math.round(ganhoComPeriodo * 100) / 100,
      };
    } catch (error) {      console.error('[DashboardContext] Erro ao calcular ganhos:', error);
      return {
        ganhoAtualMes: 0,
        ganhoComPercentual: 0,
        ganhoComPeriodo: 0,
      };
    }
  }, []);

  /**
   * Busca clientes não cobrados há mais de 3 meses
   */
  const getClientesNaoCobrados = useCallback(async (): Promise<ClienteNaoCobrado[]> => {
    try {
      // Buscar todas as cobranças
      const cobranças = await cobrancaRepository.getAll({});
      
      // Agrupar por cliente e encontrar última cobrança
      const ultimaCobrancaPorCliente = new Map<string, any>();
      
      for (const cobranca of cobranças) {
        const clienteId = String(cobranca.clienteId);
        const existente = ultimaCobrancaPorCliente.get(clienteId);
        
        if (!existente || new Date(cobranca.dataInicio) > new Date(existente.dataInicio)) {
          ultimaCobrancaPorCliente.set(clienteId, cobranca);
        }
      }

      // Filtrar clientes com cobrança há mais de 90 dias
      const hoje = new Date();
      const clientesNaoCobrados: ClienteNaoCobrado[] = [];

      for (const [clienteId, cobranca] of ultimaCobrancaPorCliente.entries()) {
        const diasDesdeUltima = Math.floor(
          (hoje.getTime() - new Date(cobranca.dataInicio).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diasDesdeUltima > 90) {
          // Buscar dados do cliente
          const cliente = await clienteRepository.getById(clienteId);
          
          if (cliente) {
            clientesNaoCobrados.push({
              clienteId: cliente.id,
              clienteNome: cliente.nomeExibicao,
              ultimaDataPagamento: cobranca.dataPagamento || cobranca.dataInicio,
              rotaId: cliente.rotaId,
              rotaNome: cliente.rotaNome || '',
              diasAtraso: diasDesdeUltima,            });
          }
        }
      }

      // Ordenar por mais antigo
      return clientesNaoCobrados.sort((a, b) => b.diasAtraso - a.diasAtraso);
    } catch (error) {
      console.error('[DashboardContext] Erro ao buscar clientes não cobrados:', error);
      return [];
    }
  }, []);

  /**
   * Busca resumo de produtos locados vs estoque
   */
  const getProdutosLocadosEstoque = useCallback(async (): Promise<DashboardProdutosLocadosEstoque> => {
    try {
      const resumo = await produtoRepository.getResumo();
      
      return {
        totalLocados: resumo.totalLocados,
        totalEstoque: resumo.totalDisponiveis,
      };
    } catch (error) {
      console.error('[DashboardContext] Erro ao buscar produtos:', error);
      return {
        totalLocados: 0,
        totalEstoque: 0,
      };
    }
  }, []);

  // ==========================================================================
  // CARREGAMENTO DO DASHBOARD
  // ==========================================================================

  /**
   * Carrega dashboard mobile
   */
  const carregarDashboardMobile = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      // Tentar buscar da API primeiro
      const response = await apiService.getDashboardMobile();
      
      if (response.success && response.data) {
        setMobile(response.data);        setMetricas(response.data.metricas);
      } else {
        // Fallback: calcular localmente
        const metricasCalculadas = await calcularMetricasMobile();
        
        const dashboardMobile: DashboardMobileData = {
          usuarioNome,
          usuarioTipo,
          saudacao: getSaudacao(),
          metricas: metricasCalculadas,
          dataAtualizacao: new Date().toISOString(),
        };

        setMobile(dashboardMobile);
        setMetricas(metricasCalculadas);
      }

      setUltimaAtualizacao(new Date().toISOString());
      console.log('[DashboardContext] Dashboard mobile carregado');
    } catch (error) {
      // Fallback para cálculo local em caso de erro
      const metricasCalculadas = await calcularMetricasMobile();
      
      const dashboardMobile: DashboardMobileData = {
        usuarioNome,
        usuarioTipo,
        saudacao: getSaudacao(),
        metricas: metricasCalculadas,
        dataAtualizacao: new Date().toISOString(),
      };

      setMobile(dashboardMobile);
      setMetricas(metricasCalculadas);
      
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar dashboard';
      setErro(mensagem);
      console.error('[DashboardContext] Erro ao carregar dashboard mobile:', error);
    } finally {
      setCarregando(false);
    }
  }, [usuarioNome, usuarioTipo, calcularMetricasMobile]);

  /**
   * Carrega dashboard web
   */
  const carregarDashboardWeb = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {      // Tentar buscar da API primeiro
      const response = await apiService.getDashboardWeb();
      
      if (response.success && response.data) {
        setWeb(response.data);
      } else {
        // Fallback: calcular localmente
        const [ganhos, clientesNaoCobrados, produtosLocadosEstoque] = await Promise.all([
          calcularGanhosMes(),
          getClientesNaoCobrados(),
          getProdutosLocadosEstoque(),
        ]);

        const hoje = new Date();
        const dashboardWeb: DashboardWebData = {
          ganhos,
          clientesNaoCobrados,
          totalClientesNaoCobrados: clientesNaoCobrados.length,
          produtosLocadosEstoque,
          dataReferencia: hoje.toISOString(),
          mesReferencia: formatarMesReferencia(hoje),
        };

        setWeb(dashboardWeb);
      }

      setUltimaAtualizacao(new Date().toISOString());
      console.log('[DashboardContext] Dashboard web carregado');
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar dashboard web';
      setErro(mensagem);
      console.error('[DashboardContext] Erro ao carregar dashboard web:', error);
    } finally {
      setCarregando(false);
    }
  }, [calcularGanhosMes, getClientesNaoCobrados, getProdutosLocadosEstoque]);

  /**
   * Carrega dashboard (mobile ou web)
   */
  const carregarDashboard = useCallback(async (tipo: 'mobile' | 'web') => {
    if (tipo === 'mobile') {
      await carregarDashboardMobile();
    } else {
      await carregarDashboardWeb();
    }
  }, [carregarDashboardMobile, carregarDashboardWeb]);

  /**
   * Carrega todos os dashboards   */
  const carregarTodos = useCallback(async () => {
    await Promise.all([
      carregarDashboardMobile(),
      carregarDashboardWeb(),
    ]);
  }, [carregarDashboardMobile, carregarDashboardWeb]);

  // ==========================================================================
  // ATUALIZAÇÃO E REFRESH
  // ==========================================================================

  /**
   * Atualiza apenas as métricas (mais rápido)
   */
  const atualizarMetricas = useCallback(async () => {
    try {
      const metricasCalculadas = await calcularMetricasMobile();
      setMetricas(metricasCalculadas);
      
      if (mobile) {
        setMobile({
          ...mobile,
          metricas: metricasCalculadas,
          dataAtualizacao: new Date().toISOString(),
        });
      }
      
      console.log('[DashboardContext] Métricas atualizadas');
    } catch (error) {
      console.error('[DashboardContext] Erro ao atualizar métricas:', error);
    }
  }, [mobile, calcularMetricasMobile]);

  /**
   * Refresh completo do dashboard
   */
  const refresh = useCallback(async () => {
    await carregarTodos();
  }, [carregarTodos]);

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  /**
   * Limpa todos os dados do dashboard
   */
  const limparDados = useCallback(() => {
    setMobile(null);    setWeb(null);
    setMetricas(null);
    setUltimaAtualizacao(null);
    setErro(null);
  }, []);

  /**
   * Busca resumo rápido de métricas
   */
  const getResumoRapido = useCallback(async (): Promise<DashboardMobileMetricas> => {
    return await calcularMetricasMobile();
  }, [calcularMetricasMobile]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Carregar dashboard mobile ao montar
  useEffect(() => {
    carregarDashboardMobile();
  }, [carregarDashboardMobile]);

  // ==========================================================================
  // ESTADO DO CONTEXT
  // ==========================================================================

  const contextValue: DashboardContextData = {
    // Estado
    mobile,
    web,
    carregando,
    erro,
    ultimaAtualizacao,
    metricas,

    // Carregamento
    carregarDashboard,
    carregarTodos,

    // Atualização
    atualizarMetricas,
    refresh,

    // Dados específicos
    getClientesNaoCobrados,
    getProdutosLocadosEstoque,
    getGanhosMes: calcularGanhosMes,

    // Utilitários
    limparDados,    getResumoRapido,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useDashboard(): DashboardContextData {
  const context = useContext(DashboardContext);

  if (context === undefined) {
    throw new Error('useDashboard deve ser usado dentro de um DashboardProvider');
  }

  return context;
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

function getSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarMesReferencia(data: Date): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${meses[data.getMonth()]}/${data.getFullYear()}`;
}

// ============================================================================
// EXPORTAÇÃO PADRÃO
// ============================================================================

export default DashboardContext;