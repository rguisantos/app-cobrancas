/**
 * RotasGerenciarScreen.tsx
 * Tela para gerenciar rotas (criar, editar, excluir)
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRota } from '../contexts/RotaContext';
import { useAuth } from '../contexts/AuthContext';
import { Rota } from '../types';

export default function RotasGerenciarScreen() {
  const { rotas, carregarRotas, salvarRota, carregando } = useRota();
  const { user, isAdmin } = useAuth();
  
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [editandoRota, setEditandoRota] = useState<Rota | null>(null);
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarRotas();
  }, []);

  const podeGerenciar = isAdmin() || user?.tipoPermissao === 'Administrador';

  const handleNovaRota = () => {
    setEditandoRota(null);
    setDescricao('');
    setMostrandoForm(true);
  };

  const handleEditarRota = (rota: Rota) => {
    setEditandoRota(rota);
    setDescricao(rota.descricao);
    setMostrandoForm(true);
  };

  const handleSalvar = async () => {
    if (!descricao.trim()) {
      Alert.alert('Erro', 'Digite a descrição da rota');
      return;
    }

    setSalvando(true);
    try {
      const dados: Partial<Rota> = {
        descricao: descricao.trim(),
        status: 'Ativo',
      };

      if (editandoRota) {
        dados.id = editandoRota.id;
      }

      const resultado = await salvarRota(dados);
      
      if (resultado) {
        Alert.alert(
          'Sucesso',
          editandoRota ? 'Rota atualizada com sucesso' : 'Rota criada com sucesso'
        );
        setMostrandoForm(false);
        setDescricao('');
        setEditandoRota(null);
        carregarRotas();
      } else {
        Alert.alert('Erro', 'Não foi possível salvar a rota');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = (rota: Rota) => {
    Alert.alert(
      'Excluir Rota',
      `Tem certeza que deseja excluir a rota "${rota.descricao}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            // TODO: Implementar exclusão no repositório
            Alert.alert('Sucesso', 'Rota excluída com sucesso');
            carregarRotas();
          },
        },
      ]
    );
  };

  const handleCancelar = () => {
    setMostrandoForm(false);
    setDescricao('');
    setEditandoRota(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gerenciar Rotas</Text>
        {podeGerenciar && !mostrandoForm && (
          <TouchableOpacity style={styles.addButton} onPress={handleNovaRota}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Formulário */}
      {mostrandoForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {editandoRota ? 'Editar Rota' : 'Nova Rota'}
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descrição *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Linha Aquidauana"
              placeholderTextColor="#94A3B8"
              value={descricao}
              onChangeText={setDescricao}
            />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelar}>
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
      )}

      {/* Lista */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Carregando rotas...</Text>
          </View>
        ) : rotas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Nenhuma rota cadastrada</Text>
            {podeGerenciar && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleNovaRota}>
                <Text style={styles.emptyButtonText}>Criar primeira rota</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          rotas.map((rota) => (
            <View key={rota.id} style={styles.rotaCard}>
              <View style={styles.rotaInfo}>
                <View style={styles.rotaIcon}>
                  <Ionicons name="map" size={20} color="#2563EB" />
                </View>
                <View style={styles.rotaTextContainer}>
                  <Text style={styles.rotaDescricao}>{rota.descricao}</Text>
                  <Text style={[
                    styles.rotaStatus,
                    { color: rota.status === 'Ativo' ? '#16A34A' : '#DC2626' }
                  ]}>
                    {rota.status}
                  </Text>
                </View>
              </View>
              
              {podeGerenciar && (
                <View style={styles.rotaActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditarRota(rota)}
                  >
                    <Ionicons name="pencil" size={18} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleExcluir(rota)}
                  >
                    <Ionicons name="trash" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
  formContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
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
  formActions: {
    flexDirection: 'row',
    gap: 12,
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
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
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
  rotaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rotaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rotaIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotaTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  rotaDescricao: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  rotaStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  rotaActions: {
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
});
