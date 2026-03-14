/**
 * ProdutoFormScreen.tsx
 * Formulário de cadastro/edição de produtos
 * 
 * Funcionalidades:
 * - Campos de identificação (identificador, relógio)
 * - Seleção de tipo, descrição, tamanho
 * - Conservação e status
 * - Dados de manutenção
 * - Validações de negócio
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useProduto } from '../contexts/ProdutoContext';
import { useAuth } from '../contexts/AuthContext';

// Types
import { Produto, Conservacao, StatusProduto } from '../types';
import { ProdutosStackParamList } from '../navigation/ProdutosStack';

// Utils
import { masks } from '../utils/masks';
import { validators } from '../utils/validators';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type ProdutoFormRouteProp = RouteProp<ProdutosStackParamList, 'ProdutoForm'>;

// ============================================================================// DADOS PARA SELECTS (mock - em produção viriam da API)
// ============================================================================

const TIPOS_PRODUTO = [
  { id: '1', nome: 'Bilhar' },
  { id: '2', nome: 'Jukebox Padrão Grande' },
  { id: '3', nome: 'Jukebox Padrão Pequeno' },
  { id: '4', nome: 'Mesa' },
  { id: '5', nome: 'Grua' },
  { id: '6', nome: 'Ficha' },
];

const DESCRICOES_PRODUTO = [
  { id: '1', nome: 'Azul' },
  { id: '2', nome: 'Branco/Carijo' },
  { id: '3', nome: 'Preto' },
  { id: '4', nome: 'Vermelho' },
  { id: '5', nome: 'Verde' },
];

const TAMANHOS_PRODUTO = [
  { id: '1', nome: '2,00' },
  { id: '2', nome: '2,20' },
  { id: '3', nome: '2,40' },
  { id: '4', nome: 'Grande' },
  { id: '5', nome: 'Média' },
  { id: '6', nome: 'Pequena' },
];

const CONSERVACOES: Conservacao[] = ['Ótima', 'Boa', 'Regular', 'Ruim', 'Péssima'];
const STATUS_PRODUTO: StatusProduto[] = ['Ativo', 'Inativo', 'Manutenção'];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ProdutoFormScreen() {
  const route = useRoute<ProdutoFormRouteProp>();
  const navigation = useNavigation();
  const { produtoSelecionado, salvarProduto, atualizarProduto, carregando } = useProduto();
  const { user, hasPermission } = useAuth();

  const modo = route.params?.modo || 'criar';
  const produtoId = route.params?.produtoId;

  // Estado do formulário
  const [formData, setFormData] = useState<Partial<Produto>>({
    identificador: '',
    numeroRelogio: '',
    tipoId: '',    tipoNome: '',
    descricaoId: '',
    descricaoNome: '',
    tamanhoId: '',
    tamanhoNome: '',
    conservacao: 'Boa',
    statusProduto: 'Ativo',
    codigoCH: '',
    codigoABLF: '',
    observacao: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTipoPicker, setShowTipoPicker] = useState(false);
  const [showDescricaoPicker, setShowDescricaoPicker] = useState(false);
  const [showTamanhoPicker, setShowTamanhoPicker] = useState(false);
  const [showConservacaoPicker, setShowConservacaoPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // ==========================================================================
  // CARREGAMENTO (MODO EDIÇÃO)
  // ==========================================================================

  useEffect(() => {
    if (modo === 'editar' && produtoId && produtoSelecionado) {
      setFormData({
        ...produtoSelecionado,
        tipoId: produtoSelecionado.tipoId?.toString() || '',
        descricaoId: produtoSelecionado.descricaoId?.toString() || '',
        tamanhoId: produtoSelecionado.tamanhoId?.toString() || '',
      });
  
  }
  }, [modo, produtoId, produtoSelecionado]);

  // ==========================================================================
  // VALIDAÇÕES
  // ==========================================================================

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Identificador (obrigatório e único)
    if (!formData.identificador?.trim()) {
      newErrors.identificador = 'Identificador é obrigatório';
  
  }

    // Número do relógio
    if (!formData.numeroRelogio?.trim()) {
      newErrors.numeroRelogio = 'Número do relógio é obrigatório';
  
  }
    // Tipo
    if (!formData.tipoId) {
      newErrors.tipoId = 'Tipo é obrigatório';
  
  }

    // Descrição
    if (!formData.descricaoId) {
      newErrors.descricaoId = 'Descrição é obrigatória';
  
  }

    // Tamanho
    if (!formData.tamanhoId) {
      newErrors.tamanhoId = 'Tamanho é obrigatório';
  
  }

    // Conservação
    if (!formData.conservacao) {
      newErrors.conservacao = 'Conservação é obrigatória';
  
  }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleInputChange = useCallback((field: keyof Produto, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
  
  }
  }, [errors]);

  const handleSelectTipo = useCallback((item: any) => {
    setFormData(prev => ({
      ...prev,
      tipoId: item.id,
      tipoNome: item.nome,
    }));
    setShowTipoPicker(false);
  }, []);

  const handleSelectDescricao = useCallback((item: any) => {
    setFormData(prev => ({
      ...prev,
      descricaoId: item.id,      descricaoNome: item.nome,
    }));
    setShowDescricaoPicker(false);
  }, []);

  const handleSelectTamanho = useCallback((item: any) => {
    setFormData(prev => ({
      ...prev,
      tamanhoId: item.id,
      tamanhoNome: item.nome,
    }));
    setShowTamanhoPicker(false);
  }, []);

  const handleSelectConservacao = useCallback((value: Conservacao) => {
    setFormData(prev => ({ ...prev, conservacao: value }));
    setShowConservacaoPicker(false);
  }, []);

  const handleSelectStatus = useCallback((value: StatusProduto) => {
    setFormData(prev => ({ ...prev, statusProduto: value }));
    setShowStatusPicker(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
  
  }

    try {
      if (modo === 'criar') {
        const produto = await salvarProduto(formData);
        if (produto) {
          Alert.alert('Sucesso', 'Produto cadastrado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível cadastrar o produto');
      
  }
      } else {
        const sucesso = await atualizarProduto({ ...formData, id: produtoId! });
        if (sucesso) {
          Alert.alert('Sucesso', 'Produto atualizado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar o produto');
      
  }
      }    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar produto');
  
  }
  }, [formData, modo, produtoId, salvarProduto, atualizarProduto, navigation]);

  // ==========================================================================
  // RENDERIZAÇÃO DE SELECTS
  // ==========================================================================

  const renderPicker = useCallback((
    label: string,
    value: string,
    placeholder: string,
    items: any[],
    onSelect: (item: any) => void,
    visible: boolean,
    onToggle: () => void,
    error?: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}{error && ' *'}</Text>
      <TouchableOpacity
        style={[styles.selectButton, error && styles.selectButtonError]}
        onPress={onToggle}
      >
        <Text style={value ? styles.selectValueText : styles.selectPlaceholder}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#64748B" />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onToggle}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={onToggle}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => String(item.id || item)}
              renderItem={({ item }) => (                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => onSelect(typeof item === 'string' ? item : item)}
                >
                  <Text style={styles.modalItemText}>
                    {typeof item === 'string' ? item : item.nome}
                  </Text>
                  {value === (item.nome || item) && (
                    <Ionicons name="checkmark" size={20} color="#2563EB" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  ), []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================================================== */}
          {/* IDENTIFICAÇÃO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identificação</Text>
            <View style={styles.sectionCard}>
              {/* Identificador (numeração física) */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Identificador (Placa) *</Text>
                <View style={[styles.inputContainer, errors.identificador && styles.inputError]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 515"
                    placeholderTextColor="#94A3B8"
                    value={formData.identificador}
                    onChangeText={(value) => handleInputChange('identificador', value)}                    keyboardType="numeric"
                  />
                </View>
                {errors.identificador && <Text style={styles.errorText}>{errors.identificador}</Text>}
              </View>

              {/* Número do Relógio */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Número do Relógio *</Text>
                <View style={[styles.inputContainer, errors.numeroRelogio && styles.inputError]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 8070"
                    placeholderTextColor="#94A3B8"
                    value={formData.numeroRelogio}
                    onChangeText={(value) => handleInputChange('numeroRelogio', masks.relogio(value))}
                    keyboardType="numeric"
                  />
                </View>
                {errors.numeroRelogio && <Text style={styles.errorText}>{errors.numeroRelogio}</Text>}
              </View>

              {/* Códigos Internos */}
              <View style={styles.row}>
                <View style={[styles.flex1, styles.rowField]}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Código CH</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="CH"
                        placeholderTextColor="#94A3B8"
                        value={formData.codigoCH}
                        onChangeText={(value) => handleInputChange('codigoCH', value.toUpperCase())}
                      />
                    </View>
                  </View>
                </View>
                <View style={[styles.flex1, styles.rowField]}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Código ABLF</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="ABLF"
                        placeholderTextColor="#94A3B8"
                        value={formData.codigoABLF}
                        onChangeText={(value) => handleInputChange('codigoABLF', value.toUpperCase())}
                      />
                    </View>                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================================== */}
          {/* CARACTERÍSTICAS */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Características</Text>
            <View style={styles.sectionCard}>
              {/* Tipo */}
              {renderPicker(
                'Tipo *',
                formData.tipoNome || '',
                'Selecionar tipo',
                TIPOS_PRODUTO,
                handleSelectTipo,
                showTipoPicker,
                () => setShowTipoPicker(!showTipoPicker),
                errors.tipoId
              )}

              {/* Descrição */}
              {renderPicker(
                'Descrição *',
                formData.descricaoNome || '',
                'Selecionar descrição',
                DESCRICOES_PRODUTO,
                handleSelectDescricao,
                showDescricaoPicker,
                () => setShowDescricaoPicker(!showDescricaoPicker),
                errors.descricaoId
              )}

              {/* Tamanho */}
              {renderPicker(
                'Tamanho *',
                formData.tamanhoNome || '',
                'Selecionar tamanho',
                TAMANHOS_PRODUTO,
                handleSelectTamanho,
                showTamanhoPicker,
                () => setShowTamanhoPicker(!showTamanhoPicker),
                errors.tamanhoId
              )}
            </View>
          </View>
          {/* ========================================================================== */}
          {/* ESTADO DO PRODUTO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado do Produto</Text>
            <View style={styles.sectionCard}>
              {/* Conservação */}
              {renderPicker(
                'Conservação *',
                formData.conservacao || '',
                'Selecionar conservação',
                CONSERVACOES,
                handleSelectConservacao,
                showConservacaoPicker,
                () => setShowConservacaoPicker(!showConservacaoPicker),
                errors.conservacao
              )}

              {/* Status */}
              {renderPicker(
                'Status *',
                formData.statusProduto || '',
                'Selecionar status',
                STATUS_PRODUTO,
                handleSelectStatus,
                showStatusPicker,
                () => setShowStatusPicker(!showStatusPicker)
              )}
            </View>
          </View>

          {/* ========================================================================== */}
          {/* MANUTENÇÃO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manutenção</Text>
            <View style={styles.sectionCard}>
              {/* Data de Fabricação */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Data de Fabricação</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#94A3B8"
                    value={formData.dataFabricacao || ''}
                    onChangeText={(value) => handleInputChange('dataFabricacao', value)}
                  />
                </View>              </View>

              {/* Última Manutenção */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Data da Última Manutenção</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#94A3B8"
                    value={formData.dataUltimaManutencao || ''}
                    onChangeText={(value) => handleInputChange('dataUltimaManutencao', value)}
                  />
                </View>
              </View>

              {/* Relatório */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Relatório da Última Manutenção</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Descreva a manutenção realizada..."
                    placeholderTextColor="#94A3B8"
                    value={formData.relatorioUltimaManutencao || ''}
                    onChangeText={(value) => handleInputChange('relatorioUltimaManutencao', value)}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================================== */}
          {/* OBSERVAÇÕES */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Adicione observações adicionais..."
                placeholderTextColor="#94A3B8"
                value={formData.observacao || ''}
                onChangeText={(value) => handleInputChange('observacao', value)}
                multiline
                numberOfLines={4}
              />
            </View>          </View>

          {/* Espaço extra */}
          <View style={styles.footer} />
        </ScrollView>

        {/* ========================================================================== */}
        {/* BOTÃO SALVAR */}
        {/* ========================================================================== */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveButton, carregando && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {modo === 'criar' ? 'Salvar Produto' : 'Atualizar Produto'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Inputs
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  input: {
    fontSize: 16,
    color: '#1E293B',
  },
  inputMultiline: {    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },

  // Row
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  rowField: {
    marginBottom: 0,
  },

  // Select Button
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectButtonError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  selectValueText: {
    fontSize: 16,
    color: '#1E293B',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#94A3B8',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
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
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemText: {
    fontSize: 16,
    color: '#1E293B',
  },

  // Footer
  footer: {
    height: 20,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});