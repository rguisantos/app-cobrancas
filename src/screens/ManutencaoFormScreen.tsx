/**
 * ManutencaoFormScreen.tsx
 * Formulário de cadastro/edição de manutenções / trocas de pano
 *
 * Funcionalidades:
 * - Seleção de produto (via ProdutoContext)
 * - Tipo: trocaPano | manutencao (radio select)
 * - Data (date picker)
 * - Descrição (multiline text)
 * - Cliente opcional (select from clientes)
 * - Modo criar / editar (com preenchimento de campos existentes)
 * - Delete com confirmação (modo editar)
 * - Permission guards client-side
 * - Audit logging em todas as mutações
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useManutencao } from '../contexts/ManutencaoContext';
import { useProduto } from '../contexts/ProdutoContext';
import { useCliente } from '../contexts/ClienteContext';
import { useAuth } from '../contexts/AuthContext';

// Hooks
import { usePermissionGuard } from '../hooks/usePermissionGuard';

// Services
import AuditService from '../services/AuditService';

// Components
import FormInput from '../components/forms/FormInput';
import FormSelect from '../components/forms/FormSelect';
import { FormRadioSelect } from '../components/forms/FormSelect';
import FormDatePicker from '../components/forms/FormDatePicker';
import FormSection from '../components/forms/FormSection';

// Types
import { Manutencao } from '../types';
import { ModalStackParamList } from '../navigation/AppNavigator';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type ManutencaoFormRouteProp = RouteProp<ModalStackParamList, 'ManutencaoForm'>;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function ManutencaoFormScreen() {
  const route = useRoute<ManutencaoFormRouteProp>();
  const navigation = useNavigation();
  const { registrar, atualizar, remover, manutencoes, carregando } = useManutencao();
  const { produtos, carregarProdutos } = useProduto();
  const { clientes, carregarClientes } = useCliente();
  const { user } = useAuth();
  const { canDo } = usePermissionGuard();

  const modo = route.params?.modo || 'criar';
  const produtoIdPreSelected = route.params?.produtoId;
  const manutencaoId = route.params?.manutencaoId;

  // Form state
  const [produtoId, setProdutoId] = useState<string | null>(produtoIdPreSelected || null);
  const [tipo, setTipo] = useState<'trocaPano' | 'manutencao'>('manutencao');
  const [data, setData] = useState<Date>(new Date());
  const [descricao, setDescricao] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ==========================================================================
  // CARREGAMENTO INICIAL
  // ==========================================================================

  useEffect(() => {
    carregarProdutos();
    carregarClientes();
  }, []);

  // ==========================================================================
  // CARREGAMENTO PARA EDIÇÃO
  // ==========================================================================

  useEffect(() => {
    if (modo === 'editar' && manutencaoId) {
      const manutencao = manutencoes.find(m => m.id === manutencaoId);
      if (manutencao) {
        setProdutoId(manutencao.produtoId || null);
        setTipo(manutencao.tipo || 'manutencao');
        setData(manutencao.data ? new Date(manutencao.data) : new Date());
        setDescricao(manutencao.descricao || '');
        setClienteId(manutencao.clienteId || null);
      }
    }
  }, [modo, manutencaoId, manutencoes]);

  // ==========================================================================
  // VALIDAÇÃO
  // ==========================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!produtoId) {
      newErrors.produtoId = 'Selecione um produto';
    }

    if (!data) {
      newErrors.data = 'Selecione uma data';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [produtoId, data]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSubmit = useCallback(async () => {
    // Permission guard
    if (!canDo('manutencoes', modo === 'criar' ? 'create' : 'edit')) {
      Alert.alert('Sem permissão', 'Você não tem permissão para realizar esta ação.');
      return;
    }

    // Validação
    if (!validate()) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    // Encontrar dados do produto selecionado
    const produtoSelecionado = produtos.find(p => String(p.id) === produtoId);
    const clienteSelecionado = clientes.find(c => String(c.id) === clienteId);

    try {
      if (modo === 'criar') {
        const dados: Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'> = {
          produtoId: produtoId!,
          produtoIdentificador: produtoSelecionado?.identificador,
          produtoTipo: produtoSelecionado?.tipoNome,
          clienteId: clienteId || undefined,
          clienteNome: clienteSelecionado?.nomeExibicao,
          tipo,
          descricao: descricao || undefined,
          data: data.toISOString(),
          registradoPor: user?.nome,
        };

        const registro = await registrar(dados);
        if (registro) {
          // Audit log
          await AuditService.logAction('registrar_manutencao', 'manutencao', registro.id, {
            produtoIdentificador: dados.produtoIdentificador,
            tipo: dados.tipo,
            data: dados.data,
          });
          Alert.alert('Sucesso', 'Manutenção registrada com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível registrar a manutenção');
        }
      } else {
        // Modo editar
        const dadosAtualizados: Partial<Omit<Manutencao, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'needsSync' | 'version' | 'deviceId' | 'lastSyncedAt' | 'deletedAt'>> = {
          produtoId: produtoId!,
          produtoIdentificador: produtoSelecionado?.identificador,
          produtoTipo: produtoSelecionado?.tipoNome,
          clienteId: clienteId || undefined,
          clienteNome: clienteSelecionado?.nomeExibicao,
          tipo,
          descricao: descricao || undefined,
          data: data.toISOString(),
        };

        const resultado = await atualizar(manutencaoId!, dadosAtualizados);
        if (resultado) {
          // Audit log
          await AuditService.logAction('editar_manutencao', 'manutencao', manutencaoId!, {
            produtoIdentificador: dadosAtualizados.produtoIdentificador,
            tipo: dadosAtualizados.tipo,
            data: dadosAtualizados.data,
          });
          Alert.alert('Sucesso', 'Manutenção atualizada com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar a manutenção');
        }
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar manutenção');
    }
  }, [modo, manutencaoId, produtoId, tipo, data, descricao, clienteId, produtos, clientes, user, canDo, validate, registrar, atualizar, navigation]);

  // ==========================================================================
  // DELETE
  // ==========================================================================

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Excluir Manutenção',
      'Tem certeza que deseja excluir esta manutenção? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const sucesso = await remover(manutencaoId!);
              if (sucesso) {
                await AuditService.logAction('excluir_manutencao', 'manutencao', manutencaoId!, {});
                Alert.alert('Sucesso', 'Manutenção excluída com sucesso', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Erro', 'Não foi possível excluir a manutenção');
              }
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir a manutenção');
            }
          },
        },
      ]
    );
  }, [manutencaoId, remover, navigation]);

  // ==========================================================================
  // OPÇÕES DE SELECT
  // ==========================================================================

  const produtoOptions = produtos.map(p => ({
    label: `${p.identificador} - ${p.tipoNome}${p.estaLocado ? ` (${p.clienteNome || 'Locado'})` : ''}`,
    value: String(p.id),
    icon: 'cube-outline' as keyof typeof Ionicons.glyphMap,
  }));

  const clienteOptions = [
    { label: 'Nenhum', value: '' },
    ...clientes.map(c => ({
      label: c.nomeExibicao,
      value: String(c.id),
      icon: 'person-outline' as keyof typeof Ionicons.glyphMap,
    })),
  ];

  const tipoOptions = [
    { label: 'Troca de Pano', value: 'trocaPano' as const, icon: 'swap-horizontal' as keyof typeof Ionicons.glyphMap },
    { label: 'Manutenção', value: 'manutencao' as const, icon: 'build' as keyof typeof Ionicons.glyphMap },
  ];

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
          {/* Informações do Produto */}
          <FormSection title="Produto" icon="cube-outline">
            <FormSelect
              label="Produto"
              value={produtoId}
              onValueChange={(value: string) => {
                setProdutoId(value);
                if (errors.produtoId) {
                  setErrors(prev => ({ ...prev, produtoId: '' }));
                }
              }}
              options={produtoOptions}
              placeholder="Selecione o produto"
              error={errors.produtoId}
              required
              searchable
            />
          </FormSection>

          {/* Tipo de Manutenção */}
          <FormSection title="Tipo" icon="build-outline">
            <FormRadioSelect
              label="Tipo de Registro"
              value={tipo}
              onValueChange={(value: 'trocaPano' | 'manutencao') => setTipo(value)}
              options={tipoOptions}
              required
            />
          </FormSection>

          {/* Data */}
          <FormSection title="Data" icon="calendar-outline">
            <FormDatePicker
              label="Data da Manutenção"
              value={data}
              onValueChange={(date: Date) => {
                setData(date);
                if (errors.data) {
                  setErrors(prev => ({ ...prev, data: '' }));
                }
              }}
              error={errors.data}
              required
            />
          </FormSection>

          {/* Descrição */}
          <FormSection title="Detalhes" icon="document-text-outline">
            <FormInput
              label="Descrição"
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Descreva a manutenção realizada..."
              multiline
              numberOfLines={4}
              autoCapitalize="sentences"
            />
          </FormSection>

          {/* Cliente (Opcional) */}
          <FormSection title="Cliente (Opcional)" icon="person-outline">
            <FormSelect
              label="Cliente"
              value={clienteId}
              onValueChange={(value: string) => setClienteId(value || null)}
              options={clienteOptions}
              placeholder="Selecione o cliente (opcional)"
              searchable
            />
          </FormSection>

          {/* Botão Excluir (só no modo editar) */}
          {modo === 'editar' && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={styles.deleteButtonText}>Excluir Manutenção</Text>
            </TouchableOpacity>
          )}

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
                  {modo === 'criar' ? 'Registrar Manutenção' : 'Atualizar Manutenção'}
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
    paddingBottom: 100,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
});
