/**
 * AtributosProdutoGerenciarScreen.tsx
 * Tela para gerenciar Tipos, Descrições e Tamanhos de Produto
 * Salva localmente usando AtributosRepository
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import atributosRepository, { AtributoItem } from '../repositories/AtributosRepository';

// Tipos
type TipoAtributo = 'tipo' | 'descricao' | 'tamanho';

export default function AtributosProdutoGerenciarScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  
  const [tipoAtivo, setTipoAtivo] = useState<TipoAtributo>('tipo');
  const [itens, setItens] = useState<AtributoItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoItem, setEditandoItem] = useState<AtributoItem | null>(null);
  const [nomeItem, setNomeItem] = useState('');
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = isAdmin() || user?.tipoPermissao === 'Administrador';

  // Carregar itens quando mudar o tipo
  useEffect(() => {
    carregarItens();
  }, [tipoAtivo]);

  const carregarItens = async () => {
    setCarregando(true);
    try {
      let lista: AtributoItem[];
      
      if (tipoAtivo === 'tipo') {
        lista = await atributosRepository.getTipos();
      } else if (tipoAtivo === 'descricao') {
        lista = await atributosRepository.getDescricoes();
      } else {
        lista = await atributosRepository.getTamanhos();
      }
      
      setItens(lista);
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      setItens([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleNovoItem = () => {
    setEditandoItem(null);
    setNomeItem('');
    setModalVisible(true);
  };

  const handleEditarItem = (item: AtributoItem) => {
    setEditandoItem(item);
    setNomeItem(item.nome);
    setModalVisible(true);
  };

  const handleSalvar = async () => {
    if (!nomeItem.trim()) {
      Alert.alert('Erro', 'Digite o nome');
      return;
    }

    // Verificar se nome já existe
    const existe = await atributosRepository.nomeExiste(
      tipoAtivo,
      nomeItem,
      editandoItem?.id
    );
    
    if (existe) {
      Alert.alert('Erro', 'Já existe um item com este nome');
      return;
    }

    setSalvando(true);
    try {
      if (editandoItem) {
        // Editar
        const sucesso = await atributosRepository.atualizar(
          tipoAtivo,
          editandoItem.id,
          nomeItem
        );
        
        if (sucesso) {
          Alert.alert('Sucesso', 'Item atualizado com sucesso');
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar');
        }
      } else {
        // Criar novo
        await atributosRepository.adicionar(tipoAtivo, nomeItem);
        Alert.alert('Sucesso', 'Item criado com sucesso');
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
  };

  const handleExcluir = (item: AtributoItem) => {
    Alert.alert(
      'Excluir Item',
      `Tem certeza que deseja excluir "${item.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await atributosRepository.remover(tipoAtivo, item.id);
              Alert.alert('Sucesso', 'Item excluído com sucesso');
              carregarItens();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir');
            }
          },
        },
      ]
    );
  };

  const getTituloTipo = () => {
    switch (tipoAtivo) {
      case 'tipo': return 'Tipos de Produto';
      case 'descricao': return 'Descrições de Produto';
      case 'tamanho': return 'Tamanhos de Produto';
    }
  };

  const getPlaceholder = () => {
    switch (tipoAtivo) {
      case 'tipo': return 'Ex: Bilhar, Jukebox, Mesa';
      case 'descricao': return 'Ex: Azul, Branco, Preto';
      case 'tamanho': return 'Ex: 2,00, Grande, Média';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Atributos de Produto</Text>
        {podeGerenciar && (
          <TouchableOpacity style={styles.addButton} onPress={handleNovoItem}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, tipoAtivo === 'tipo' && styles.tabActive]}
          onPress={() => setTipoAtivo('tipo')}
        >
          <Text style={[styles.tabText, tipoAtivo === 'tipo' && styles.tabTextActive]}>
            Tipos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tipoAtivo === 'descricao' && styles.tabActive]}
          onPress={() => setTipoAtivo('descricao')}
        >
          <Text style={[styles.tabText, tipoAtivo === 'descricao' && styles.tabTextActive]}>
            Descrições
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tipoAtivo === 'tamanho' && styles.tabActive]}
          onPress={() => setTipoAtivo('tamanho')}
        >
          <Text style={[styles.tabText, tipoAtivo === 'tamanho' && styles.tabTextActive]}>
            Tamanhos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{getTituloTipo()}</Text>
        
        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : itens.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="list-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Nenhum item cadastrado</Text>
            {podeGerenciar && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleNovoItem}>
                <Text style={styles.emptyButtonText}>Criar primeiro item</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          itens.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <View style={styles.itemIcon}>
                  <Ionicons 
                    name={
                      tipoAtivo === 'tipo' ? 'cube' : 
                      tipoAtivo === 'descricao' ? 'color-palette' : 
                      'resize'
                    } 
                    size={18} 
                    color="#2563EB" 
                  />
                </View>
                <Text style={styles.itemNome}>{item.nome}</Text>
              </View>
              
              {podeGerenciar && (
                <View style={styles.itemActions}>
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
          ))
        )}
      </ScrollView>

      {/* Modal de Edição */}
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
                {editandoItem ? 'Editar' : 'Novo'} {tipoAtivo === 'tipo' ? 'Tipo' : tipoAtivo === 'descricao' ? 'Descrição' : 'Tamanho'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                placeholder={getPlaceholder()}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#2563EB',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
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
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemNome: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
    marginLeft: 12,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
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
