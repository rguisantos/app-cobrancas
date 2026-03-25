/**
 * DeviceActivationScreen.tsx
 * Tela para ativação do dispositivo com senha de 6 dígitos
 * 
 * Fluxo:
 * 1. Usuário faz login no app
 * 2. Se dispositivo não está ativado, esta tela é mostrada
 * 3. Usuário digita o ID do dispositivo e a senha de 6 dígitos
 * 4. Dispositivo é ativado e pode sincronizar
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

import { apiService } from '../services/ApiService';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

export default function DeviceActivationScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  // Estados
  const [dispositivoId, setDispositivoId] = useState('');
  const [senha, setSenha] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  
  // Refs para os inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Animação
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Gerar chave única do dispositivo
  const generateDeviceKey = async (): Promise<string> => {
    try {
      const deviceId = Device.modelId || 
                       `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const manufacturer = Device.manufacturer || 'unknown';
      const model = Device.modelName || Device.modelId || 'unknown';
      const osVersion = Device.osVersion || 'unknown';
      
      // Formato: manufacturer_model_osVersion_deviceId
      const key = `${manufacturer}_${model}_${osVersion}_${deviceId}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .substring(0, 100);
      
      return key;
    } catch (error) {
      console.error('[DeviceActivation] Erro ao gerar device key:', error);
      return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  };
  
  // Obter nome amigável do dispositivo
  const getDeviceName = (): string => {
    try {
      const manufacturer = Device.manufacturer || '';
      const model = Device.modelName || Device.modelId || '';
      const usuario = user?.nome?.split(' ')[0] || 'Usuário';
      
      return `${model} de ${usuario} (${manufacturer})`.trim();
    } catch {
      return `Dispositivo de ${user?.nome?.split(' ')[0] || 'Usuário'}`;
    }
  };
  
  // Lidar com mudança de dígito
  const handleSenhaChange = (text: string, index: number) => {
    // Permitir apenas números
    const value = text.replace(/[^0-9]/g, '');
    
    if (value.length <= 1) {
      const newSenha = [...senha];
      newSenha[index] = value;
      setSenha(newSenha);
      setErro(null);
      
      // Avançar para próximo campo
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
      
      // Se completou todos os campos, tentar ativar
      if (index === 5 && value) {
        Keyboard.dismiss();
      }
    }
  };
  
  // Lidar com tecla de voltar
  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !senha[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };
  
  // Animação de shake
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };
  
  // Tentar ativar dispositivo
  const handleAtivar = async () => {
    const senhaCompleta = senha.join('');
    
    if (!dispositivoId.trim()) {
      setErro('Digite o ID do dispositivo');
      shake();
      return;
    }
    
    if (senhaCompleta.length !== 6) {
      setErro('Digite todos os 6 dígitos da senha');
      shake();
      return;
    }
    
    setLoading(true);
    setErro(null);
    
    try {
      const deviceKey = await generateDeviceKey();
      const deviceName = getDeviceName();
      
      console.log('[DeviceActivation] Tentando ativar dispositivo:', {
        dispositivoId,
        deviceKey,
        deviceName,
      });
      
      // Fazer requisição de ativação
      const response = await apiService.ativarDispositivo({
        dispositivoId: dispositivoId.trim(),
        deviceKey,
        deviceName,
        senhaNumerica: senhaCompleta,
      });
      
      if (response.success && response.data?.success) {
        // Salvar informações do dispositivo localmente
        await AsyncStorage.setItem('@device:id', dispositivoId.trim());
        await AsyncStorage.setItem('@device:key', deviceKey);
        await AsyncStorage.setItem('@device:name', deviceName);
        await AsyncStorage.setItem('@device:activated', 'true');
        
        console.log('[DeviceActivation] Dispositivo ativado com sucesso!');
        
        Alert.alert(
          'Sucesso!',
          'Dispositivo ativado com sucesso. Você já pode sincronizar seus dados.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Recarregar o app para aplicar a ativação
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Main' }],
                });
              },
            },
          ]
        );
      } else {
        const errorMsg = response.error || 'Falha ao ativar dispositivo';
        setErro(errorMsg);
        shake();
        console.error('[DeviceActivation] Erro na ativação:', errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro de conexão';
      setErro(errorMsg);
      shake();
      console.error('[DeviceActivation] Erro:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Limpar senha
  const handleLimpar = () => {
    setSenha(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Ícone */}
        <View style={styles.iconContainer}>
          <Ionicons name="phone-portrait-outline" size={64} color="#2563EB" />
        </View>
        
        {/* Título */}
        <Text style={styles.title}>Ativar Dispositivo</Text>
        <Text style={styles.subtitle}>
          Digite o ID do dispositivo e a senha de 6 dígitos fornecida pelo administrador
        </Text>
        
        {/* Campo ID do dispositivo */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>ID do Dispositivo</Text>
          <TextInput
            style={styles.idInput}
            value={dispositivoId}
            onChangeText={setDispositivoId}
            placeholder="Ex: dev_123456789_abc"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        
        {/* Campos de senha */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Senha de Ativação (6 dígitos)</Text>
          <Animated.View style={[styles.senhaContainer, { transform: [{ translateX: shakeAnim }] }]}>
            {senha.map((digito, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref }}
                style={[
                  styles.senhaInput,
                  digito ? styles.senhaInputFilled : null,
                  erro ? styles.senhaInputError : null,
                ]}
                value={digito}
                onChangeText={(text) => handleSenhaChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                textContentType="oneTimeCode"
              />
            ))}
          </Animated.View>
        </View>
        
        {/* Mensagem de erro */}
        {erro && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        )}
        
        {/* Botões */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleLimpar}
            disabled={loading}
          >
            <Text style={styles.buttonSecondaryText}>Limpar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={handleAtivar}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.buttonPrimaryText}>Ativando...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.buttonPrimaryText}>Ativar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Instruções */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Como obter a senha?</Text>
          <Text style={styles.instructionsText}>
            1. O administrador deve cadastrar seu dispositivo no painel web{'\n'}
            2. O sistema gerará uma senha de 6 dígitos{'\n'}
            3. O administrador compartilhará o ID e a senha com você{'\n'}
            4. Digite o ID e a senha acima para ativar
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  idInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
  },
  senhaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  senhaInput: {
    width: (width - 48 - 40) / 6,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1E293B',
  },
  senhaInputFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  senhaInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#2563EB',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  instructionsContainer: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
});
