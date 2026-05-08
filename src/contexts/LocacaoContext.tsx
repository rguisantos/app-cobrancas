/**
 * LocacaoContext.tsx
 * Contexto para gerenciamento de estado de Locações
 * Integração: Repositórios + Services + Tipos
 *
 * Enhanced with operacoes/isOperacao pattern like ClienteContext/ManutencaoContext
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Locacao, LocacaoListItem, StatusLocacao, FormaPagamentoLocacao } from '../types';
import { locacaoRepository } from '../repositories/LocacaoRepository';
import { produtoRepository } from '../repositories/ProdutoRepository';
import { manutencaoRepository } from '../repositories/ManutencaoRepository';
import { cobrancaService } from '../services/CobrancaService';
import { useDatabase } from './DatabaseContext';

// ============================================================================
// INTERFACES E TIPOS
// ============================================================================

export interface LocacaoState {
  locacoes: LocacaoListItem[];
  locacoesAtivas: LocacaoListItem[];
  locacaoSelecionada: Locacao | null;
  carregando: boolean;
  erro: string | null;
  totalLocacoes: number;
  totalAtivas: number;
  totalFinalizadas: number;
  /** Operation-specific loading flags */
  operacoes: Record<string, boolean>;
  /** Check if a specific operation is in progress */
  isOperacao: (nome: string) => boolean;
}

export interface LocacaoContextData extends LocacaoState {
  // Carregamento
  carregarLocacoes: (filtros?: any) => Promise<void>;
  carregarLocacoesPorCliente: (clienteId: string) => Promise<void>;
  carregarLocacoesPorProduto: (produtoId: string) => Promise<void>;
  
  // Seleção
  selecionarLocacao: (id: string) => Promise<void>;
  limparSelecao: () => void;
  
  // Ações de Negócio
  criarLocacao: (dados: NovaLocacaoData) => Promise<Locacao | null>;
  atualizarLocacao: (dados: Partial<Locacao> & { id: string }) => Promise<boolean>;
  finalizarLocacao: (id: string, motivo?: string) => Promise<boolean>;
  realizarRelocacao: (dados: RelocacaoData) => Promise<boolean>;
  enviarParaEstoque: (dados: EnviarEstoqueData) => Promise<boolean>;
  
  // Utilitários
  verificarProdutoLocado: (produtoId: string) => Promise<boolean>;
  getLocacaoAtivaPorProduto: (produtoId: string) => Promise<Locacao | null>;
  
  // Refresh
  atualizarLista: () => Promise<void>;
}

// ============================================================================
// TIPOS DAS FUNÇÕES DE NEGÓCIO
// ============================================================================

export interface NovaLocacaoData {
  clienteId: string;
  clienteNome: string;
  produtoId: string;
  produtoIdentificador: string;
  produtoTipo: string;
  dataLocacao: string;
  observacao?: string;
  formaPagamento: FormaPagamentoLocacao;
  numeroRelogio: string;
  precoFicha: number;
  percentualEmpresa: number;
  percentualCliente: number;
  periodicidade?: string;
  valorFixo?: number;
  dataPrimeiraCobranca?: string;
  trocaPano?: boolean;
  dataUltimaManutencao?: string;
}

export interface RelocacaoData {
  produtoId: string;
  produtoIdentificador: string;
  novoClienteId: string;
  novoClienteNome: string;
  dataRelocacao: string;
  formaPagamento: FormaPagamentoLocacao;
  numeroRelogio: string;
  precoFicha: number;
  percentualEmpresa: number;
  percentualCliente: number;
  periodicidade?: string;
  valorFixo?: number;
  dataPrimeiraCobranca?: string;
  motivoRelocacao: string;
  observacao?: string;
  trocaPano?: boolean;
  dataUltimaManutencao?: string;
}

export interface EnviarEstoqueData {
  locacaoId: string;
  produtoId: string;
  produtoIdentificador: string;
  clienteId: string;
  clienteNome: string;
  estabelecimento: string;
  motivo: string;
  observacao?: string;
}

// ============================================================================
// CRIAÇÃO DO CONTEXT
// ============================================================================

const LocacaoContext = createContext<LocacaoContextData | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface LocacaoProviderProps {
  children: ReactNode;
}

