/**
 * EnviarEstoqueScreen.tsx
 * Tela para enviar produto para estoque (desvincular do cliente)
 * 
 * Funcionalidades:
 * - Confirmação de produto e cliente
 * - Seleção de estabelecimento destino
 * - Motivo obrigatório
 * - Confirmação da ação
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
import { useAuth } from '../contexts/AuthContext';

// Types
import { ClientesStackParamList } from '../navigation/ClientesStack';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type EnviarEstoqueRouteProp = RouteProp<ClientesStackParamList, 'EnviarEstoque'>;

// ============================================================================
// ESTABELECIMENTOS DISPONÍVEIS (mock - em produção viriam da API)
// ============================================================================

const ESTABELECIMENTOS = [
  { id: '1', nome: 'Barracão Principal' },
  { id: '2', nome: 'Depósito Centro' },
  { id: '3', nome: 'Galpão Zona Sul' },  { id: '4', nome: 'Armazém Filial' },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function EnviarEstoqueScreen() {
  const route = useRoute<EnviarEstoqueRouteProp>();
  const navigation = useNavigation();
  const { finalizarLocacao } = useLocacao();
  const { produtoSelecionado, atualizarProduto } = useProduto();
  const { user } = useAuth();

  const { locacaoId, produtoId } = route.params;

  // Estado do formulário
  const [estabelecimento, setEstabelecimento] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);

  // ==========================================================================
  // VALIDAÇÕES
  // ==========================================================================

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!estabelecimento) {
      newErrors.estabelecimento = 'Estabelecimento é obrigatório';
  
  }

    if (!motivo.trim()) {
      newErrors.motivo = 'Motivo é obrigatório';
  
  }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleSelectEstabelecimento = useCallback((id: string) => {
    setEstabelecimento(id);
    if (errors.estabelecimento) {
      const { estabelecimento: _, ...rest } = errors;
      setErrors(rest as Record<string, string>);  
  }
  }, [errors.estabelecimento]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert('Erro', 'Por favor, preencha os campos obrigatórios');
      return;
  
  }

    // Confirmar ação
    Alert.alert(
      'Confirmar Envio para Estoque',
      'Tem certeza que deseja desvincular este produto do cliente e enviar para estoque?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            setCarregando(true);
            try {
              // 1. Finalizar locação
              const locacaoFinalizada = await finalizarLocacao(
                locacaoId,
                `Envio para estoque: ${motivo}`
              );

              if (!locacaoFinalizada) {
                throw new Error('Não foi possível finalizar a locação');
            
  }

              // 2. Atualizar produto para estoque
              const estabelecimentoNome = ESTABELECIMENTOS.find(e => e.id === estabelecimento)?.nome;
              
              const produtoAtualizado = await atualizarProduto({
                id: produtoId,
                estabelecimento: estabelecimentoNome,
                observacao: observacao || `Enviado para estoque: ${motivo}`,
                statusProduto: 'Ativo',
              });

              if (produtoAtualizado) {
                Alert.alert(
                  'Sucesso',
                  `Produto enviado para ${estabelecimentoNome}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack(),                    },
                  ]
                );
              } else {
                throw new Error('Não foi possível atualizar o produto');
            
  }
            } catch (error) {
              Alert.alert(
                'Erro',
                error instanceof Error ? error.message : 'Erro ao enviar para estoque'
              );
            } finally {
              setCarregando(false);
          
  }
          },
        },
      ]
    );
  }, [estabelecimento, motivo, observacao, locacaoId, produtoId, finalizarLocacao, atualizarProduto, navigation, errors]);

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
          {/* HEADER */}
          {/* ========================================================================== */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="arrow-undo" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.headerTitle}>Enviar para Estoque</Text>
            <Text style={styles.headerSubtitle}>
              Desvincular produto do cliente atual
            </Text>
          </View>

          {/* ========================================================================== */}
          {/* RESUMO DO PRODUTO */}          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Produto</Text>
            <View style={styles.sectionCard}>
              <View style={styles.produtoRow}>
                <View style={styles.produtoAvatar}>
                  <Ionicons name="cube" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.produtoInfo}>
                  <Text style={styles.produtoNome}>
                    {/* Em produção, buscar dados do produto */}
                    Produto N° {produtoId}
                  </Text>
                  <Text style={styles.produtoCliente}>
                    Cliente: {/* nome do cliente */}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================================== */}
          {/* ESTABELECIMENTO DESTINO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Destino *</Text>
            <View style={styles.sectionCard}>
              {ESTABELECIMENTOS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.estabelecimentoItem,
                    estabelecimento === item.id && styles.estabelecimentoItemSelected,
                  ]}
                  onPress={() => handleSelectEstabelecimento(item.id)}
                >
                  <View style={styles.estabelecimentoRadio}>
                    {estabelecimento === item.id && (
                      <View style={styles.estabelecimentoRadioSelected} />
                    )}
                  </View>
                  <Text style={styles.estabelecimentoNome}>{item.nome}</Text>
                </TouchableOpacity>
              ))}
              {errors.estabelecimento && (
                <Text style={styles.errorText}>{errors.estabelecimento}</Text>
              )}
            </View>
          </View>
          {/* ========================================================================== */}
          {/* MOTIVO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Motivo *</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Ex: Manutenção preventiva, Cliente cancelou, Produto danificado..."
                placeholderTextColor="#94A3B8"
                value={motivo}
                onChangeText={(value) => {
                  setMotivo(value);
                  if (errors.motivo) {
                    const { motivo: _, ...rest } = errors;
                    setErrors(rest as Record<string, string>);
                
  }
                }}
                multiline
                numberOfLines={3}
              />
              {errors.motivo && <Text style={styles.errorText}>{errors.motivo}</Text>}
            </View>
          </View>

          {/* ========================================================================== */}
          {/* OBSERVAÇÃO (OPCIONAL) */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observação (opcional)</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Informações adicionais..."
                placeholderTextColor="#94A3B8"
                value={observacao}
                onChangeText={setObservacao}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          {/* ========================================================================== */}
          {/* ALERTA DE CONFIRMAÇÃO */}
          {/* ========================================================================== */}
          <View style={styles.alertCard}>
            <Ionicons name="alert-circle" size={24} color="#DC2626" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Atenção</Text>
              <Text style={styles.alertText}>                Esta ação irá desvincular o produto do cliente atual. 
                A locação será finalizada e o produto ficará disponível para nova locação.
              </Text>
            </View>
          </View>

          {/* Espaço extra */}
          <View style={styles.footer} />
        </ScrollView>

        {/* ========================================================================== */}
        {/* BOTÃO CONFIRMAR */}
        {/* ========================================================================== */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!estabelecimento || !motivo.trim() || carregando) && styles.confirmButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!estabelecimento || !motivo.trim() || carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Confirmar Envio</Text>
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
  scrollView: {    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },

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
    shadowOpacity: 0.05,    shadowRadius: 4,
    elevation: 2,
  },

  // Produto
  produtoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  produtoAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  produtoInfo: {
    flex: 1,
  },
  produtoNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  produtoCliente: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },

  // Estabelecimento
  estabelecimentoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  estabelecimentoItemSelected: {
    borderBottomColor: '#2563EB',
  },
  estabelecimentoRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',    justifyContent: 'center',
    alignItems: 'center',
  },
  estabelecimentoRadioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  estabelecimentoNome: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },

  // Inputs
  input: {
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

  // Alert Card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  alertText: {    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
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
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: '#FCA5A5',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});