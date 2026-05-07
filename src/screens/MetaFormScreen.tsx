/**
 * MetaFormScreen.tsx
 * Formulário de cadastro/edição de metas
 *
 * Funcionalidades:
 * - Campos: Nome, Tipo, Valor Meta, Data Início, Data Fim, Rota (opcional)
 * - Modo criar / editar
 * - Permission guard: relatorios
 * - Usa FormInput, FormRadioSelect, FormDatePicker, FormSelect
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useMeta } from '../contexts/MetaContext';
import { useRota } from '../contexts/RotaContext';

// Hooks
import { usePermissionGuard } from '../hooks/usePermissionGuard';

// Types
import { Meta, TipoMeta } from '../types';

// Components
import FormInput from '../components/forms/FormInput';
import { FormRadioSelect } from '../components/forms/FormSelect';
import FormDatePicker from '../components/forms/FormDatePicker';
import FormSelect from '../components/forms/FormSelect';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type MetaFormRouteProp = RouteProp<
  { MetaForm: { modo: 'criar' | 'editar'; metaId?: string } },
  'MetaForm'
>;

// ============================================================================
// OPÇÕES
// ============================================================================

const TIPO_OPTIONS = [
  { label: 'Receita', value: 'receita' as TipoMeta },
  { label: 'Cobranças', value: 'cobrancas' as TipoMeta },
  { label: 'Adimplência', value: 'adimplencia' as TipoMeta },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MetaFormScreen() {
  const route = useRoute<MetaFormRouteProp>();
  const navigation = useNavigation();
  const { metas, salvar, atualizar, carregando } = useMeta();
  const { rotas } = useRota();
  const { canDo } = usePermissionGuard();

  const modo = route.params?.modo || 'criar';
  const metaId = route.params?.metaId;

  // Form state
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoMeta>('receita');
  const [valorMeta, setValorMeta] = useState('');
  const [dataInicio, setDataInicio] = useState<Date | null>(null);
  const [dataFim, setDataFim] = useState<Date | null>(null);
  const [rotaId, setRotaId] = useState<string | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ==========================================================================
  // CARREGAMENTO PARA EDIÇÃO
  // ==========================================================================

  useEffect(() => {
    if (modo === 'editar' && metaId) {
      const meta = metas.find((m) => m.id === metaId);
      if (meta) {
        setNome(meta.nome);
        setTipo(meta.tipo);
        setValorMeta(String(meta.valorMeta));
        setDataInicio(meta.dataInicio ? new Date(meta.dataInicio) : null);
        setDataFim(meta.dataFim ? new Date(meta.dataFim) : null);
        setRotaId(meta.rotaId || null);
      }
    }
  }, [modo, metaId, metas]);

  // ==========================================================================
  // VALIDAÇÃO
  // ==========================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!valorMeta || isNaN(parseFloat(valorMeta)) || parseFloat(valorMeta) <= 0) {
      newErrors.valorMeta = 'Valor da meta deve ser maior que zero';
    }

    if (!dataInicio) {
      newErrors.dataInicio = 'Data de início é obrigatória';
    }

    if (!dataFim) {
      newErrors.dataFim = 'Data de fim é obrigatória';
    }

    if (dataInicio && dataFim && dataFim <= dataInicio) {
      newErrors.dataFim = 'Data de fim deve ser posterior à data de início';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [nome, valorMeta, dataInicio, dataFim]);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  const handleSubmit = useCallback(async () => {
    // Permission guard
    if (!canDo('relatorios', modo === 'criar' ? 'create' : 'edit')) {
      Alert.alert('Sem permissão', 'Você não tem permissão para realizar esta ação.');
      return;
    }

    if (!validate()) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    try {
      const valorMetaNum = parseFloat(valorMeta);

      if (modo === 'criar') {
        await salvar({
          nome: nome.trim(),
          tipo,
          valorMeta: valorMetaNum,
          valorAtual: 0,
          dataInicio: dataInicio!.toISOString(),
          dataFim: dataFim!.toISOString(),
          rotaId: rotaId || undefined,
          status: 'ativa',
        });
        Alert.alert('Sucesso', 'Meta criada com sucesso', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Buscar meta existente para manter valorAtual
        const metaExistente = metas.find((m) => m.id === metaId);
        if (!metaExistente) {
          Alert.alert('Erro', 'Meta não encontrada');
          return;
        }

        const metaAtualizada: Meta = {
          ...metaExistente,
          nome: nome.trim(),
          tipo,
          valorMeta: valorMetaNum,
          dataInicio: dataInicio!.toISOString(),
          dataFim: dataFim!.toISOString(),
          rotaId: rotaId || undefined,
        };

        await atualizar(metaAtualizada);
        Alert.alert('Sucesso', 'Meta atualizada com sucesso', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar meta');
    }
  }, [modo, metaId, nome, tipo, valorMeta, dataInicio, dataFim, rotaId, metas, salvar, atualizar, navigation, canDo, validate]);

  // ==========================================================================
  // OPÇÕES DE ROTA
  // ==========================================================================

  const rotaOptions = [
    { label: 'Todas as rotas (global)', value: '' },
    ...rotas.map((rota) => ({
      label: rota.descricao,
      value: rota.id,
    })),
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {modo === 'criar' ? 'Nova Meta' : 'Editar Meta'}
            </Text>
          </View>

          {/* Nome */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações</Text>

            <FormInput
              label="Nome da Meta"
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: Meta Janeiro 2024"
              error={errors.nome}
              required
              autoCapitalize="words"
            />

            {/* Tipo */}
            <FormRadioSelect<TipoMeta>
              label="Tipo de Meta"
              value={tipo}
              onValueChange={setTipo}
              options={TIPO_OPTIONS}
              required
            />

            {/* Valor Meta */}
            <FormInput
              label="Valor da Meta"
              value={valorMeta}
              onChangeText={setValorMeta}
              placeholder="0,00"
              error={errors.valorMeta}
              required
              keyboardType="numeric"
              leftIcon="cash-outline"
            />
          </View>

          {/* Período */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Período</Text>

            <FormDatePicker
              label="Data de Início"
              value={dataInicio}
              onValueChange={setDataInicio}
              error={errors.dataInicio}
              required
            />

            <FormDatePicker
              label="Data de Fim"
              value={dataFim}
              onValueChange={setDataFim}
              error={errors.dataFim}
              required
              minimumDate={dataInicio || undefined}
            />
          </View>

          {/* Rota */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rota (Opcional)</Text>

            <FormSelect
              label="Rota"
              value={rotaId || ''}
              onValueChange={(val: string) => setRotaId(val || null)}
              options={rotaOptions}
              placeholder="Todas as rotas (global)"
            />
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
                  {modo === 'criar' ? 'Salvar Meta' : 'Atualizar Meta'}
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
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
});
