/**
 * usePaginatedList.ts
 * Hook para paginação de listas com FlatList
 *
 * Implementa paginação cursor-based em memória com suporte a
 * load more e search local. Alinha com o padrão de paginação
 * do backend web.
 *
 * Uso:
 * const { data, loadMore, hasMore, isLoading, refresh } = usePaginatedList({
 *   fetchAll: () => clienteRepository.getAll(),
 *   pageSize: 20,
 *   searchFields: ['nomeExibicao', 'cpfCnpj'],
 * })
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface UsePaginatedListOptions<T> {
  /** Função que carrega todos os dados (do repository) */
  fetchAll: () => Promise<T[]>;
  /** Tamanho da página (default: 20) */
  pageSize?: number;
  /** Campos para busca textual */
  searchFields?: (keyof T)[];
  /** Termo de busca */
  searchTerm?: string;
  /** Filtros adicionais */
  filters?: Record<string, any>;
  /** Função de filtro customizada */
  filterFn?: (item: T) => boolean;
  /** Função de ordenação */
  sortFn?: (a: T, b: T) => number;
  /** Auto-carregar ao montar (default: true) */
  autoLoad?: boolean;
}

export interface UsePaginatedListReturn<T> {
  /** Dados da página atual */
  data: T[];
  /** Todos os dados carregados (para cálculos) */
  allData: T[];
  /** Total de registros */
  total: number;
  /** Se há mais dados para carregar */
  hasMore: boolean;
  /** Se está carregando dados */
  isLoading: boolean;
  /** Se está refreshing (pull-to-refresh) */
  isRefreshing: boolean;
  /** Página atual */
  currentPage: number;
  /** Total de páginas */
  totalPages: number;
  /** Carrega próxima página */
  loadMore: () => void;
  /** Refresh completo (recarrega do repository) */
  refresh: () => Promise<void>;
  /** Reseta paginação */
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePaginatedList<T extends Record<string, any>>(
  options: UsePaginatedListOptions<T>
): UsePaginatedListReturn<T> {
  const {
    fetchAll,
    pageSize = 20,
    searchFields = [],
    searchTerm = '',
    filters,
    filterFn,
    sortFn,
    autoLoad = true,
  } = options;

  const [allData, setAllData] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);

  // Filtra e ordena dados
  const filteredData = useMemo(() => {
    let result = [...allData];

    // Aplicar busca textual
    if (searchTerm && searchFields.length > 0) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }

    // Aplicar filtro customizado
    if (filterFn) {
      result = result.filter(filterFn);
    }

    // Aplicar ordenação
    if (sortFn) {
      result.sort(sortFn);
    }

    return result;
  }, [allData, searchTerm, searchFields, filterFn, sortFn]);

  // Dados paginados
  const paginatedData = useMemo(() => {
    const end = currentPage * pageSize;
    return filteredData.slice(0, end);
  }, [filteredData, currentPage, pageSize]);

  const total = filteredData.length;
  const totalPages = Math.ceil(total / pageSize);
  const hasMore = currentPage * pageSize < total;

  /**
   * Carrega todos os dados do repository
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAll();
      if (isMountedRef.current) {
        setAllData(data);
      }
    } catch (error) {
      console.error('[usePaginatedList] Erro ao carregar dados:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchAll]);

  /**
   * Carrega próxima página
   */
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore, isLoading]);

  /**
   * Refresh completo (pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setCurrentPage(1);
    try {
      await loadData();
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [loadData]);

  /**
   * Reseta paginação sem recarregar dados
   */
  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Auto-load ao montar
  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [autoLoad, loadData]);

  // Reset page quando searchTerm muda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  return {
    data: paginatedData,
    allData: filteredData,
    total,
    hasMore,
    isLoading,
    isRefreshing,
    currentPage,
    totalPages,
    loadMore,
    refresh,
    reset,
  };
}
