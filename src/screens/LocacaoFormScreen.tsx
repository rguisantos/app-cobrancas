/**
 * LocacaoFormScreen.tsx
 * Formulário de criação/edição/relocação de locações
 * 
 * Funcionalidades:
 * - Seleção de produto e cliente
 * - Forma de pagamento (Período, % Pagar, % Receber)
 * - Configuração de percentuais
 * - Dados do relógio
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useLocacao } from '../contexts/LocacaoContext';
import { useProduto } from '../contexts/ProdutoContext';
import { useCliente } from '../contexts/ClienteContext';
import { useAuth } from '../contexts/AuthContext';

// Types
import { Locacao, FormaPagamentoLocacao, Periodicidade } from '../types';
import { ClientesStackParamList } from '../navigation/ClientesStack';

// Utils
import { masks } from '../utils/masks';
import { validators } from '../utils/validators';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type LocacaoFormRouteProp = RouteProp<ClientesStackParamList, 'LocacaoForm'>;

// ============================================================================// COMPONENTE PRINCIPAL
// ============================================================================

export default function LocacaoFormScreen() {
  const route = useRoute<LocacaoFormRouteProp>();
  const navigation = useNavigation();
  const { criarLocacao, atualizarLocacao, carregando } = useLocacao();
  const { produtos, carregarProdutos } = useProduto();
  const { clienteSelecionado } = useCliente();
  const { user } = useAuth();

  const { clienteId, produtoId, modo, locacaoId } = route.params;

  // Estado do formulário
  const [formData, setFormData] = useState<Partial<Locacao>>({
    clienteId,
    clienteNome: clienteSelecionado?.nomeExibicao || '',
    produtoId: produtoId || '',
    produtoIdentificador: '',
    produtoTipo: '',
    dataLocacao: new Date().toISOString(),
    formaPagamento: 'PercentualReceber',
    numeroRelogio: '',
    precoFicha: 0,
    percentualEmpresa: 50,
    percentualCliente: 50,
    status: 'Ativa',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showProdutoPicker, setShowProdutoPicker] = useState(false);
  const [showPeriodicidadePicker, setShowPeriodicidadePicker] = useState(false);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useEffect(() => {
    carregarProdutos({ comLocacaoAtiva: false });
  }, []);

  useEffect(() => {
    if (clienteSelecionado) {
      setFormData(prev => ({
        ...prev,
        clienteId: clienteSelecionado.id,
        clienteNome: clienteSelecionado.nomeExibicao,
      }));
    }
  }, [clienteSelecionado]);
  // ==========================================================================
  // VALIDAÇÕES
  // ==========================================================================

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Produto
    if (!formData.produtoId) {
      newErrors.produtoId = 'Produto é obrigatório';
    }

    // Relógio
    if (!formData.numeroRelogio) {
      newErrors.numeroRelogio = 'Número do relógio é obrigatório';
    }

    // Preço da ficha
    if (!formData.precoFicha || formData.precoFicha <= 0) {
      newErrors.precoFicha = 'Preço da ficha deve ser maior que zero';
    }

    // Percentual
    if (formData.formaPagamento !== 'Periodo') {
      if (!formData.percentualEmpresa || formData.percentualEmpresa < 0 || formData.percentualEmpresa > 100) {
        newErrors.percentualEmpresa = 'Percentual deve estar entre 0 e 100';
      }
    }

    // Período
    if (formData.formaPagamento === 'Periodo') {
      if (!formData.valorFixo || formData.valorFixo <= 0) {
        newErrors.valorFixo = 'Valor fixo deve ser maior que zero';
      }
      if (!formData.periodicidade) {
        newErrors.periodicidade = 'Periodicidade é obrigatória';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleInputChange = useCallback((field: keyof Locacao, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Atualizar percentual cliente automaticamente
    if (field === 'percentualEmpresa' && formData.formaPagamento !== 'Periodo') {
      const percentualCliente = 100 - (value as number);
      setFormData(prev => ({ ...prev, percentualCliente }));
    }
  }, [errors, formData.formaPagamento]);

  const handleSelectProduto = useCallback((produto: any) => {
    setFormData(prev => ({
      ...prev,
      produtoId: produto.id,
      produtoIdentificador: produto.identificador,
      produtoTipo: produto.tipoNome,
    }));
    setShowProdutoPicker(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    try {
      if (modo === 'criar') {
        const locacao = await criarLocacao(formData as any);
        if (locacao) {
          Alert.alert('Sucesso', 'Locação criada com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível criar a locação');
        }
      } else if (modo === 'editar') {
        const sucesso = await atualizarLocacao({ ...formData, id: locacaoId! });
        if (sucesso) {
          Alert.alert('Sucesso', 'Locação atualizada com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar a locação');
        }
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar locação');    }
  }, [formData, modo, locacaoId, criarLocacao, atualizarLocacao, navigation]);

  // ==========================================================================
  // RENDERIZAÇÃO DE CAMPOS
  // ==========================================================================

  const renderInput = useCallback((
    label: string,
    field: keyof Locacao,
    placeholder: string,
    options: {
      keyboardType?: 'default' | 'numeric';
      editable?: boolean;
      mask?: (value: string) => string;
    } = {}
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputContainer, errors[field] && styles.inputError]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={String(formData[field] || '')}
          onChangeText={(value) => {
            const formatted = options.mask ? options.mask(value) : value;
            handleInputChange(field, formatted);
          }}
          keyboardType={options.keyboardType || 'default'}
          editable={options.editable !== false}
        />
      </View>
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  ), [formData, errors, handleInputChange]);

  const renderFormaPagamento = useCallback(() => (
    <View style={styles.formaPagamentoContainer}>
      {[
        { value: 'PercentualReceber', label: '% Receber', icon: 'trending-up' },
        { value: 'PercentualPagar', label: '% Pagar', icon: 'trending-down' },
        { value: 'Periodo', label: 'Período', icon: 'calendar' },
      ].map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.formaPagamentoOption,
            formData.formaPagamento === option.value && styles.formaPagamentoOptionActive,
          ]}          onPress={() => handleInputChange('formaPagamento', option.value)}
        >
          <Ionicons
            name={option.icon as any}
            size={20}
            color={formData.formaPagamento === option.value ? '#FFFFFF' : '#64748B'}
          />
          <Text
            style={[
              styles.formaPagamentoText,
              formData.formaPagamento === option.value && styles.formaPagamentoTextActive,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [formData.formaPagamento, handleInputChange]);

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
          {/* DADOS DA LOCAÇÃO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados da Locação</Text>
            <View style={styles.sectionCard}>
              {/* Cliente (somente leitura) */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cliente</Text>
                <Text style={styles.infoValue}>{formData.clienteNome}</Text>
              </View>

              {/* Produto */}
              <TouchableOpacity
                style={styles.selectButton}                onPress={() => setShowProdutoPicker(true)}
              >
                <Text style={styles.selectLabel}>Produto *</Text>
                <View style={styles.selectValue}>
                  <Text style={formData.produtoId ? styles.selectValueText : styles.selectPlaceholder}>
                    {formData.produtoId 
                      ? `${formData.produtoTipo} N° ${formData.produtoIdentificador}`
                      : 'Selecionar produto'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#64748B" />
                </View>
                {errors.produtoId && <Text style={styles.errorText}>{errors.produtoId}</Text>}
              </TouchableOpacity>

              {/* Data da Locação */}
              {renderInput(
                'Data da Locação',
                'dataLocacao',
                new Date().toLocaleDateString('pt-BR'),
                { editable: false }
              )}

              {/* Observação */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Observação</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Adicione uma observação..."
                    placeholderTextColor="#94A3B8"
                    value={formData.observacao || ''}
                    onChangeText={(value) => handleInputChange('observacao', value)}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================================== */}
          {/* FORMA DE PAGAMENTO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Forma de Pagamento</Text>
            <View style={styles.sectionCard}>
              {renderFormaPagamento()}

              {/* Campos específicos por forma de pagamento */}
              {formData.formaPagamento !== 'Periodo' ? (                <>
                  {/* Número do Relógio */}
                  {renderInput(
                    'Número do Relógio *',
                    'numeroRelogio',
                    '00000',
                    { keyboardType: 'numeric', mask: masks.relogio }
                  )}

                  {/* Preço da Ficha */}
                  {renderInput(
                    'Preço da Ficha *',
                    'precoFicha',
                    'R$ 0,00',
                    { keyboardType: 'numeric' }
                  )}

                  {/* Percentual Empresa */}
                  {renderInput(
                    '% Empresa *',
                    'percentualEmpresa',
                    '50',
                    { keyboardType: 'numeric' }
                  )}

                  {/* Percentual Cliente (somente leitura) */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>% Cliente</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, styles.inputReadOnly]}
                        value={`${formData.percentualCliente || 50}%`}
                        editable={false}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* Periodicidade */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Periodicidade *</Text>
                    <View style={styles.inputContainer}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.periodicidadeScroll}
                      >
                        {['Mensal', 'Semanal', 'Quinzenal', 'Diária'].map((periodo) => (
                          <TouchableOpacity                            key={periodo}
                            style={[
                              styles.periodicidadeChip,
                              formData.periodicidade === periodo && styles.periodicidadeChipActive,
                            ]}
                            onPress={() => handleInputChange('periodicidade', periodo)}
                          >
                            <Text
                              style={[
                                styles.periodicidadeChipText,
                                formData.periodicidade === periodo && styles.periodicidadeChipTextActive,
                              ]}
                            >
                              {periodo}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    {errors.periodicidade && <Text style={styles.errorText}>{errors.periodicidade}</Text>}
                  </View>

                  {/* Valor Fixo */}
                  {renderInput(
                    'Valor Fixo *',
                    'valorFixo',
                    'R$ 0,00',
                    { keyboardType: 'numeric' }
                  )}

                  {/* Data Primeira Cobrança */}
                  {renderInput(
                    'Data Primeira Cobrança',
                    'dataPrimeiraCobranca',
                    'DD/MM/AAAA'
                  )}
                </>
              )}
            </View>
          </View>

          {/* ========================================================================== */}
          {/* RESUMO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo</Text>
            <View style={styles.sectionCard}>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Cliente</Text>
                <Text style={styles.resumoValue}>{formData.clienteNome || '-'}</Text>              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Produto</Text>
                <Text style={styles.resumoValue}>
                  {formData.produtoId 
                    ? `${formData.produtoTipo} N° ${formData.produtoIdentificador}`
                    : '-'}
                </Text>
              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Forma de Pagamento</Text>
                <Text style={styles.resumoValue}>
                  {formData.formaPagamento === 'PercentualReceber' && '% Receber'}
                  {formData.formaPagamento === 'PercentualPagar' && '% Pagar'}
                  {formData.formaPagamento === 'Periodo' && 'Período'}
                </Text>
              </View>
            </View>
          </View>

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
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {modo === 'criar' ? 'Criar Locação' : modo === 'relocar' ? 'Realocar' : 'Atualizar Locação'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ========================================================================== */}
      {/* MODAL DE SELEÇÃO DE PRODUTO (simplificado) */}
      {/* ========================================================================== */}      {showProdutoPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Produto</Text>
              <TouchableOpacity onPress={() => setShowProdutoPicker(false)}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {produtos.map((produto) => (
                <TouchableOpacity
                  key={produto.id}
                  style={styles.produtoItem}
                  onPress={() => handleSelectProduto(produto)}
                >
                  <Text style={styles.produtoItemText}>
                    {produto.tipoNome} N° {produto.identificador}
                  </Text>
                  <Text style={styles.produtoItemSubtitle}>
                    {produto.descricaoNome} • {produto.tamanhoNome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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

  // Info Row
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Select Button
  selectButton: {
    marginBottom: 16,
  },
  selectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  selectValue: {
    flexDirection: 'row',    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectValueText: {
    fontSize: 15,
    color: '#1E293B',
  },
  selectPlaceholder: {
    fontSize: 15,
    color: '#94A3B8',
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
  inputReadOnly: {
    color: '#64748B',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },

  // Forma de Pagamento
  formaPagamentoContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  formaPagamentoOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formaPagamentoOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  formaPagamentoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  formaPagamentoTextActive: {
    color: '#FFFFFF',
  },

  // Periodicidade
  periodicidadeScroll: {
    gap: 8,
  },
  periodicidadeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  periodicidadeChipActive: {
    backgroundColor: '#2563EB',  },
  periodicidadeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  periodicidadeChipTextActive: {
    color: '#FFFFFF',
  },

  // Resumo
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  resumoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  resumoValue: {
    fontSize: 14,
    fontWeight: '600',
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
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',    padding: 16,
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

  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
  modalList: {
    padding: 16,
  },
  produtoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },  produtoItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  produtoItemSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
});