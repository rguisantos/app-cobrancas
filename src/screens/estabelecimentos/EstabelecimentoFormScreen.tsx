/**
 * EstabelecimentoFormScreen.tsx
 * Formulário de cadastro/edição de estabelecimentos
 *
 * Funcionalidades:
 * - Campos: nome, endereco, observacao
 * - Modo criar / editar
 * - Usa EstabelecimentoContext para salvar/atualizar
 * - Validação de nome obrigatório e duplicidade
 * - Delete com confirmação (modo editar)
 * - Permission guard: manutencoes
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
import { useEstabelecimento } from '../../contexts/EstabelecimentoContext';

// Hooks
import { usePermissionGuard } from '../../hooks/usePermissionGuard';

// Components
import FormInput from '../../components/forms/FormInput';
import FormSection from '../../components/forms/FormSection';

// Types
import { ModalStackParamList } from '../../navigation/AppNavigator';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type EstabelecimentoFormRouteProp = RouteProp<
  ModalStackParamList,
  'EstabelecimentoForm'
>;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function EstabelecimentoFormScreen() {
  const route = useRoute<EstabelecimentoFormRouteProp>();
  const navigation = useNavigation();
  const { adicionar, atualizar, remover, nomeExiste, carregando } = useEstabelecimento();
  const { canDo } = usePermissionGuard();

  const modo = route.params?.modo || 'criar';
  const estabelecimentoId = route.params?.estabelecimentoId;
  const estabelecimentoNome = route.params?.estabelecimentoNome || '';
  const estabelecimentoEndereco = route.params?.estabelecimentoEndereco || '';
  const estabelecimentoObservacao = route.params?.estabelecimentoObservacao || '';

  // Form state
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [observacao, setObservacao] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ==========================================================================
  // CARREGAMENTO PARA EDIÇÃO
  // ==========================================================================

  useEffect(() => {
    if (modo === 'editar' && estabelecimentoId) {
      setNome(estabelecimentoNome);
      setEndereco(estabelecimentoEndereco);
      setObservacao(estabelecimentoObservacao);
    }
  }, [modo, estabelecimentoId, estabelecimentoNome, estabelecimentoEndereco, estabelecimentoObservacao]);

  // ==========================================================================
  // VALIDAÇÃO
  // ==========================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [nome]);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  const handleSubmit = useCallback(async () => {
    // Permission guard
    if (!canDo('manutencoes', modo === 'criar' ? 'create' : 'edit')) {
      Alert.alert('Sem permissão', 'Você não tem permissão para realizar esta ação.');
      return;
    }

    if (!validate()) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    // Verificar duplicidade de nome
    const duplicado = await nomeExiste(nome.trim(), modo === 'editar' ? estabelecimentoId : undefined);
    if (duplicado) {
      Alert.alert('Erro', 'Já existe um estabelecimento com este nome');
      return;
    }

    try {
      if (modo === 'criar') {
        const item = await adicionar(nome.trim(), endereco.trim() || undefined, observacao.trim() || undefined);
        if (item) {
          Alert.alert('Sucesso', 'Estabelecimento criado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível criar o estabelecimento');
        }
      } else {
        // Editar
        const sucesso = await atualizar(estabelecimentoId!, nome.trim(), endereco.trim() || undefined, observacao.trim() || undefined);
        if (sucesso) {
          Alert.alert('Sucesso', 'Estabelecimento atualizado com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar o estabelecimento');
        }
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar estabelecimento');
    }
  }, [modo, estabelecimentoId, nome, endereco, observacao, adicionar, atualizar, nomeExiste, navigation, canDo, validate]);

  // ==========================================================================
  // DELETE
  // ==========================================================================

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Excluir Estabelecimento',
      `Tem certeza que deseja excluir "${nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const sucesso = await remover(estabelecimentoId!);
              if (sucesso) {
                Alert.alert('Sucesso', 'Estabelecimento excluído com sucesso', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Erro', 'Não foi possível excluir o estabelecimento');
              }
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir o estabelecimento');
            }
          },
        },
      ]
    );
  }, [estabelecimentoId, nome, remover, navigation]);

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {modo === 'criar' ? 'Novo Estabelecimento' : 'Editar Estabelecimento'}
            </Text>
          </View>

          {/* Informações */}
          <FormSection title="Informações" icon="business-outline">
            <FormInput
              label="Nome"
              value={nome}
              onChangeText={(value) => {
                setNome(value);
                if (errors.nome) setErrors(prev => ({ ...prev, nome: '' }));
              }}
              placeholder="Ex: Barracão Principal, Depósito Centro"
              error={errors.nome}
              required
              autoCapitalize="words"
            />

            <FormInput
              label="Endereço"
              value={endereco}
              onChangeText={setEndereco}
              placeholder="Ex: Rua Principal, 123 - Centro"
              autoCapitalize="words"
            />

            <FormInput
              label="Observação"
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Anotações sobre o estabelecimento..."
              multiline
              numberOfLines={3}
              autoCapitalize="sentences"
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
              <Text style={styles.deleteButtonText}>Excluir Estabelecimento</Text>
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
                  {modo === 'criar' ? 'Salvar Estabelecimento' : 'Atualizar Estabelecimento'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
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
