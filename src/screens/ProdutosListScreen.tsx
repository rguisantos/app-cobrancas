/**
 * ProdutosListScreen.tsx
 * Lista de produtos com filtros e busca
 * 
 * Funcionalidades:
 * - Busca por identificador, tipo, descrição
 * - Filtros por tipo, status, situação (locado/disponível)
 * - Pull-to-refresh
 * - Navegação para detalhes
 * - Botão de novo produto (com permissão)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useProduto } from '../contexts/ProdutoContext';

// Types
import { ProdutoListItem, StatusProduto } from '../types';
import { ProdutosStackNavigationProp } from '../navigation/ProdutosStack';

// Components
import { useProdutoNavigate } from '../navigation/ProdutosStack';
import { PRODUTO_FILTROS } from '../navigation/ProdutosStack';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ProdutosListScreen() {
  const navigation = useNavigation<ProdutosStackNavigationProp>();
  const navigateProduto = useProdutoNavigate();
  const { user, hasPermission } = useAuth();
  const { produtos, carregando, erro, carregarProdutos, refresh } = useProduto();

  // Estado local
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusProduto | 'todos'>('todos');
  const [filtroLocacao, setFiltroLocacao] = useState<'todos' | 'locados' | 'disponiveis'>('todos');
  const [refreshing, setRefreshing] = useState(false);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      carregarProdutos();
    }, [carregarProdutos])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ==========================================================================
  // FILTRAGEM
  // ==========================================================================

  const produtosFiltrados = useCallback(() => {
    let filtrados = produtos;

    // Filtro por busca
    if (searchTerm.trim()) {
      const termo = searchTerm.toLowerCase();
      filtrados = filtrados.filter(
        p =>
          p.identificador.toLowerCase().includes(termo) ||
          p.tipoNome.toLowerCase().includes(termo) ||
          p.descricaoNome.toLowerCase().includes(termo)
      );
  
  }

    // Filtro por status
    if (filtroStatus !== 'todos') {
      filtrados = filtrados.filter(p => p.statusProduto === filtroStatus);
  
  }

    // Filtro por locação
    if (filtroLocacao === 'locados') {
      filtrados = filtrados.filter(p => p.clienteNome);
    } else if (filtroLocacao === 'disponiveis') {
      filtrados = filtrados.filter(p => !p.clienteNome && p.statusProduto === 'Ativo');
  
  }
    return filtrados;
  }, [produtos, searchTerm, filtroStatus, filtroLocacao]);

  // ==========================================================================
  // RENDERIZAÇÃO DE ITENS
  // ==========================================================================

  const renderProduto = useCallback(({ item }: { item: ProdutoListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigateProduto.toDetail(String(item.id))}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.produtoInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.tipoNome} N° {item.identificador}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.descricaoNome} • {item.tamanhoNome}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  item.statusProduto === 'Ativo'
                    ? item.clienteNome
                      ? '#9333EA' // Roxo para locado
                      : '#16A34A' // Verde para disponível
                    : '#64748B', // Cinza para inativo/manutenção
              },
            ]}
          />
          <Text style={styles.statusText}>
            {item.clienteNome ? 'Locado' : item.statusProduto}
          </Text>
        </View>
      </View>

      {item.clienteNome && (
        <View style={styles.clienteInfo}>
          <Ionicons name="person-outline" size={14} color="#64748B" />
          <Text style={styles.clienteNome} numberOfLines={1}>
            {item.clienteNome}
          </Text>
        </View>      )}
    </TouchableOpacity>
  ), [navigateProduto]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={64} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhum produto encontrado</Text>
      <Text style={styles.emptySubtitle}>
        {searchTerm || filtroStatus !== 'todos' || filtroLocacao !== undefined
          ? 'Tente ajustar os filtros'
          : 'Cadastre seu primeiro produto'}
      </Text>
    </View>
  ), [searchTerm, filtroStatus, filtroLocacao]);

  const renderHeader = useCallback(() => (
    <View style={styles.searchContainer}>
      {/* Busca */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar produto..."
          placeholderTextColor="#94A3B8"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons name="close-circle" size={20} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {/* Status */}
          {PRODUTO_FILTROS.STATUS.map((filtro) => (
            <TouchableOpacity
              key={filtro.value}
              style={[
                styles.filterChip,
                filtroStatus === filtro.value && styles.filterChipActive,
              ]}              onPress={() => setFiltroStatus(filtro.value as any)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtroStatus === filtro.value && styles.filterChipTextActive,
                ]}
              >
                {filtro.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Locação */}
          {PRODUTO_FILTROS.LOCACAO.map((filtro) => (
            <TouchableOpacity
              key={filtro.value}
              style={[
                styles.filterChip,
                filtroLocacao === filtro.value && styles.filterChipActive,
              ]}
              onPress={() => setFiltroLocacao(filtro.value as any)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtroLocacao === filtro.value && styles.filterChipTextActive,
                ]}
              >
                {filtro.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  ), [searchTerm, filtroStatus, filtroLocacao]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (carregando && produtos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando produtos...</Text>
      </View>
    );

  }
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Produtos</Text>
        <Text style={styles.headerSubtitle}>
          {produtosFiltrados().length} produto(s)
        </Text>
      </View>

      {/* Lista */}
      <FlatList
        data={produtosFiltrados()}
        renderItem={renderProduto}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          produtosFiltrados().length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
      
  }
        showsVerticalScrollIndicator={false}
      />

      {/* Botão Novo Produto (com permissão) */}
      {(user?.tipoPermissao === 'Administrador' || hasPermission('todosCadastros', 'mobile')) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigateProduto.toForm('criar')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Erro */}
      {erro && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={24} color="#DC2626" />
          <Text style={styles.errorText}>{erro}</Text>
          <TouchableOpacity onPress={refresh}>            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 16,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },

  // Search
  searchContainer: {    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  filtersRow: {
    flexDirection: 'row',
  },
  filtersScroll: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // List
  listContent: {
    padding: 16,
    gap: 12,  },
  listEmpty: {
    flexGrow: 1,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  produtoInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  clienteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  clienteNome: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Error
  errorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FEF2F2',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 14,
  },
  retryText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
});