export function LocacaoProvider({ children }: LocacaoProviderProps) {
  // Aguardar banco estar pronto
  const { isReady } = useDatabase();
  
  // Estado
  const [locacoes, setLocacoes] = useState<LocacaoListItem[]>([]);
  const [locacoesAtivas, setLocacoesAtivas] = useState<LocacaoListItem[]>([]);
  const [locacaoSelecionada, setLocacaoSelecionada] = useState<Locacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Contagens
  const [totalLocacoes, setTotalLocacoes] = useState(0);
  const [totalAtivas, setTotalAtivas] = useState(0);
  const [totalFinalizadas, setTotalFinalizadas] = useState(0);

  // Operation-specific loading
  const [operacoes, setOperacoes] = useState<Record<string, boolean>>({});

  const isOperacao = useCallback((nome: string) => operacoes[nome] || false, [operacoes]);

  const setOperacao = useCallback((nome: string, ativa: boolean) => {
    setOperacoes(prev => ({ ...prev, [nome]: ativa }));
  }, []);

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================

  useEffect(() => {
    if (isReady) {
      carregarLocacoes();
    }
  }, [isReady]);

  // ==========================================================================
  // CARREGAMENTO DE DADOS
  // ==========================================================================

  const carregarLocacoes = useCallback(async (filtros?: any) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const lista = await locacaoRepository.getAll(filtros);
      setLocacoes(lista);

      // Filtrar ativas
      const ativas = lista.filter(l => l.status === 'Ativa');
      setLocacoesAtivas(ativas);

      // Atualizar contagens
      setTotalLocacoes(lista.length);
      setTotalAtivas(ativas.length);
      setTotalFinalizadas(lista.filter(l => l.status === 'Finalizada').length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar locações';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao carregar locações:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  const carregarLocacoesPorCliente = useCallback(async (clienteId: string) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const locacoesList = await locacaoRepository.getAll({ clienteId: String(clienteId) });
      setLocacoes(locacoesList);
      setLocacoesAtivas(locacoesList.filter(l => l.status === 'Ativa'));
      setTotalLocacoes(locacoesList.length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar locações do cliente';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao carregar locações do cliente:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  const carregarLocacoesPorProduto = useCallback(async (produtoId: string) => {
    setCarregando(true);
    setOperacao('carregar', true);
    setErro(null);

    try {
      const lista = await locacaoRepository.getByProduto(produtoId);
      
      const locacoesList: LocacaoListItem[] = lista.map(l => ({
        id: l.id,
        produtoIdentificador: l.produtoIdentificador,
        produtoTipo: l.produtoTipo,
        produtoDescricao: '',
        produtoTamanho: '',
        formaPagamento: l.formaPagamento,
        numeroRelogio: l.numeroRelogio,
        percentualEmpresa: l.percentualEmpresa,
        precoFicha: l.precoFicha,
        dataLocacao: l.dataLocacao,
        status: l.status,
      }));

      setLocacoes(locacoesList);
      setTotalLocacoes(locacoesList.length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar histórico do produto';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao carregar histórico do produto:', error);
    } finally {
      setCarregando(false);
      setOperacao('carregar', false);
    }
  }, [setOperacao]);

  // ==========================================================================
  // SELEÇÃO
  // ==========================================================================

  const selecionarLocacao = useCallback(async (id: string) => {
    setCarregando(true);
    setOperacao('selecionar', true);
    try {
      const locacao = await locacaoRepository.getById(id);
      setLocacaoSelecionada(locacao);
    } catch (error) {
      console.error('[LocacaoContext] Erro ao selecionar locação:', error);
    } finally {
      setCarregando(false);
      setOperacao('selecionar', false);
    }
  }, [setOperacao]);

  const limparSelecao = useCallback(() => {
    setLocacaoSelecionada(null);
  }, []);

  // ==========================================================================
  // AÇÕES DE NEGÓCIO
  // ==========================================================================

  const criarLocacao = useCallback(async (dados: NovaLocacaoData): Promise<Locacao | null> => {
    setCarregando(true);
    setOperacao('salvar', true);
    setErro(null);

    try {
      const produtoLocado = await verificarProdutoLocado(dados.produtoId);
      if (produtoLocado) {
        setErro('Produto já está locado para outro cliente');
        return null;
      }

      const novaLocacao = await locacaoRepository.criarNovaLocacao(dados);
      await carregarLocacoes();
      
      console.log('[LocacaoContext] Locação criada com sucesso:', novaLocacao?.id);
      return novaLocacao;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao criar locação';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao criar locação:', error);
      return null;
    } finally {
      setCarregando(false);
      setOperacao('salvar', false);
    }
  }, [carregarLocacoes, setOperacao]);

  const atualizarLocacao = useCallback(async (dados: Partial<Locacao> & { id: string }): Promise<boolean> => {
    setCarregando(true);
    setOperacao('atualizar', true);
    setErro(null);

    try {
      const locacao = await locacaoRepository.update(dados);
      if (locacao) {
        await carregarLocacoes();
        console.log('[LocacaoContext] Locação atualizada:', dados.id);
        return true;
      }
      return false;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao atualizar locação';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao atualizar locação:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('atualizar', false);
    }
  }, [carregarLocacoes, setOperacao]);

  const finalizarLocacao = useCallback(async (id: string, motivo?: string): Promise<boolean> => {
    setCarregando(true);
    setOperacao('finalizar', true);
    setErro(null);

    try {
      const locacao = await locacaoRepository.getById(id);
      const sucesso = await locacaoRepository.finalizarLocacao(id, motivo);
      
      if (sucesso) {
        if (locacao?.produtoId) {
          await produtoRepository.update({
            id: String(locacao.produtoId),
            estaLocado: false,
            locacaoAtual: undefined,
          } as any);
        }
        await carregarLocacoes();
        console.log('[LocacaoContext] Locação finalizada:', id);
        return true;
      }
      return false;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao finalizar locação';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao finalizar locação:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('finalizar', false);
    }
  }, [carregarLocacoes, produtoRepository, setOperacao]);

  const realizarRelocacao = useCallback(async (dados: RelocacaoData): Promise<boolean> => {
    setCarregando(true);
    setOperacao('relocacao', true);
    setErro(null);

    try {
      const resultado = await locacaoRepository.realizarRelocacao(dados);
      
      if (resultado.novaLocacao || resultado.locacaoAntigaFinalizada) {
        if (dados.trocaPano && resultado.novaLocacao?.produtoId) {
          try {
            const now = new Date().toISOString();
            await produtoRepository.update({
              id: String(resultado.novaLocacao.produtoId),
              dataUltimaManutencao: now,
              relatorioUltimaManutencao: 'Troca de pano na relocação',
            } as any);
            await manutencaoRepository.registrar({
              produtoId: String(resultado.novaLocacao.produtoId),
              produtoIdentificador: resultado.novaLocacao.produtoIdentificador,
              produtoTipo: resultado.novaLocacao.produtoTipo || '',
              clienteId: String(resultado.novaLocacao.clienteId),
              clienteNome: resultado.novaLocacao.clienteNome,
              locacaoId: String(resultado.novaLocacao.id),
              tipo: 'trocaPano',
              descricao: 'Troca de pano na relocação',
              data: now,
            });
          } catch (e) {
            console.warn('[LocacaoContext] Erro ao registrar manutenção na relocação:', e);
          }
        }
        await carregarLocacoes();
        console.log('[LocacaoContext] Relocação realizada:', dados.produtoId);
        return true;
      }
      return false;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao realizar relocação';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao realizar relocação:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('relocacao', false);
    }
  }, [carregarLocacoes, setOperacao]);

  const enviarParaEstoque = useCallback(async (dados: EnviarEstoqueData): Promise<boolean> => {
    setCarregando(true);
    setOperacao('enviarEstoque', true);
    setErro(null);

    try {
      const locacaoFinalizada = await finalizarLocacao(dados.locacaoId, dados.motivo);
      
      if (locacaoFinalizada) {
        await produtoRepository.enviarParaEstoque(
          dados.produtoId,
          dados.estabelecimento,
          dados.motivo
        );
        await carregarLocacoes();
        console.log('[LocacaoContext] Produto enviado para estoque:', dados.produtoId);
        return true;
      }
      return false;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao enviar para estoque';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao enviar para estoque:', error);
      return false;
    } finally {
      setCarregando(false);
      setOperacao('enviarEstoque', false);
    }
  }, [carregarLocacoes, finalizarLocacao, setOperacao]);

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  const verificarProdutoLocado = useCallback(async (produtoId: string): Promise<boolean> => {
    try {
      const locacao = await locacaoRepository.getAtivaByProduto(produtoId);
      return !!locacao;
    } catch (error) {
      console.error('[LocacaoContext] Erro ao verificar produto locado:', error);
      return false;
    }
  }, []);

  const getLocacaoAtivaPorProduto = useCallback(async (produtoId: string): Promise<Locacao | null> => {
    try {
      return await locacaoRepository.getAtivaByProduto(produtoId);
    } catch (error) {
      console.error('[LocacaoContext] Erro ao buscar locação ativa:', error);
      return null;
    }
  }, []);

  const atualizarLista = useCallback(async () => {
    await carregarLocacoes();
  }, [carregarLocacoes]);

  // ==========================================================================
  // ESTADO DO CONTEXT
  // ==========================================================================

  const contextValue: LocacaoContextData = {
    locacoes,
    locacoesAtivas,
    locacaoSelecionada,
    carregando,
    erro,
    totalLocacoes,
    totalAtivas,
    totalFinalizadas,
    operacoes,
    isOperacao,

    carregarLocacoes,
    carregarLocacoesPorCliente,
    carregarLocacoesPorProduto,

    selecionarLocacao,
    limparSelecao,

    criarLocacao,
    atualizarLocacao,
    finalizarLocacao,
    realizarRelocacao,
    enviarParaEstoque,

    verificarProdutoLocado,
    getLocacaoAtivaPorProduto,

    atualizarLista,
  };

  return (
    <LocacaoContext.Provider value={contextValue}>
      {children}
    </LocacaoContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO
// ============================================================================

export function useLocacao(): LocacaoContextData {
  const context = useContext(LocacaoContext);

  if (context === undefined) {
    throw new Error('useLocacao deve ser usado dentro de um LocacaoProvider');
  }

  return context;
}

export default LocacaoContext;
