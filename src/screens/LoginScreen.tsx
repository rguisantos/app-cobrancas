/**
 * LoginScreen.tsx
 * Tela de autenticação do aplicativo
 * 
 * Funcionalidades:
 * - Login com email/senha
 * - Validação com Zod (espelha schemas do servidor)
 * - Feedback de conta bloqueada e rate limiting
 * - Opção de login biométrico
 * - Loading states
 * - Navegação para recuperação de senha
 * - Logo e branding
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

// Contexts
import { useAuth } from '../contexts/AuthContext';

// Types
import { AuthStackNavigationProp } from '../navigation/AppNavigator';

// ============================================================================
// VALIDAÇÃO ZOD (espelha o schema do servidor)
// ============================================================================

const loginFormSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

type LoginForm = z.infer<typeof loginFormSchema>;

interface FormErrors {
  email?: string;
  senha?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function LoginScreen() {
  const navigation = useNavigation<AuthStackNavigationProp>();
  const { login, isLoading, lockoutInfo, biometricLogin, isBiometricAvailable } = useAuth();

  // Estado do formulário
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    senha: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Verificar biometria disponível
  useEffect(() => {
    isBiometricAvailable().then(({ available }) => {
      setBiometricAvailable(available);
    });
  }, []);

  // ==========================================================================
  // VALIDAÇÕES
  // ==========================================================================

  const validateForm = (): boolean => {
    const result = loginFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof FormErrors;
        if (!fieldErrors[field]) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleInputChange = useCallback((field: keyof LoginForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const handleLogin = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(formData.email, formData.senha);
      // Navegação é tratada pelo AuthContext
    } catch (error: any) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      
      // Verificar se é erro de lockout (informação já está no context)
      if (lockoutInfo?.locked) {
        // O feedback já é mostrado via lockoutInfo do context
        return;
      }
      
      Alert.alert('Erro', mensagem, [{ text: 'OK' }]);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, login, lockoutInfo]);

  const handleBiometricLogin = useCallback(async () => {
    try {
      const success = await biometricLogin();
      if (!success) {
        // Biometria falhou ou foi cancelada — não mostrar erro
        // O usuário pode tentar novamente ou usar senha
      }
    } catch {
      // Falha na biometria — usuário volta para login com senha
    }
  }, [biometricLogin]);

  const handleRecoverPassword = useCallback(() => {
    navigation.navigate('RecoverPassword');
  }, [navigation]);

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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo e Branding */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="wallet" size={64} color="#2563EB" />
              <Text style={styles.appName}>App Cobranças</Text>
              <Text style={styles.appSubtitle}>Gestão de Locações</Text>
            </View>
          </View>

          {/* Alerta de Conta Bloqueada */}
          {lockoutInfo?.locked && (
            <View style={styles.lockoutBanner}>
              <Ionicons name="lock-closed" size={20} color="#D97706" />
              <View style={styles.lockoutText}>
                <Text style={styles.lockoutTitle}>Conta temporariamente bloqueada</Text>
                <Text style={styles.lockoutDesc}>
                  Por segurança, aguarde {lockoutInfo.minutosRestantes} minutos antes de tentar novamente.
                </Text>
              </View>
            </View>
          )}

          {/* Botão Biométrico */}
          {biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={isSubmitting || isLoading}
              activeOpacity={0.7}
            >
              <Ionicons name="finger-print-outline" size={28} color="#2563EB" />
              <Text style={styles.biometricText}>Entrar com biometria</Text>
            </TouchableOpacity>
          )}

          {/* Divisor biométrico */}
          {biometricAvailable && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou use sua senha</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Formulário */}
          <View style={styles.form}>
            {/* Campo E-mail */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>E-mail</Text>
              <View style={[styles.inputContainer, errors.email && styles.inputError]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={errors.email ? '#DC2626' : '#64748B'} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor="#94A3B8"
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Campo Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={[styles.inputContainer, errors.senha && styles.inputError]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={errors.senha ? '#DC2626' : '#64748B'} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={formData.senha}
                  onChangeText={(value) => handleInputChange('senha', value)}
                  secureTextEntry={!showPassword}
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
              {errors.senha && <Text style={styles.errorText}>{errors.senha}</Text>}
            </View>

            {/* Link Recuperar Senha */}
            <TouchableOpacity
              style={styles.recoverLink}
              onPress={handleRecoverPassword}
              disabled={isSubmitting}
            >
              <Text style={styles.recoverText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {/* Botão Entrar */}
            <TouchableOpacity
              style={[
                styles.button,
                (isSubmitting || isLoading || lockoutInfo?.locked) && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isSubmitting || isLoading || !!lockoutInfo?.locked}
              activeOpacity={0.8}
            >
              {isSubmitting || isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Entrar</Text>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerVersion}>
              Versão 1.0.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  // Header
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },

  // Lockout Banner
  lockoutBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  lockoutText: {
    flex: 1,
  },
  lockoutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  lockoutDesc: {
    fontSize: 13,
    color: '#B45309',
  },

  // Biometric
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#94A3B8',
  },

  // Form
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
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
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 4,
  },

  // Recover Link
  recoverLink: {
    alignSelf: 'flex-end',
  },
  recoverText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },

  // Button
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 40,
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 11,
    color: '#CBD5E1',
  },
});
