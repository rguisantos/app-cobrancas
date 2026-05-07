/**
 * ProdutoAlterarRelogioScreen.tsx
 * Tela para alterar o número do relógio de um produto
 * 
 * Funcionalidades:
 * - Carregar dados atuais do produto
 * - Registrar alteração no histórico
 * - Atualizar o produto
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';
import { produtoRepository } from '../repositories/ProdutoRepository';
import { useAuth } from '../contexts/AuthContext';
import { Produto } from '../types';

type Props = NativeStackScreenProps<ModalStackParamList, 'ProdutoAlterarRelogio'>;

export default function ProdutoAlterarRelogioScreen({ route, navigation }: Props) {
  const { produtoId } = route.params;
  const { user } = useAuth();
  
  const [produto, setProduto] = useState<Produto | null>(null);
  const [relogioAnterior, setRelogioAnterior] = useState('');
  const [relogioNovo, setRelogioNovo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [carregandoProduto, setCarregandoProduto] = useState(true);

  // Carregar dados do produto
  useEffect(() => {
    carregarProduto();
  }, [produtoId]);

  const carregarProduto = async () => {
    try {
      setCarregandoProduto(true);
      const produtoData = await produtoRepository.getById(produtoId);
      if (produtoData) {
        setProduto(produtoData);
        setRelogioAnterior(produtoData.numeroRelogio || '');
      } else {
        Alert.alert('Erro', 'Produto não encontrado');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Erro ao carregar produto:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do produto');
      navigation.goBack();
    } finally {
      setCarregandoProduto(false);
    }
  };

  const handleSalvar = async () => {
    if (!relogioNovo.trim()) {
      Alert.alert('Erro', 'Digite o novo número do relógio');
      return;
    }

    if (!motivo.trim()) {
      Alert.alert('Erro', 'Digite o motivo da alteração');
      return;
    }

    if (relogioNovo === relogioAnterior) {
      Alert.alert('Aviso', 'O novo número é igual ao número atual');
      return;
    }

    setLoading(true);
    try {
      const sucesso = await produtoRepository.atualizarNumeroRelogio(
        produtoId,
        relogioNovo.trim(),
        motivo.trim(),
        user?.nome || 'Usuário'
      );

      if (sucesso) {
        Alert.alert('Sucesso', 'Número do relógio alterado. A mudança será enviada na próxima sincronização.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Erro', 'Não foi possível alterar o número do relógio');
      }
    } catch (error) {
      console.error('Erro ao alterar relógio:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar a alteração');
    } finally {
      setLoading(false);
    }
  };

  if (carregandoProduto) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando produto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info do Produto */}
        {produto && (
          <View style={styles.produtoCard}>
            <View style={styles.produtoIcon}>
              <Ionicons name="cube" size={24} color="#2563EB" />
            </View>
            <View style={styles.produtoInfo}>
              <Text style={styles.produtoTipo}>{produto.tipoNome}</Text>
              <Text style={styles.produtoId}>N° {produto.identificador}</Text>
              <Text style={styles.produtoDesc}>
                {produto.descricaoNome} - {produto.tamanhoNome}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2563EB" />
          <Text style={styles.infoText}>
            Altere o número do relógio/contador do produto. Esta ação será registrada no histórico.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Número do Relógio Atual</Text>
          <View style={styles.inputDisabled}>
            <Text style={styles.inputDisabledText}>{relogioAnterior || 'Não definido'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Novo Número do Relógio *</Text>
          <TextInput
            style={[styles.input, styles.inputRequired]}
            placeholder="Ex: 9150"
            placeholderTextColor="#94A3B8"
            value={relogioNovo}
            onChangeText={setRelogioNovo}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Motivo da Alteração *</Text>
          <TextInput
            style={[styles.textArea, styles.inputRequired]}
            placeholder="Descreva o motivo da alteração..."
            placeholderTextColor="#94A3B8"
            value={motivo}
            onChangeText={setMotivo}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.buttonDisabled]}
            onPress={handleSalvar}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Salvar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  produtoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  produtoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  produtoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  produtoTipo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  produtoId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  produtoDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
  },
  inputDisabledText: {
    fontSize: 16,
    color: '#64748B',
  },
  inputRequired: {
    borderColor: '#2563EB',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 120,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 2,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
