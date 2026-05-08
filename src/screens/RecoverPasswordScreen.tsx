/**
 * RecoverPasswordScreen.tsx
 * Tela de recuperação de senha — fluxo completo:
 * 1. Usuário digita e-mail → API envia token de recuperação
 * 2. Usuário insere token + nova senha → API redefine a senha
 * Offline: mensagem orientando contactar o administrador.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { apiService } from '../services/ApiService';

type Props = NativeStackScreenProps<any, 'RecoverPassword'>;

type Step = 'email' | 'reset' | 'success';

export default function RecoverPasswordScreen({ navigation }: Props) {
  // Step 1 — Email
  const [email, setEmail] = useState('');
  // Step 2 — Reset
  const [resetToken, setResetToken] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  // Common
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ==========================================================================
  // STEP 1 — Enviar e-mail de recuperação
  // ==========================================================================

  const handleSendEmail = async () => {
    if (!email.trim()) {
      setErrorMessage('Digite seu e-mail');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiService.forgotPassword(email.trim().toLowerCase());

      if (response.success) {
        // API respondeu com sucesso — avançar para etapa de redefinição
        setStep('reset');
      } else {
        // Erro retornado pela API (ex.: rate-limit, e-mail não encontrado)
        // Por segurança, não revelamos se o e-mail existe — avançamos mesmo assim
        if (response.statusCode && response.statusCode >= 400 && response.statusCode < 500) {
          // Erro de cliente — não mostrar detalhes, apenas avançar
          setStep('reset');
        } else {
          setErrorMessage(response.error || 'Não foi possível enviar o e-mail de recuperação');
        }
      }
    } catch (error) {
      // Erro de rede — modo offline
      setStep('reset');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // STEP 2 — Redefinir senha com token
  // ==========================================================================

  const handleResetPassword = async () => {
    if (!resetToken.trim()) {
      setErrorMessage('Digite o código de recuperação');
      return;
    }
    if (!novaSenha.trim()) {
      setErrorMessage('Digite a nova senha');
      return;
    }
    if (novaSenha.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErrorMessage('As senhas não coincidem');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiService.resetPassword(
        resetToken.trim(),
        novaSenha,
        confirmarSenha,
      );

      if (response.success) {
        setStep('success');
      } else {
        setErrorMessage(response.error || 'Não foi possível redefinir a senha');
      }
    } catch (error) {
      // Erro de rede
      setErrorMessage('Sem conexão com o servidor. Tente novamente quando estiver online.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // SUCCESS
  // ==========================================================================

  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>Senha Redefinida!</Text>
          <Text style={styles.successText}>
            Sua senha foi alterada com sucesso. Você já pode fazer login com a nova senha.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.buttonText}>Ir para Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // STEP 2 — Formulário de redefinição
  // ==========================================================================

  if (step === 'reset') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => { setStep('email'); setErrorMessage(null); }}
            >
              <Ionicons name="arrow-back" size={24} color="#1E293B" />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Redefinir Senha</Text>
              <Text style={styles.subtitle}>
                Insira o código recebido por e-mail e defina sua nova senha
              </Text>
            </View>

            <View style={styles.form}>
              {/* Código de recuperação */}
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Código de recuperação"
                  placeholderTextColor="#94A3B8"
                  value={resetToken}
                  onChangeText={setResetToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Nova senha */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nova senha"
                  placeholderTextColor="#94A3B8"
                  value={novaSenha}
                  onChangeText={setNovaSenha}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              {/* Confirmar senha */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar nova senha"
                  placeholderTextColor="#94A3B8"
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Redefinindo...' : 'Redefinir Senha'}
                </Text>
              </TouchableOpacity>

              {/* Offline notice */}
              <View style={styles.offlineNotice}>
                <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
                <Text style={styles.offlineNoticeText}>
                  Sem conexão? Entre em contato com o administrador do sistema para redefinir sua senha.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // STEP 1 — Formulário de e-mail
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Recuperar Senha</Text>
          <Text style={styles.subtitle}>
            Digite seu e-mail para receber o código de recuperação
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendEmail}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Enviando...' : 'Enviar Código'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1E293B',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
  },
  button: {
    backgroundColor: '#2563EB',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
});
