/**
 * ClientesListScreen.tsx
 * Lista de clientes com busca e filtros
 * 
 * Funcionalidades:
 * - Busca por nome, CPF, cidade
 * - Filtro por rota
 * - Pull-to-refresh
 * - Navegação para detalhes
 * - Botão de novo cliente (com permissão)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useCliente } from '../contexts/ClienteContext';

// Types
import { ClienteListItem } from '../types';
import { ClientesStackNavigationProp } from '../navigation/ClientesStack';

// Components
import { useClienteNavigate } from '../navigation/ClientesStack';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ClientesListScreen() {
  const navigation = useNavigation<ClientesStackNavigationProp>();
  const navigateCliente = useClienteNavigate();
  const { user, canAccessRota, hasPermission } = useAuth();
  const { clientes, carregando, erro, carregarClientes, refresh } = useCliente();

  // Estado local
  const [searchTerm, setSearchTerm] = useState('');  const [filtroRota, setFiltroRota] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      carregarClientes();
    }, [carregarClientes])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ==========================================================================
  // FILTRAGEM
  // ==========================================================================

  const clientesFiltrados = useCallback(() => {
    let filtrados = clientes;

    // Filtro por busca
    if (searchTerm.trim()) {
      const termo = searchTerm.toLowerCase();
      filtrados = filtrados.filter(
        c =>
          c.nomeExibicao.toLowerCase().includes(termo) ||
          c.cpfCnpj?.toLowerCase().includes(termo) ||
          c.cidade.toLowerCase().includes(termo)
      );
  
  }

    // Filtro por rota (respeita permissões)
    if (filtroRota) {
      filtrados = filtrados.filter(c => String(c.rotaId) === filtroRota);
  
  }

    // Filtro por permissão de rota
    if (user?.tipoPermissao !== 'Administrador') {
      filtrados = filtrados.filter(c => c.rotaId !== undefined && canAccessRota(c.rotaId));
  
  }

    return filtrados;
  }, [clientes, searchTerm, filtroRota, user, canAccessRota]);
  // ==========================================================================
  // RENDERIZACÃO DE ITENS
  // ==========================================================================

  const renderCliente = useCallback(({ item }: { item: ClienteListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigateCliente.toDetail(String(item.id), item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.nomeExibicao.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.nomeExibicao}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {item.cpfCnpj || 'CPF não informado'}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: item.status === 'Ativo' ? '#16A34A' : '#64748B' },
            ]}
          />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.cardInfo}>
          <Ionicons name="location-outline" size={14} color="#64748B" />
          <Text style={styles.cardInfoText} numberOfLines={1}>
            {item.cidade} - {item.estado}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Ionicons name="map-outline" size={14} color="#64748B" />
          <Text style={styles.cardInfoText} numberOfLines={1}>
            {item.rotaNome}
          </Text>
        </View>
      </View>
    </TouchableOpacity>  ), [navigateCliente]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhum cliente encontrado</Text>
      <Text style={styles.emptySubtitle}>
        {searchTerm ? 'Tente buscar por outro termo' : 'Cadastre seu primeiro cliente'}
      </Text>
    </View>
  ), [searchTerm]);

  const renderHeader = useCallback(() => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar nome, CPF, cidade..."
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

      <View style={styles.filtersRow}>
        <TouchableOpacity style={styles.filterChip}>
          <Ionicons name="filter" size={16} color="#2563EB" />
          <Text style={styles.filterChipText}>Filtrar por Rota</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterChip}>
          <Ionicons name="swap-vertical" size={16} color="#2563EB" />
          <Text style={styles.filterChipText}>Ordenar</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [searchTerm]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (carregando && clientes.length === 0) {
    return (      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando clientes...</Text>
      </View>
    );

  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clientes</Text>
        <Text style={styles.headerSubtitle}>
          {clientesFiltrados().length} cliente(s)
        </Text>
      </View>

      {/* Lista */}
      <FlatList
        data={clientesFiltrados()}
        renderItem={renderCliente}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          clientesFiltrados().length === 0 && styles.listEmpty,
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

      {/* Botão Novo Cliente (com permissão) */}
      {(user?.tipoPermissao === 'Administrador' || hasPermission('clientes', 'mobile')) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigateCliente.toForm('criar')}
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
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>Tentar novamente</Text>
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
    fontSize: 14,    color: '#64748B',
    marginTop: 4,
  },

  // Search
  searchContainer: {
    backgroundColor: '#FFFFFF',
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
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },

  // List
  listContent: {
    padding: 16,    gap: 12,
  },
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardContent: {
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
    marginTop: 2,
  },
  statusBadge: {    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cardInfoText: {
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
  },  emptySubtitle: {
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
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
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