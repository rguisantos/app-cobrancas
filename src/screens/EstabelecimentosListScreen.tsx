/**
 * EstabelecimentosListScreen.tsx
 * Tela de CRUD de Estabelecimentos (locais de armazenamento)
 *
 * Funcionalidades:
 * - Lista estabelecimentos via atributosRepository
 * - Card com nome do estabelecimento
 * - FAB para criar novo
 * - Long-press para editar (Alert.prompt para renomear)
 * - Swipe-to-delete (soft delete via atributosRepository)
 * - Permission guard: manutencoes
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Repository
import atributosRepository, { AtributoItem } from '../repositories/AtributosRepository';

// Hooks
import { usePermissionGuard } from '../hooks/usePermissionGuard';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function EstabelecimentosListScreen() {
  const navigation = useNavigation();
  const { canDo } = usePermissionGuard();

  const [estabelecimentos, setEstabelecimentos] = useState<AtributoItem[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoItem, setEditandoItem] = useState<AtributoItem | null>(null);
  const [nomeItem, setNomeItem] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Permissões
  const podeGerenciar = canDo('manutencoes');

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const carregarItens = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await atributosRepository.getEstabelecimentos();
      setEstabelecimentos(lista);
    } catch (error) {
      console.error('Erro ao carregar estabelecimentos:', error);
      setEstabelecimentos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarItens();
    }, [carregarItens])
  );

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleNovoItem = useCallback(() => {
    // Navigate to full-screen form
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate('EstabelecimentoForm', { modo: 'criar' });
    }
  }, [navigation]);

  const handleEditarItem = useCallback((item: AtributoItem) => {
    // Navigate to full-screen form with existing data
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate('EstabelecimentoForm', {
        modo: 'editar',
        estabelecimentoId: item.id,
        estabelecimentoNome: item.nome,
        estabelecimentoEndereco: (item as any).endereco || '',
        estabelecimentoObservacao: (item as any).observacao || '',
      });
    }
  }, [navigation]);

  const handleSalvar = useCallback(async () => {
    if (!nomeItem.trim()) {
      Alert.alert('Erro', 'Digite o nome do estabelecimento');
      return;
    }

    // Verificar duplicidade
    const existe = await atributosRepository.nomeExiste(
      'estabelecimento',
      nomeItem,
      editandoItem?.id
    );

    if (existe) {
      Alert.alert('Erro', 'Já existe um estabelecimento com este nome');
      return;
    }

    setSalvando(true);
    try {
      if (editandoItem) {
        // Editar
        const sucesso = await atributosRepository.atualizar(
          'estabelecimento',
          editandoItem.id,
          nomeItem
        );

        if (sucesso) {
          Alert.alert('Sucesso', 'Estabelecimento atualizado');
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar');
        }
      } else {
        // Criar novo
        await atributosRepository.adicionar('estabelecimento', nomeItem);
        Alert.alert('Sucesso', 'Estabelecimento criado');
      }

      setModalVisible(false);
      setNomeItem('');
      setEditandoItem(null);
      carregarItens();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  }, [nomeItem, editandoItem, carregarItens]);

  const handleExcluir = useCallback((item: AtributoItem) => {
    Alert.alert(
      'Excluir Estabelecimento',
      `Tem certeza que deseja excluir "${item.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await atributosRepository.deleteEstabelecimento(item.id);
              Alert.alert('Sucesso', 'Estabelecimento excluído');
              carregarItens();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir');
            }
          },
        },
      ]
    );
  }, [carregarItens]);

  const handleLongPress = useCallback((item: AtributoItem) => {
    Alert.alert(
      item.nome,
      'Escolha uma ação',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Editar',
          onPress: () => handleEditarItem(item),
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => handleExcluir(item),
        },
      ]
    );
  }, [handleEditarItem, handleExcluir]);

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================

  const renderItem = useCallback(({ item }: { item: AtributoItem }) => (
    <TouchableOpacity
      style={styles.card}
      onLongPress={() => handleLongPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardIcon}>
          <Ionicons name="home" size={18} color="#2563EB" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardNome} numberOfLines={1}>
            {item.nome}
          </Text>
        </View>
        {podeGerenciar && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditarItem(item)}
            >
              <Ionicons name="pencil" size={18} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleExcluir(item)}
            >
              <Ionicons name="trash" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  ), [handleLongPress, handleEditarItem, handleExcluir, podeGerenciar]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="home-outline" size={64} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>Nenhum estabelecimento</Text>
      <Text style={styles.emptySubtitle}>
        Cadastre o primeiro local de armazenamento
      </Text>
      {podeGerenciar && (
        <TouchableOpacity style={styles.emptyButton} onPress={handleNovoItem}>
          <Text style={styles.emptyButtonText}>Criar Estabelecimento</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [podeGerenciar, handleNovoItem]);

  // ==========================================================================
  // LOADING
  // ==========================================================================

  if (carregando && estabelecimentos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Estabelecimentos</Text>
        <Text style={styles.headerCount}>
          {estabelecimentos.length}
        </Text>
      </View>

      {/* Lista */}
      <FlatList
        data={estabelecimentos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          estabelecimentos.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={carregando}
            onRefresh={carregarItens}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB Novo */}
      {podeGerenciar && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleNovoItem}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Modal de Edição/Criação */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editandoItem ? 'Editar' : 'Novo'} Estabelecimento
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Barracão Principal, Depósito Centro"
                placeholderTextColor="#94A3B8"
                value={nomeItem}
                onChangeText={setNomeItem}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, salvando && styles.buttonDisabled]}
                onPress={handleSalvar}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  headerCount: {
    fontSize: 14,
    color: '#64748B',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    margin: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalContent: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1E293B',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
