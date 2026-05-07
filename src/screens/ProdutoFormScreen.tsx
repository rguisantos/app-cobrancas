/**
 * ProdutoFormScreen.tsx
 * Formulário de cadastro/edição de produtos
 *
 * REFACTORED: Usa useZodForm com produtoFormSchema do @cobrancas/shared
 * - Validação Zod centralizada (idêntica ao web)
 * - Audit logging em todas as mutações
 * - Permission guards client-side
 *
 * Funcionalidades:
 * - Campos de identificação (identificador, relógio)
 * - Seleção de tipo, descrição, tamanho
 * - Conservação e status
 * - Dados de manutenção
 * - Validações de negócio via Zod
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

// Schemas & Validation
import { produtoFormSchema } from '@cobrancas/shared';
import { useZodForm } from '../hooks/useZodForm';

// Contexts
import { useProduto } from '../contexts/ProdutoContext';
import { useAuth } from '../contexts/AuthContext';

// Hooks
import { usePermissionGuard } from '../hooks/usePermissionGuard';

// Services
import AuditService from '../services/AuditService';
import atributosProdutoService, { AtributoItem } from '../services/AtributosProdutoService';

// Types
import { Produto, Conservacao, StatusProduto } from '../types';
import { ProdutosStackParamList } from '../navigation/ProdutosStack';

// Utils
import { masks } from '../utils/masks';
import { dateISOtoBR, dateBRtoISO } from '../utils/database';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type ProdutoFormRouteProp = RouteProp<ProdutosStackParamList, 'ProdutoForm'>;

// ============================================================================// DADOS PARA SELECTS
// ============================================================================

const CONSERVACOES: Conservacao[] = ['Ótima', 'Boa', 'Regular', 'Ruim', 'Péssima'];
const STATUS_PRODUTO: StatusProduto[] = ['Ativo', 'Inativo', 'Manutenção'];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ProdutoFormScreen() {
  const route = useRoute<ProdutoFormRouteProp>();
  const navigation = useNavigation();
  const { produtoSelecionado, carregarProduto, salvarProduto, atualizarProduto, carregando } = useProduto();
  const { user, hasPermission } = useAuth();
  const { canDo } = usePermissionGuard();

  const modo = route.params?.modo || 'criar';
  const produtoId = route.params?.produtoId;

  // Zod Form Hook — validação centralizada
  const {
    formData,
    errors,
    setField,
    setFields,
    setFormData,
    validateAndGet,
    isSubmitted,
  } = useZodForm(produtoFormSchema, {
    identificador: '',
    numeroRelogio: '',
    tipoId: '',
    tipoNome: '',
    descricaoId: '',
    descricaoNome: '',
    tamanhoId: '',
    tamanhoNome: '',
    conservacao: 'Boa' as Conservacao,
    statusProduto: 'Ativo' as StatusProduto,
    codigoCH: '',
    codigoABLF: '',
    dataFabricacao: '',
    dataUltimaManutencao: '',
    relatorioUltimaManutencao: '',
    estabelecimento: '',
    observacao: '',
  });
  const [showTipoPicker, setShowTipoPicker] = useState(false);
  const [showDescricaoPicker, setShowDescricaoPicker] = useState(false);
  const [showTamanhoPicker, setShowTamanhoPicker] = useState(false);
  const [showConservacaoPicker, setShowConservacaoPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [carregandoProduto, setCarregandoProduto] = useState(false);
  
  // Atributos carregados do banco
  const [tiposProduto, setTiposProduto] = useState<AtributoItem[]>([]);
  const [descricoesProduto, setDescricoesProduto] = useState<AtributoItem[]>([]);
  const [tamanhosProduto, setTamanhosProduto] = useState<AtributoItem[]>([]);
  const [carregandoAtributos, setCarregandoAtributos] = useState(false);

  // ==========================================================================
  // CARREGAMENTO DE ATRIBUTOS DO BANCO
  // ==========================================================================

  useEffect(() => {
    carregarAtributos();
  }, []);

  const carregarAtributos = async () => {
    setCarregandoAtributos(true);
    try {
      const [tipos, descricoes, tamanhos] = await Promise.all([
        atributosProdutoService.getAll('tipo'),
        atributosProdutoService.getAll('descricao'),
        atributosProdutoService.getAll('tamanho'),
      ]);
      setTiposProduto(tipos);
      setDescricoesProduto(descricoes);
      setTamanhosProduto(tamanhos);
      console.log('[ProdutoFormScreen] Atributos carregados:', { tipos: tipos.length, descricoes: descricoes.length, tamanhos: tamanhos.length });
    } catch (error) {
      console.error('[ProdutoFormScreen] Erro ao carregar atributos:', error);
    } finally {
      setCarregandoAtributos(false);
    }
  };

  // ==========================================================================
  // CARREGAMENTO (MODO EDIÇÃO)
  // ==========================================================================

  useEffect(() => {
    const carregarProdutoParaEdicao = async () => {
      if (modo === 'editar' && produtoId) {
        setCarregandoProduto(true);
        try {
          // Se o produtoSelecionado já está carregado e é o mesmo ID
          if (produtoSelecionado && produtoSelecionado.id === produtoId) {
            setFormData({
              ...produtoSelecionado,
              tipoId: produtoSelecionado.tipoId?.toString() || '',
              descricaoId: produtoSelecionado.descricaoId?.toString() || '',
              tamanhoId: produtoSelecionado.tamanhoId?.toString() || '',
              dataFabricacao: dateISOtoBR(produtoSelecionado.dataFabricacao),
              dataUltimaManutencao: dateISOtoBR(produtoSelecionado.dataUltimaManutencao),
              dataAvaliacao: dateISOtoBR(produtoSelecionado.dataAvaliacao),
            } as any);
          } else {
            // Carregar o produto do repositório
            await carregarProduto(produtoId);
          }
        } catch (error) {
          console.error('Erro ao carregar produto para edição:', error);
        } finally {
          setCarregandoProduto(false);
        }
      }
    };
    
    carregarProdutoParaEdicao();
  }, [modo, produtoId]);

  // Atualiza formData quando produtoSelecionado muda
  useEffect(() => {
    if (modo === 'editar' && produtoId && produtoSelecionado && produtoSelecionado.id === produtoId) {
      setFormData({
        ...produtoSelecionado,
        tipoId: produtoSelecionado.tipoId?.toString() || '',
        descricaoId: produtoSelecionado.descricaoId?.toString() || '',
        tamanhoId: produtoSelecionado.tamanhoId?.toString() || '',
        dataFabricacao: dateISOtoBR(produtoSelecionado.dataFabricacao),
        dataUltimaManutencao: dateISOtoBR(produtoSelecionado.dataUltimaManutencao),
        dataAvaliacao: dateISOtoBR(produtoSelecionado.dataAvaliacao),
      } as any);
    }
  }, [produtoSelecionado, modo, produtoId]);

  // ==========================================================================
  // VALIDAÇÕES — Delegadas ao useZodForm + produtoFormSchema
  // ==========================================================================
  // A validação é feita automaticamente pelo useZodForm ao chamar validateAndGet().
  // O schema produtoFormSchema (de @cobrancas/shared) garante validação idêntica ao web.

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleInputChange = useCallback((field: string, value: string) => {
    setField(field as any, value);
  }, [setField]);

  const handleSelectTipo = useCallback((item: any) => {
    setFields({ tipoId: item.id, tipoNome: item.nome } as any);
    setShowTipoPicker(false);
  }, [setFields]);

  const handleSelectDescricao = useCallback((item: any) => {
    setFields({ descricaoId: item.id, descricaoNome: item.nome } as any);
    setShowDescricaoPicker(false);
  }, [setFields]);

  const handleSelectTamanho = useCallback((item: any) => {
    setFields({ tamanhoId: item.id, tamanhoNome: item.nome } as any);
    setShowTamanhoPicker(false);
  }, [setFields]);

  const handleSelectConservacao = useCallback((value: Conservacao) => {
    setField('conservacao' as any, value);
    setShowConservacaoPicker(false);
  }, [setField]);

  const handleSelectStatus = useCallback((value: StatusProduto) => {
    setField('statusProduto' as any, value);
    setShowStatusPicker(false);
  }, [setField]);

  const handleSubmit = useCallback(async () => {
    // Permission guard
    if (!canDo('produtos', modo === 'criar' ? 'create' : 'edit')) {
      Alert.alert('Sem permissão', 'Você não tem permissão para realizar esta ação.');
      return;
    }

    // Validação via Zod
    const validatedData = validateAndGet();
    if (!validatedData) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    // Convert date fields from DD/MM/AAAA to ISO for backend compatibility
    const dataToSave = {
      ...validatedData,
      dataFabricacao: dateBRtoISO(validatedData.dataFabricacao),
      dataUltimaManutencao: dateBRtoISO(validatedData.dataUltimaManutencao),
      dataAvaliacao: dateBRtoISO((validatedData as any).dataAvaliacao),
      dataCadastro: modo === 'criar' ? new Date().toISOString() : undefined,
      dataUltimaAlteracao: new Date().toISOString(),
    };

    try {
      if (modo === 'criar') {
        const produto = await salvarProduto(dataToSave as any);
        if (produto) {
          // Audit log
          await AuditService.logAction('criar_produto', 'produto', String(produto.id), {
            identificador: validatedData.identificador,
            tipo: validatedData.tipoNome,
          });
          Alert.alert('Sucesso', 'Produto cadastrado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível cadastrar o produto');
        }
      } else {
        const sucesso = await atualizarProduto({ ...dataToSave, id: produtoId! } as any);
        if (sucesso) {
          // Audit log
          await AuditService.logAction('editar_produto', 'produto', produtoId, {
            identificador: validatedData.identificador,
            tipo: validatedData.tipoNome,
          });
          Alert.alert('Sucesso', 'Produto atualizado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar o produto');
        }
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar produto');
    }
  }, [modo, produtoId, salvarProduto, atualizarProduto, navigation, canDo, validateAndGet]);

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

  // Mostrar loading quando estiver carregando produto para edição
  if (carregandoProduto || (modo === 'editar' && produtoId && !formData.identificador)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando produto...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
                <View style={[
                  styles.inputContainer, 
                  errors.identificador && styles.inputError,
                  modo === 'editar' && styles.inputDisabled
                ]}>
                  <TextInput
                    style={[styles.input, modo === 'editar' && styles.inputTextDisabled]}
                    placeholder="Ex: 515"
                    placeholderTextColor="#94A3B8"
                    value={formData.identificador}
                    onChangeText={(value) => handleInputChange('identificador', value)}
                    keyboardType="numeric"
                    editable={modo === 'criar'}
                  />
                  {modo === 'editar' && (
                    <Ionicons name="lock-closed" size={16} color="#94A3B8" style={styles.lockIcon} />
                  )}
                </View>
                {errors.identificador && <Text style={styles.errorText}>{errors.identificador}</Text>}
                {modo === 'editar' && (
                  <Text style={styles.hintText}>O identificador não pode ser alterado</Text>
                )}
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
                carregandoAtributos ? 'Carregando...' : 'Selecionar tipo',
                tiposProduto,
                handleSelectTipo,
                showTipoPicker,
                () => setShowTipoPicker(!showTipoPicker),
                errors.tipoId
              )}

              {/* Descrição */}
              {renderPicker(
                'Descrição *',
                formData.descricaoNome || '',
                carregandoAtributos ? 'Carregando...' : 'Selecionar descrição',
                descricoesProduto,
                handleSelectDescricao,
                showDescricaoPicker,
                () => setShowDescricaoPicker(!showDescricaoPicker),
                errors.descricaoId
              )}

              {/* Tamanho */}
              {renderPicker(
                'Tamanho *',
                formData.tamanhoNome || '',
                carregandoAtributos ? 'Carregando...' : 'Selecionar tamanho',
                tamanhosProduto,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  input: {
    fontSize: 16,
    color: '#1E293B',
    flex: 1,
  },
  inputTextDisabled: {
    color: '#64748B',
  },
  inputMultiline: {    minHeight: 80,
    textAlignVertical: 'top',
  },
  lockIcon: {
    marginLeft: 8,
  },
  hintText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
});