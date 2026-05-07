/**
 * UsuariosGerenciarScreen.tsx
 * Tela para gerenciar usuários (criar, editar, excluir)
 */

import React, { useState, useCallback } from 'react';
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation , useFocusEffect} from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { usuarioRepository } from '../repositories/UsuarioRepository';
import { TipoPermissaoUsuario, PermissoesUsuario, Usuario } from '../types';
import bcrypt from 'bcryptjs';

// Permissões padrão por tipo — usando PermissoesMobile/PermissoesWeb corretas
const PERMISSOES_PADRAO: Record<TipoPermissaoUsuario, PermissoesUsuario> = {
  Administrador: {
    web: {
      clientes: true, produtos: true, rotas: true,
      locacaoRelocacaoEstoque: true, cobrancas: true, manutencoes: true, relogios: true,
      relatorios: true, dashboard: true, agenda: true, mapa: true,
      adminCadastros: true, adminUsuarios: true, adminDispositivos: true, adminSincronizacao: true, adminAuditoria: true,
    },
    mobile: {
      clientes: true, produtos: true,
      alteracaoRelogio: true, locacaoRelocacaoEstoque: true, cobrancasFaturas: true, manutencoes: true,
      relatorios: true, sincronizacao: true,
    },
  },
  Secretario: {
    web: {
      clientes: true, produtos: true, rotas: true,
      locacaoRelocacaoEstoque: true, cobrancas: true, manutencoes: true, relogios: true,
      relatorios: true, dashboard: true, agenda: true, mapa: true,
      adminCadastros: false, adminUsuarios: false, adminDispositivos: false, adminSincronizacao: false, adminAuditoria: false,
    },
    mobile: {
      clientes: true, produtos: true,
      alteracaoRelogio: false, locacaoRelocacaoEstoque: true, cobrancasFaturas: true, manutencoes: true,
      relatorios: true, sincronizacao: true,
    },
  },
  'AcessoControlado': {
    web: {
      clientes: false, produtos: false, rotas: false,
      locacaoRelocacaoEstoque: false, cobrancas: false, manutencoes: false, relogios: false,
      relatorios: false, dashboard: true, agenda: false, mapa: false,
      adminCadastros: false, adminUsuarios: false, adminDispositivos: false, adminSincronizacao: false, adminAuditoria: false,
    },
    mobile: {
      clientes: false, produtos: false,
      alteracaoRelogio: false, locacaoRelocacaoEstoque: false, cobrancasFaturas: true, manutencoes: false,
      relatorios: false, sincronizacao: true,
    },
  },
};

interface UsuarioFormData {
  id: string;
  nome: string;
  email: string;
  senha: string;
  cpf: string;
  telefone: string;
  tipoPermissao: TipoPermissaoUsuario;
  status: 'Ativo' | 'Inativo';
}

