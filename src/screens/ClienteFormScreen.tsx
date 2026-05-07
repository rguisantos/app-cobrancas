/**
 * ClienteFormScreen.tsx
 * Formulário de cadastro/edição de clientes
 *
 * REFACTORED: Usa useZodForm com clienteFormUnifiedSchema do @cobrancas/shared
 * - Validação Zod centralizada (idêntica ao web)
 * - Audit logging em todas as mutações
 * - Permission guards client-side
 *
 * Funcionalidades:
 * - Campos para PF e PJ
 * - Validação de CPF/CNPJ via Zod
 * - Contatos adicionais (múltiplos)
 * - Endereço completo com busca de CEP
 * - Seleção de Estado → Cidades via API IBGE
 * - Seleção de rota
 * - Máscaras de input
 * - Captura de coordenadas GPS
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
import * as Location from 'expo-location';

// Schemas & Validation
import { clienteFormUnifiedSchema } from '@cobrancas/shared';
import { useZodForm } from '../hooks/useZodForm';

// Contexts
import { useCliente } from '../contexts/ClienteContext';
import { useRota } from '../contexts/RotaContext';
import { useAuth } from '../contexts/AuthContext';

// Services
import AuditService from '../services/AuditService';
import localizacaoService, { Estado, Cidade } from '../services/LocalizacaoService';

// Hooks
import { usePermissionGuard } from '../hooks/usePermissionGuard';

// Types
import { Cliente, Contato, TipoPessoa } from '../types';
import { ClientesStackParamList } from '../navigation/ClientesStack';

// Utils
import { masks } from '../utils/masks';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type ClienteFormRouteProp = RouteProp<ClientesStackParamList, 'ClienteForm'>;

// ============================================================================
// DEFAULT FORM VALUES
// ============================================================================

const getDefaultFormValues = (): Record<string, any> => ({
  tipoPessoa: 'Fisica' as TipoPessoa,
  nomeExibicao: '',
  cpfCnpj: '',
  rgIe: '',
  nomeCompleto: '',
  nomeFantasia: '',
  razaoSocial: '',
  inscricaoEstadual: '',
  email: '',
  telefonePrincipal: '',
  contatos: [],
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  rotaId: '',
  rotaNome: '',
  latitude: null as number | null,
  longitude: null as number | null,
  observacao: '',
  status: 'Ativo' as const,
});

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ClienteFormScreen() {
  const route = useRoute<ClienteFormRouteProp>();
  const navigation = useNavigation();
  const { clienteSelecionado, salvarCliente, atualizarCliente, carregando } = useCliente();
  const { rotas } = useRota();
  const { user, canAccessRota } = useAuth();
  const { canDo } = usePermissionGuard();

  const modo = route.params?.modo || 'criar';
  const clienteId = route.params?.clienteId;

  // Zod Form Hook — validação centralizada
  const {
    formData,
    errors,
    setField,
    setFields,
    setFormData,
    validateAndGet,
    isSubmitted,
  } = useZodForm(clienteFormUnifiedSchema, getDefaultFormValues());

  const tipoPessoa = formData.tipoPessoa as TipoPessoa;

  const [buscandoCep, setBuscandoCep] = useState(false);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [carregandoEstados, setCarregandoEstados] = useState(false);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [modalEstadoVisible, setModalEstadoVisible] = useState(false);
  const [modalCidadeVisible, setModalCidadeVisible] = useState(false);
  const [capturandoLocalizacao, setCapturandoLocalizacao] = useState(false);
  const [localizacaoCapturada, setLocalizacaoCapturada] = useState(false);

  // ==========================================================================
  // CARREGAMENTO INICIAL
  // ==========================================================================

  useEffect(() => {
    carregarEstados();
  }, []);

  useEffect(() => {
    if (modo === 'editar' && clienteId && clienteSelecionado) {
      // Mapear Cliente para o formato do form
      const formValues: Record<string, any> = {
        tipoPessoa: clienteSelecionado.tipoPessoa || 'Fisica',
        nomeExibicao: clienteSelecionado.nomeExibicao || '',
        cpfCnpj: clienteSelecionado.cpf || clienteSelecionado.cnpj || clienteSelecionado.cpfCnpj || '',
        rgIe: clienteSelecionado.rg || clienteSelecionado.inscricaoEstadual || clienteSelecionado.rgIe || '',
        nomeCompleto: clienteSelecionado.nomeCompleto || '',
        nomeFantasia: clienteSelecionado.nomeFantasia || '',
        razaoSocial: clienteSelecionado.razaoSocial || '',
        inscricaoEstadual: clienteSelecionado.inscricaoEstadual || '',
        email: clienteSelecionado.email || '',
        telefonePrincipal: clienteSelecionado.telefonePrincipal || '',
        contatos: clienteSelecionado.contatos || [],
        cep: clienteSelecionado.cep || '',
        logradouro: clienteSelecionado.logradouro || '',
        numero: clienteSelecionado.numero || '',
        complemento: clienteSelecionado.complemento || '',
        bairro: clienteSelecionado.bairro || '',
        cidade: clienteSelecionado.cidade || '',
        estado: clienteSelecionado.estado || '',
        rotaId: clienteSelecionado.rotaId || '',
        rotaNome: clienteSelecionado.rotaNome || '',
        latitude: clienteSelecionado.latitude || null,
        longitude: clienteSelecionado.longitude || null,
        observacao: clienteSelecionado.observacao || '',
        status: clienteSelecionado.status || 'Ativo',
      };
      setFormData(formValues);

      if (clienteSelecionado.latitude && clienteSelecionado.longitude) {
        setLocalizacaoCapturada(true);
      }
      if (clienteSelecionado.estado) {
        carregarCidades(clienteSelecionado.estado);
      }
    }
  }, [modo, clienteId, clienteSelecionado]);

  const carregarEstados = async () => {
    setCarregandoEstados(true);
    try {
      const lista = await localizacaoService.getEstados();
      setEstados(lista);
    } catch (error) {
      console.error('Erro ao carregar estados:', error);
    } finally {
      setCarregandoEstados(false);
    }
  };

  const carregarCidades = async (uf: string) => {
    if (!uf) {
      setCidades([]);
      return;
    }
    setCarregandoCidades(true);
    try {
      const lista = await localizacaoService.getCidadesPorEstado(uf);
      setCidades(lista);
    } catch (error) {
      console.error('Erro ao carregar cidades:', error);
      setCidades([]);
    } finally {
      setCarregandoCidades(false);
    }
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleInputChange = useCallback((field: string, value: any) => {
    setField(field as any, value);
  }, [setField]);

  const handleCepBlur = useCallback(async () => {
    const cep = formData.cep?.replace(/\D/g, '');
    if (cep?.length === 8) {
      setBuscandoCep(true);
      try {
        const endereco = await localizacaoService.buscarEnderecoPorCep(cep);

        if (endereco && !endereco.erro) {
          setFields({
            logradouro: endereco.logradouro,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            estado: endereco.estado,
          } as any);

          if (endereco.estado) {
            await carregarCidades(endereco.estado);
          }
        } else if (endereco?.erro) {
          Alert.alert('CEP não encontrado', 'Verifique o CEP digitado');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      } finally {
        setBuscandoCep(false);
      }
    }
  }, [formData.cep, setFields]);

  const handleSelectEstado = useCallback((estado: Estado) => {
    setFields({
      estado: estado.sigla,
      cidade: '',
    } as any);
    setModalEstadoVisible(false);
    carregarCidades(estado.sigla);
  }, [setFields]);

  const handleSelectCidade = useCallback((cidade: Cidade) => {
    setField('cidade' as any, cidade.nome);
    setModalCidadeVisible(false);
  }, [setField]);

  const handleAddContato = useCallback(() => {
    const newContatos = [
      ...(formData.contatos || []),
      { id: `contato_${Date.now()}`, nome: '', telefone: '' },
    ];
    setField('contatos' as any, newContatos);
  }, [formData.contatos, setField]);

  const handleRemoveContato = useCallback((index: number) => {
    const newContatos = formData.contatos?.filter((_: any, i: number) => i !== index);
    setField('contatos' as any, newContatos);
  }, [formData.contatos, setField]);

  const handleContatoChange = useCallback((index: number, field: keyof Contato, value: string) => {
    const newContatos = formData.contatos?.map((c: any, i: number) =>
      i === index ? { ...c, [field]: value } : c
    );
    setField('contatos' as any, newContatos);
  }, [formData.contatos, setField]);

  const handleCapturarLocalizacao = useCallback(async () => {
    try {
      setCapturandoLocalizacao(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Habilite o acesso à localização nas configurações do aparelho para capturar as coordenadas.');
        setCapturandoLocalizacao(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setFields({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      } as any);
      setLocalizacaoCapturada(true);
    } catch (error) {
      console.error('Erro ao capturar localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização. Verifique se o GPS está ativo.');
    } finally {
      setCapturandoLocalizacao(false);
    }
  }, [setFields]);

  const handleSubmit = useCallback(async () => {
    // Permission guard
    if (!canDo('clientes', modo === 'criar' ? 'create' : 'edit')) {
      Alert.alert('Sem permissão', 'Você não tem permissão para realizar esta ação.');
      return;
    }

    // Validação via Zod
    const validatedData = validateAndGet();
    if (!validatedData) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    try {
      if (modo === 'criar') {
        const cliente = await salvarCliente(validatedData as any);
        if (cliente) {
          // Audit log
          await AuditService.logAction('criar_cliente', 'cliente', cliente.id, {
            nome: validatedData.nomeExibicao,
            tipoPessoa: validatedData.tipoPessoa,
          });
          Alert.alert('Sucesso', 'Cliente cadastrado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível cadastrar o cliente');
        }
      } else {
        const sucesso = await atualizarCliente({ ...validatedData, id: clienteId! } as any);
        if (sucesso) {
          // Audit log
          await AuditService.logAction('editar_cliente', 'cliente', clienteId, {
            nome: validatedData.nomeExibicao,
            tipoPessoa: validatedData.tipoPessoa,
          });
          Alert.alert('Sucesso', 'Cliente atualizado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar o cliente');
        }
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar cliente');
    }
  }, [modo, clienteId, salvarCliente, atualizarCliente, navigation, canDo, validateAndGet]);

  // ==========================================================================
  // RENDERIZAÇÃO DE CAMPOS
  // ==========================================================================

  const renderInput = useCallback((
    label: string,
    field: string,
    placeholder: string,
    options: {
      keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
      multiline?: boolean;
      editable?: boolean;
      mask?: (value: string) => string;
    } = {}
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}{options.editable !== false && ' *'}</Text>
      <View style={[styles.inputContainer, errors[field] && styles.inputError]}>
        <TextInput
          style={[styles.input, options.multiline && styles.inputMultiline]}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={formData[field] as string || ''}
          onChangeText={(value) => {
            const formatted = options.mask ? options.mask(value) : value;
            handleInputChange(field, formatted);
          }}
          keyboardType={options.keyboardType || 'default'}
          multiline={options.multiline}
          editable={options.editable !== false}
          autoCapitalize="words"
        />
      </View>
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  ), [formData, errors, handleInputChange]);

  const renderContato = useCallback((contato: Contato, index: number) => (
    <View key={contato.id || index} style={styles.contatoCard}>
      <View style={styles.contatoHeader}>
        <Text style={styles.contatoTitle}>Contato {index + 1}</Text>
        <TouchableOpacity
          onPress={() => handleRemoveContato(index)}
          style={styles.removeButton}
        >
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
        </TouchableOpacity>
      </View>
      <View style={styles.contatoRow}>
        <View style={styles.contatoField}>
          <TextInput
            style={styles.contatoInput}
            placeholder="Nome"
            placeholderTextColor="#94A3B8"
            value={contato.nome}
            onChangeText={(value) => handleContatoChange(index, 'nome', value)}
          />
        </View>
        <View style={styles.contatoField}>
          <TextInput
            style={styles.contatoInput}
            placeholder="Telefone"
            placeholderTextColor="#94A3B8"
            value={contato.telefone}
            onChangeText={(value) => handleContatoChange(index, 'telefone', masks.phone(value))}
            keyboardType="phone-pad"
          />
        </View>
      </View>
    </View>
  ), [handleContatoChange, handleRemoveContato]);

  // ==========================================================================
  // MODAIS
  // ==========================================================================

  const renderModalEstado = () => (
    <Modal
      visible={modalEstadoVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalEstadoVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Estado</Text>
            <TouchableOpacity onPress={() => setModalEstadoVisible(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {carregandoEstados ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : (
            <FlatList
              data={estados}
              keyExtractor={(item) => item.sigla}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    formData.estado === item.sigla && styles.modalItemActive,
                  ]}
                  onPress={() => handleSelectEstado(item)}
                >
                  <Text style={[
                    styles.modalItemText,
                    formData.estado === item.sigla && styles.modalItemTextActive,
                  ]}>
                    {item.sigla} - {item.nome}
                  </Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  const renderModalCidade = () => (
    <Modal
      visible={modalCidadeVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalCidadeVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Cidade</Text>
            <TouchableOpacity onPress={() => setModalCidadeVisible(false)}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {!formData.estado ? (
            <View style={styles.modalLoading}>
              <Text style={styles.modalEmptyText}>Selecione um estado primeiro</Text>
            </View>
          ) : carregandoCidades ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : cidades.length === 0 ? (
            <View style={styles.modalLoading}>
              <Text style={styles.modalEmptyText}>Nenhuma cidade encontrada</Text>
            </View>
          ) : (
            <FlatList
              data={cidades}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    formData.cidade === item.nome && styles.modalItemActive,
                  ]}
                  onPress={() => handleSelectCidade(item)}
                >
                  <Text style={[
                    styles.modalItemText,
                    formData.cidade === item.nome && styles.modalItemTextActive,
                  ]}>
                    {item.nome}
                  </Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );

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
          {/* Tipo de Pessoa */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Pessoa</Text>
            <View style={styles.tipoPessoaContainer}>
              <TouchableOpacity
                style={[
                  styles.tipoPessoaButton,
                  tipoPessoa === 'Fisica' && styles.tipoPessoaButtonActive,
                ]}
                onPress={() => {
                  setFields({
                    tipoPessoa: 'Fisica',
                    cpfCnpj: '',
                    rgIe: '',
                  } as any);
                }}
              >
                <Text
                  style={[
                    styles.tipoPessoaText,
                    tipoPessoa === 'Fisica' && styles.tipoPessoaTextActive,
                  ]}
                >
                  Pessoa Física
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tipoPessoaButton,
                  tipoPessoa === 'Juridica' && styles.tipoPessoaButtonActive,
                ]}
                onPress={() => {
                  setFields({
                    tipoPessoa: 'Juridica',
                    cpfCnpj: '',
                    rgIe: '',
                  } as any);
                }}
              >
                <Text
                  style={[
                    styles.tipoPessoaText,
                    tipoPessoa === 'Juridica' && styles.tipoPessoaTextActive,
                  ]}
                >
                  Pessoa Jurídica
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Identificação */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identificação</Text>

            {renderInput(
              tipoPessoa === 'Fisica' ? 'Nome Completo' : 'Razão Social',
              'nomeExibicao',
              tipoPessoa === 'Fisica' ? 'João da Silva' : 'Empresa LTDA'
            )}

            {tipoPessoa === 'Juridica' && renderInput(
              'Nome Fantasia',
              'nomeFantasia',
              'Nome da empresa'
            )}

            {renderInput(
              tipoPessoa === 'Fisica' ? 'CPF' : 'CNPJ',
              'cpfCnpj',
              tipoPessoa === 'Fisica' ? '000.000.000-00' : '00.000.000/0000-00',
              {
                keyboardType: 'numeric',
                mask: tipoPessoa === 'Fisica' ? masks.cpf : masks.cnpj,
              }
            )}

            {renderInput(
              tipoPessoa === 'Fisica' ? 'RG' : 'Inscrição Estadual',
              'rgIe',
              tipoPessoa === 'Fisica' ? '00.000.000-0' : '000.000.000.000'
            )}
          </View>

          {/* Contato */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contato</Text>

            {renderInput(
              'Telefone Principal',
              'telefonePrincipal',
              '(00) 00000-0000',
              {
                keyboardType: 'phone-pad',
                mask: masks.phone,
              }
            )}

            {renderInput(
              'E-mail',
              'email',
              'email@exemplo.com',
              {
                keyboardType: 'email-address',
              }
            )}

            {/* Contatos Adicionais */}
            <View style={styles.contatosSection}>
              <View style={styles.contatosHeader}>
                <Text style={styles.contatosTitle}>Contatos Adicionais</Text>
                <TouchableOpacity
                  style={styles.addContatoButton}
                  onPress={handleAddContato}
                >
                  <Ionicons name="add-circle" size={24} color="#2563EB" />
                </TouchableOpacity>
              </View>
              {formData.contatos?.map((contato: any, index: number) =>
                renderContato(contato, index)
              )}
            </View>
          </View>

          {/* Endereço */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Endereço</Text>
              <TouchableOpacity
                style={[
                  styles.gpsButton,
                  localizacaoCapturada && styles.gpsButtonCaptured,
                ]}
                onPress={handleCapturarLocalizacao}
                disabled={capturandoLocalizacao}
              >
                {capturandoLocalizacao ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={localizacaoCapturada ? 'checkmark-circle' : 'navigate'}
                    size={18}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.gpsButtonText}>
                  {capturandoLocalizacao
                    ? 'Obtendo...'
                    : localizacaoCapturada
                    ? 'Localização capturada!'
                    : 'Usar GPS'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* CEP com busca */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CEP</Text>
              <View style={[styles.inputContainer, styles.cepContainer]}>
                <TextInput
                  style={styles.cepInput}
                  placeholder="00000-000"
                  placeholderTextColor="#94A3B8"
                  value={formData.cep || ''}
                  onChangeText={(value) => handleInputChange('cep', masks.cep(value))}
                  keyboardType="numeric"
                  maxLength={9}
                  onBlur={handleCepBlur}
                />
                {buscandoCep && (
                  <ActivityIndicator size="small" color="#2563EB" style={styles.cepLoader} />
                )}
                <TouchableOpacity
                  style={styles.cepButton}
                  onPress={handleCepBlur}
                  disabled={buscandoCep}
                >
                  <Ionicons name="search" size={20} color="#2563EB" />
                </TouchableOpacity>
              </View>
              <Text style={styles.cepHint}>Digite o CEP para buscar o endereço</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.flex2, styles.rowField]}>
                {renderInput(
                  'Logradouro',
                  'logradouro',
                  'Rua, Avenida, etc.'
                )}
              </View>
              <View style={[styles.flex1, styles.rowField]}>
                {renderInput(
                  'Número',
                  'numero',
                  '123',
                  { keyboardType: 'numeric' }
                )}
              </View>
            </View>

            {renderInput(
              'Complemento',
              'complemento',
              'Apto, Bloco, etc.'
            )}

            {renderInput(
              'Bairro',
              'bairro',
              'Nome do bairro'
            )}

            {/* Estado */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Estado *</Text>
              <TouchableOpacity
                style={[styles.inputContainer, errors.estado && styles.inputError]}
                onPress={() => setModalEstadoVisible(true)}
              >
                <Text style={[styles.selectText, !formData.estado && styles.selectPlaceholder]}>
                  {formData.estado
                    ? estados.find(e => e.sigla === formData.estado)?.nome || formData.estado
                    : 'Selecione o estado'
                  }
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748B" />
              </TouchableOpacity>
              {errors.estado && <Text style={styles.errorText}>{errors.estado}</Text>}
            </View>

            {/* Cidade */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cidade *</Text>
              <TouchableOpacity
                style={[styles.inputContainer, errors.cidade && styles.inputError]}
                onPress={() => formData.estado && setModalCidadeVisible(true)}
                disabled={!formData.estado}
              >
                <Text style={[styles.selectText, !formData.cidade && styles.selectPlaceholder]}>
                  {formData.cidade || 'Selecione a cidade'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={!formData.estado ? '#CBD5E1' : '#64748B'} />
              </TouchableOpacity>
              {errors.cidade && <Text style={styles.errorText}>{errors.cidade}</Text>}
              {!formData.estado && (
                <Text style={styles.fieldHint}>Selecione o estado primeiro</Text>
              )}
            </View>

            {/* Rota */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rota *</Text>
              <View style={[styles.inputContainer, errors.rotaId && styles.inputError]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rotasScroll}
                >
                  {rotas
                    .filter(r => user?.tipoPermissao === 'Administrador' || canAccessRota(r.id))
                    .map((rota) => (
                    <TouchableOpacity
                      key={rota.id}
                      style={[
                        styles.rotaChip,
                        String(formData.rotaId) === String(rota.id) && styles.rotaChipActive,
                      ]}
                      onPress={() => {
                        setFields({
                          rotaId: String(rota.id),
                          rotaNome: rota.descricao,
                        } as any);
                      }}
                    >
                      <Text
                        style={[
                          styles.rotaChipText,
                          String(formData.rotaId) === String(rota.id) && styles.rotaChipTextActive,
                        ]}
                      >
                        {rota.descricao}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {errors.rotaId && <Text style={styles.errorText}>{errors.rotaId}</Text>}
            </View>
          </View>

          <View style={styles.footer} />
        </ScrollView>

        {/* Botão Salvar */}
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
                  {modo === 'criar' ? 'Salvar Cliente' : 'Atualizar Cliente'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {renderModalEstado()}
      {renderModalCidade()}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS (mantidos iguais)
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
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 0,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  gpsButtonCaptured: {
    backgroundColor: '#16A34A',
  },
  gpsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tipoPessoaContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  tipoPessoaButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  tipoPessoaButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  tipoPessoaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tipoPessoaTextActive: {
    color: '#FFFFFF',
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
  inputContainer: {
    backgroundColor: '#FFFFFF',
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
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },
  cepContainer: {
    paddingVertical: 0,
  },
  cepInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    paddingVertical: 12,
  },
  cepLoader: {
    marginHorizontal: 8,
  },
  cepButton: {
    padding: 8,
  },
  cepHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  selectPlaceholder: {
    color: '#94A3B8',
  },
  fieldHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  rowField: {
    marginBottom: 0,
  },
  contatosSection: {
    marginTop: 12,
  },
  contatosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contatosTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  addContatoButton: {
    padding: 4,
  },
  contatoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contatoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contatoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  removeButton: {
    padding: 4,
  },
  contatoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  contatoField: {
    flex: 1,
  },
  contatoInput: {
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 8,
  },
  rotasScroll: {
    gap: 8,
  },
  rotaChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  rotaChipActive: {
    backgroundColor: '#2563EB',
  },
  rotaChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  rotaChipTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    height: 20,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 34,
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
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalItemActive: {
    backgroundColor: '#EFF6FF',
  },
  modalItemText: {
    fontSize: 15,
    color: '#1E293B',
  },
  modalItemTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
});
