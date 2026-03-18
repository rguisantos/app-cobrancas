/**
 * LocacaoContext.tsx
 * Contexto para gerenciamento de estado de Locações
 * Integração: Repositórios + Services + Tipos
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Locacao, LocacaoListItem, StatusLocacao, FormaPagamentoLocacao } from '../types';
import { locacaoRepository } from '../repositories/LocacaoRepository';
import { produtoRepository } from '../repositories/ProdutoRepository';
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
  atualizarLista: () => Promise<void>;}

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
}

export interface EnviarEstoqueData {
  locacaoId: string;
  produtoId: string;
  produtoIdentificador: string;
  clienteId: string;
  clienteNome: string;
  estabelecimento: string;
  motivo: string;  observacao?: string;
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

  // ==========================================================================
  // INICIALIZAÇÃO - Aguardar banco estar pronto
  // ==========================================================================

  useEffect(() => {
    if (isReady) {
      carregarLocacoes();
    }
  }, [isReady]);

  // ==========================================================================
  // CARREGAMENTO DE DADOS
  // ==========================================================================

  /**
   * Carrega todas as locações (com filtros opcionais)
   */
  const carregarLocacoes = async (filtros?: any) => {
    setCarregando(true);
    setErro(null);

    try {
      const lista = await locacaoRepository.getAll(filtros);
      setLocacoes(lista);

      // Filtrar ativas
      const ativas = lista.filter(l => l.status === 'Ativa');
      setLocacoesAtivas(ativas);

      // Atualizar contagens      setTotalLocacoes(lista.length);
      setTotalAtivas(ativas.length);
      setTotalFinalizadas(lista.filter(l => l.status === 'Finalizada').length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar locações';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao carregar locações:', error);
    } finally {
      setCarregando(false);
  
  }
  };

  /**
   * Carrega locações de um cliente específico
   */
  const carregarLocacoesPorCliente = async (clienteId: string) => {
    setCarregando(true);
    setErro(null);

    try {
      const lista = await locacaoRepository.getByCliente(clienteId);
      
      // Converter para LocacaoListItem
      const locacoesList: LocacaoListItem[] = lista.map(l => ({
        id: l.id,
        produtoIdentificador: l.produtoIdentificador,
        produtoTipo: l.produtoTipo || '',
        produtoDescricao: '',
        produtoTamanho: '',
        formaPagamento: l.formaPagamento,
        numeroRelogio: '',
        percentualEmpresa: l.percentualEmpresa,
        precoFicha: l.precoFicha,
        dataLocacao: l.dataLocacao,
        status: l.status,
      }));

      setLocacoes(locacoesList);
      setLocacoesAtivas(locacoesList.filter(l => l.status === 'Ativa'));
      setTotalLocacoes(locacoesList.length);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar locações do cliente';
      setErro(mensagem);
      console.error('[LocacaoContext] Erro ao carregar locações do cliente:', error);
    } finally {
      setCarregando(false);
  
  }
  };

  /**   * Carrega histórico de locações de um produto
   */
  const carregarLocacoesPorProduto = async (produtoId: string) => {
    setCarregando(true);
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
  
  }
  };

  // ==========================================================================
  // SELEÇÃO
  // ==========================================================================

  /**
   * Seleciona uma locação para visualização/edição
   */
  const selecionarLocacao = async (id: string) => {
    setCarregando(true);
    try {
      const locacao = await locacaoRepository.getById(id);
      setLocacaoSelecionada(locacao);
    } catch (error) {
      console.error('[LocacaoContext] Erro ao selecionar locação:', error);
    } finally {
      setCarregando(false);  
  }
  };

  /**
   * Limpa a locação selecionada
   */
  const limparSelecao = () => {
    setLocacaoSelecionada(null);
  };

  // ==========================================================================
  // AÇÕES DE NEGÓCIO
  // ==========================================================================

  /**
   * Cria nova locação
   */
  const criarLocacao = async (dados: NovaLocacaoData): Promise<Locacao | null> => {
    setCarregando(true);
    setErro(null);

    try {
      // Verificar se produto já está locado
      const produtoLocado = await verificarProdutoLocado(dados.produtoId);
      if (produtoLocado) {
        setErro('Produto já está locado para outro cliente');
        return null;
    
  }

      const novaLocacao = await locacaoRepository.criarNovaLocacao(dados);
      
      // Atualizar lista
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
  
  }
  };

  /**
   * Atualiza locação existente
   */
  const atualizarLocacao = async (dados: Partial<Locacao> & { id: string }): Promise<boolean> => {    setCarregando(true);
    setErro(null);

    try {
      const locacao = await locacaoRepository.update(dados);
      
      if (locacao) {
        // Atualizar lista
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
  
  }
  };

  /**
   * Finaliza locação
   */
  const finalizarLocacao = async (id: string, motivo?: string): Promise<boolean> => {
    setCarregando(true);
    setErro(null);

    try {
      const sucesso = await locacaoRepository.finalizarLocacao(id, motivo);
      
      if (sucesso) {
        // Atualizar lista
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
    }  };

  /**
   * Realiza relocação de produto (muda de cliente)
   */
  const realizarRelocacao = async (dados: RelocacaoData): Promise<boolean> => {
    setCarregando(true);
    setErro(null);

    try {
      const resultado = await locacaoRepository.realizarRelocacao(dados);
      
      if (resultado.novaLocacao || resultado.locacaoAntigaFinalizada) {
        // Atualizar lista
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
  
  }
  };

  /**
   * Envia produto para estoque (desvincula do cliente)
   */
  const enviarParaEstoque = async (dados: EnviarEstoqueData): Promise<boolean> => {
    setCarregando(true);
    setErro(null);

    try {
      // Finalizar locação
      const locacaoFinalizada = await finalizarLocacao(dados.locacaoId, dados.motivo);
      
      if (locacaoFinalizada) {
        // Atualizar produto para estoque
        await produtoRepository.enviarParaEstoque(
          dados.produtoId,
          dados.estabelecimento,
          dados.motivo
        );
        
        // Atualizar lista        await carregarLocacoes();
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
  
  }
  };

  // ==========================================================================
  // UTILITÁRIOS
  // ==========================================================================

  /**
   * Verifica se produto está locado
   */
  const verificarProdutoLocado = async (produtoId: string): Promise<boolean> => {
    try {
      const locacao = await locacaoRepository.getAtivaByProduto(produtoId);
      return !!locacao;
    } catch (error) {
      console.error('[LocacaoContext] Erro ao verificar produto locado:', error);
      return false;
  
  }
  };

  /**
   * Busca locação ativa por produto
   */
  const getLocacaoAtivaPorProduto = async (produtoId: string): Promise<Locacao | null> => {
    try {
      return await locacaoRepository.getAtivaByProduto(produtoId);
    } catch (error) {
      console.error('[LocacaoContext] Erro ao buscar locação ativa:', error);
      return null;
  
  }
  };

  /**
   * Atualiza a lista de locações
   */
  const atualizarLista = async () => {
    await carregarLocacoes();  };

  // ==========================================================================
  // ESTADO DO CONTEXT
  // ==========================================================================

  const contextValue: LocacaoContextData = {
    // Estado
    locacoes,
    locacoesAtivas,
    locacaoSelecionada,
    carregando,
    erro,
    totalLocacoes,
    totalAtivas,
    totalFinalizadas,

    // Carregamento
    carregarLocacoes,
    carregarLocacoesPorCliente,
    carregarLocacoesPorProduto,

    // Seleção
    selecionarLocacao,
    limparSelecao,

    // Ações de Negócio
    criarLocacao,
    atualizarLocacao,
    finalizarLocacao,
    realizarRelocacao,
    enviarParaEstoque,

    // Utilitários
    verificarProdutoLocado,
    getLocacaoAtivaPorProduto,

    // Refresh
    atualizarLista,
  };

  return (
    <LocacaoContext.Provider value={contextValue}>
      {children}
    </LocacaoContext.Provider>
  );
}

// ============================================================================
// HOOK PERSONALIZADO// ============================================================================

export function useLocacao(): LocacaoContextData {
  const context = useContext(LocacaoContext);

  if (context === undefined) {
    throw new Error('useLocacao deve ser usado dentro de um LocacaoProvider');

  }

  return context;
}

// ============================================================================
// EXPORTAÇÃO PADRÃO
// ============================================================================

export default LocacaoContext;