export default function UsuariosGerenciarScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  const [formData, setFormData] = useState<UsuarioFormData>({
    id: '',
    nome: '',
    email: '',
    senha: '',
    cpf: '',
    telefone: '',
    tipoPermissao: 'AcessoControlado',
    status: 'Ativo',
  });

  const podeGerenciar = isAdmin() || user?.tipoPermissao === 'Administrador';

  const carregarUsuarios = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await usuarioRepository.getAll();
      setUsuarios(lista);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setUsuarios([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarUsuarios();
    }, [carregarUsuarios])
  );

  const handleNovoUsuario = () => {
    setEditandoUsuario(null);
    setFormData({
      id: `usr_${Date.now()}`,
      nome: '',
      email: '',
      senha: '',
      cpf: '',
      telefone: '',
      tipoPermissao: 'AcessoControlado',
      status: 'Ativo',
    });
    setModalVisible(true);
  };

  const handleEditarUsuario = (usuario: Usuario) => {
    setEditandoUsuario(usuario);
    setFormData({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      senha: '',
      cpf: usuario.cpf || '',
      telefone: usuario.telefone || '',
      tipoPermissao: usuario.tipoPermissao,
      status: usuario.status,
    });
    setModalVisible(true);
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      Alert.alert('Erro', 'Digite o nome do usuário');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Erro', 'Digite o email do usuário');
      return;
    }
    if (!editandoUsuario && !formData.senha.trim()) {
      Alert.alert('Erro', 'Digite uma senha para o usuário');
      return;
    }

    // Verificar se email já existe
    const existe = await usuarioRepository.emailExiste(formData.email, editandoUsuario?.id);
    if (existe) {
      Alert.alert('Erro', 'Já existe um usuário com este email');
      return;
    }

    setSalvando(true);
    try {
      const dadosUsuario: any = {
        id: formData.id,
        tipo: 'usuario',
        nome: formData.nome.trim(),
        email: formData.email.toLowerCase().trim(),
        cpf: formData.cpf.replace(/\D/g, ''),
        telefone: formData.telefone.replace(/\D/g, ''),
        tipoPermissao: formData.tipoPermissao,
        permissoes: PERMISSOES_PADRAO[formData.tipoPermissao],
        rotasPermitidas: [],
        status: formData.status,
        bloqueado: 0, // Integer para SQLite
        syncStatus: 'pending',
        needsSync: 1,
        version: 1,
        deviceId: '',
      };

      if (formData.senha.trim()) {
        // Hashear senha antes de armazenar — nunca salvar em plaintext
        dadosUsuario.senha = await bcrypt.hash(formData.senha.trim(), 10);
      }

      if (editandoUsuario) {
        await usuarioRepository.update(dadosUsuario);
      } else {
        await usuarioRepository.save(dadosUsuario);
      }

      setModalVisible(false);
      await carregarUsuarios();
      Alert.alert('Sucesso', editandoUsuario ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o usuário');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = (usuario: Usuario) => {
    if (usuario.id === user?.id) {
      Alert.alert('Erro', 'Você não pode excluir seu próprio usuário');
      return;
    }

    Alert.alert(
      'Excluir Usuário',
      `Tem certeza que deseja excluir "${usuario.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await usuarioRepository.delete(usuario.id);
              Alert.alert('Sucesso', 'Usuário excluído com sucesso');
              carregarUsuarios();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir o usuário');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (usuario: Usuario) => {
    if (usuario.id === user?.id) {
      Alert.alert('Erro', 'Você não pode desativar seu próprio usuário');
      return;
    }

    try {
      const novoStatus = usuario.status === 'Ativo' ? 'Inativo' : 'Ativo';
      await usuarioRepository.update({
        id: usuario.id,
        status: novoStatus,
      });
      carregarUsuarios();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível alterar o status');
    }
  };

  const getTipoPermissaoLabel = (tipo: TipoPermissaoUsuario) => {
    const labels: Record<TipoPermissaoUsuario, string> = {
      'Administrador': 'Administrador',
      'Secretario': 'Secretário',
      'AcessoControlado': 'Acesso Controlado',
    };
    return labels[tipo];
  };

  const getTipoPermissaoColor = (tipo: TipoPermissaoUsuario) => {
    const colors: Record<TipoPermissaoUsuario, string> = {
      'Administrador': '#2563EB',
      'Secretario': '#16A34A',
      'AcessoControlado': '#F59E0B',
    };
    return colors[tipo];
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usuários</Text>
        {podeGerenciar && (
          <TouchableOpacity style={styles.addButton} onPress={handleNovoUsuario}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {carregando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Carregando usuários...</Text>
          </View>
        ) : usuarios.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Nenhum usuário cadastrado</Text>
            {podeGerenciar && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleNovoUsuario}>
                <Text style={styles.emptyButtonText}>Criar primeiro usuário</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          usuarios.map((usuario) => (
            <View key={usuario.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={[styles.userAvatar, { backgroundColor: `${getTipoPermissaoColor(usuario.tipoPermissao)}20` }]}>
                  <Ionicons name="person" size={20} color={getTipoPermissaoColor(usuario.tipoPermissao)} />
                </View>
                <View style={styles.userTextContainer}>
                  <Text style={styles.userName}>{usuario.nome}</Text>
                  <Text style={styles.userEmail}>{usuario.email}</Text>
                  <View style={styles.userTags}>
                    <View style={[styles.tag, { backgroundColor: `${getTipoPermissaoColor(usuario.tipoPermissao)}20` }]}>
                      <Text style={[styles.tagText, { color: getTipoPermissaoColor(usuario.tipoPermissao) }]}>
                        {getTipoPermissaoLabel(usuario.tipoPermissao)}
                      </Text>
                    </View>
                    <View style={[styles.tag, { backgroundColor: usuario.status === 'Ativo' ? '#DCFCE7' : '#FEE2E2' }]}>
                      <Text style={[styles.tagText, { color: usuario.status === 'Ativo' ? '#16A34A' : '#DC2626' }]}>
                        {usuario.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              
              {podeGerenciar && usuario.id !== user?.id && (
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleToggleStatus(usuario)}
                  >
                    <Ionicons 
                      name={usuario.status === 'Ativo' ? 'pause' : 'play'} 
                      size={18} 
                      color="#64748B" 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditarUsuario(usuario)}
                  >
                    <Ionicons name="pencil" size={18} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleExcluir(usuario)}
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
                {editandoUsuario ? 'Editar Usuário' : 'Novo Usuário'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nome completo"
                  placeholderTextColor="#94A3B8"
                  value={formData.nome}
                  onChangeText={(text) => setFormData({ ...formData, nome: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemplo.com"
                  placeholderTextColor="#94A3B8"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF</Text>
                <TextInput
                  style={styles.input}
                  placeholder="000.000.000-00"
                  placeholderTextColor="#94A3B8"
                  value={formData.cpf}
                  onChangeText={(text) => setFormData({ ...formData, cpf: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#94A3B8"
                  value={formData.telefone}
                  onChangeText={(text) => setFormData({ ...formData, telefone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Senha {editandoUsuario ? '(deixe vazio para manter)' : '*'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Senha"
                  placeholderTextColor="#94A3B8"
                  value={formData.senha}
                  onChangeText={(text) => setFormData({ ...formData, senha: text })}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tipo de Permissão *</Text>
                <View style={styles.permissoesContainer}>
                  {(['Administrador', 'Secretario', 'AcessoControlado'] as TipoPermissaoUsuario[]).map((tipo) => (
                    <TouchableOpacity
                      key={tipo}
                      style={[
                        styles.permissaoButton,
                        formData.tipoPermissao === tipo && styles.permissaoButtonActive,
                        { borderColor: getTipoPermissaoColor(tipo) },
                        formData.tipoPermissao === tipo && { backgroundColor: `${getTipoPermissaoColor(tipo)}20` },
                      ]}
                      onPress={() => setFormData({ ...formData, tipoPermissao: tipo })}
                    >
                      <Text
                        style={[
                          styles.permissaoText,
                          formData.tipoPermissao === tipo && { color: getTipoPermissaoColor(tipo) },
                        ]}
                      >
                        {getTipoPermissaoLabel(tipo)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    {formData.status === 'Ativo' ? 'Usuário Ativo' : 'Usuário Inativo'}
                  </Text>
                  <Switch
                    value={formData.status === 'Ativo'}
                    onValueChange={(value) => setFormData({ ...formData, status: value ? 'Ativo' : 'Inativo' })}
                    trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                    thumbColor={formData.status === 'Ativo' ? '#16A34A' : '#F8FAFC'}
                  />
                </View>
              </View>
            </ScrollView>

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
  listContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
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
  userCard: {
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  userTags: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userActions: {
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
    margin: 16,
    maxHeight: '80%',
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
    maxHeight: 400,
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
  permissoesContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  permissaoButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
  },
  permissaoButtonActive: {
    borderWidth: 2,
  },
  permissaoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 15,
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
