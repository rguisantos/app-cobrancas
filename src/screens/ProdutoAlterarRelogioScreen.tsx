/**
 * ProdutoAlterarRelogioScreen.tsx
 * Tela para alterar o número do relógio de um produto
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<ModalStackParamList, 'ProdutoAlterarRelogio'>;

export default function ProdutoAlterarRelogioScreen({ route, navigation }: Props) {
  const { produtoId } = route.params;
  
  const [relogioAnterior, setRelogioAnterior] = useState('');
  const [relogioNovo, setRelogioNovo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    if (!relogioNovo.trim()) {
      Alert.alert('Erro', 'Digite o novo número do relógio');
      return;
  
  }

    if (!motivo.trim()) {
      Alert.alert('Erro', 'Digite o motivo da alteração');
      return;
  
  }

    setLoading(true);
    try {
      // TODO: Implementar alteração via API/Database
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Sucesso', 'Número do relógio alterado com sucesso', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível alterar o número do relógio');
    } finally {
      setLoading(false);
  
  }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2563EB" />
          <Text style={styles.infoText}>
            Altere o número do relógio/contador do produto. Esta ação será registrada no histórico.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Número do Relógio Anterior</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 8070"
            placeholderTextColor="#94A3B8"
            value={relogioAnterior}
            onChangeText={setRelogioAnterior}
            keyboardType="numeric"
          />
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
            <Ionicons name="save-outline" size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Text>
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
