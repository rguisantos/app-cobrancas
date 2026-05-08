/**
 * PerfilScreen.tsx
 * Tela de visualização/edição do perfil do usuário logado
 *
 * Funcionalidades:
 * - Exibir dados do usuário (nome, email, telefone, tipoPermissao)
 * - Editar nome e telefone
 * - Alterar senha (senhaAtual, novaSenha, confirmarSenha)
 * - Usa UsuarioRepository para atualizações locais
 * - Usa ApiService.alterarSenha() para alteração de senha no servidor
 */

import React, { useState, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useAuth } from '../../contexts/AuthContext';

// Repository
import { usuarioRepository } from '../../repositories/UsuarioRepository';

// Services
import { apiService } from '../../services/ApiService';
import AuditService from '../../services/AuditService';

// Components
import FormInput from '../../components/forms/FormInput';
import FormSection from '../../components/forms/FormSection';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function PerfilScreen() {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();

  // Profile edit state
  const [nome, setNome] = useState(user?.nome || '');
  const [telefone, setTelefone] = useState(user?.telefone || '');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  // Password change state
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  // Errors
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // ==========================================================================
  // PERMISSÃO LABEL
  // ==========================================================================

  const getTipoPermissaoLabel = (tipo: string | undefined) => {
    const labels: Record<string, string> = {
      'Administrador': 'Administrador',
      'Secretario': 'Secretário',
      'AcessoControlado': 'Acesso Controlado',
    };
    return tipo ? (labels[tipo] || tipo) : '';
  };

  const getTipoPermissaoColor = (tipo: string | undefined) => {
    const colors: Record<string, string> = {
      'Administrador': '#2563EB',
      'Secretario': '#16A34A',
      'AcessoControlado': '#F59E0B',
    };
    return tipo ? (colors[tipo] || '#64748B') : '#64748B';
  };

  // ==========================================================================
  // SALVAR PERFIL
  // ==========================================================================

  const handleSaveProfile = useCallback(async () => {
    // Validação
    const newErrors: Record<string, string> = {};
    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }
    setProfileErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    setSalvandoPerfil(true);
    try {
      await usuarioRepository.update({
        id: user!.id,
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ''),
      });

      // Audit log
      await AuditService.logAction('editar_perfil', 'usuario', user!.id, {
        nome: nome.trim(),
      });

      // Refresh user in context
      await refreshUser();

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao atualizar perfil');
    } finally {
      setSalvandoPerfil(false);
    }
  }, [nome, telefone, user, refreshUser]);

  // ==========================================================================
  // ALTERAR SENHA
  // ==========================================================================

  const handleChangePassword = useCallback(async () => {
    // Validação
    const newErrors: Record<string, string> = {};
    if (!senhaAtual.trim()) {
      newErrors.senhaAtual = 'Senha atual é obrigatória';
    }
    if (!novaSenha.trim()) {
      newErrors.novaSenha = 'Nova senha é obrigatória';
    } else if (novaSenha.trim().length < 6) {
      newErrors.novaSenha = 'Nova senha deve ter no mínimo 6 caracteres';
    }
    if (!confirmarSenha.trim()) {
      newErrors.confirmarSenha = 'Confirmação é obrigatória';
    } else if (novaSenha !== confirmarSenha) {
      newErrors.confirmarSenha = 'As senhas não coincidem';
    }
    setPasswordErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    setAlterandoSenha(true);
    try {
      // Tentar alterar via API (servidor)
      const response = await apiService.alterarSenha(senhaAtual, novaSenha);

      if (response.success) {
        // Também atualizar localmente
        await usuarioRepository.definirSenha(user!.id, novaSenha);

        // Audit log
        await AuditService.logAction('alterar_senha', 'usuario', user!.id, {});

        Alert.alert('Sucesso', 'Senha alterada com sucesso');
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmarSenha('');
      } else {
        Alert.alert('Erro', response.error || 'Não foi possível alterar a senha no servidor');
      }
    } catch (error) {
      // Se falhar via API (offline), tentar apenas local
      try {
        await usuarioRepository.definirSenha(user!.id, novaSenha);
        Alert.alert(
          'Atenção',
          'Senha alterada localmente. A alteração será sincronizada quando houver conexão.'
        );
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmarSenha('');
      } catch (localError) {
        Alert.alert('Erro', 'Não foi possível alterar a senha');
      }
    } finally {
      setAlterandoSenha(false);
    }
  }, [senhaAtual, novaSenha, confirmarSenha, user]);

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
            <Text style={styles.headerTitle}>Meu Perfil</Text>
          </View>

          {/* Avatar e Info */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.nome?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.nome || 'Usuário'}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              <View style={[styles.permTag, { backgroundColor: `${getTipoPermissaoColor(user?.tipoPermissao)}20` }]}>
                <Text style={[styles.permTagText, { color: getTipoPermissaoColor(user?.tipoPermissao) }]}>
                  {getTipoPermissaoLabel(user?.tipoPermissao)}
                </Text>
              </View>
            </View>
          </View>

          {/* Informações Editáveis */}
          <FormSection title="Informações Pessoais" icon="person-outline">
            <FormInput
              label="Nome"
              value={nome}
              onChangeText={(value) => {
                setNome(value);
                if (profileErrors.nome) setProfileErrors(prev => ({ ...prev, nome: '' }));
              }}
              placeholder="Seu nome completo"
              error={profileErrors.nome}
              required
              autoCapitalize="words"
            />

            <FormInput
              label="Telefone"
              value={telefone}
              onChangeText={setTelefone}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
            />

            <FormInput
              label="Email"
              value={user?.email || ''}
              onChangeText={() => {}}
              placeholder="email@exemplo.com"
              disabled
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.readOnlyInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
              <Text style={styles.readOnlyHint}>O email só pode ser alterado pelo administrador</Text>
            </View>
          </FormSection>

          {/* Botão Salvar Perfil */}
          <TouchableOpacity
            style={[styles.profileSaveButton, salvandoPerfil && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={salvandoPerfil}
            activeOpacity={0.7}
          >
            {salvandoPerfil ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.profileSaveButtonText}>Salvar Alterações</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Alterar Senha */}
          <FormSection title="Alterar Senha" icon="lock-closed-outline" subtitle="Preencha todos os campos para alterar sua senha">
            <FormInput
              label="Senha Atual"
              value={senhaAtual}
              onChangeText={(value) => {
                setSenhaAtual(value);
                if (passwordErrors.senhaAtual) setPasswordErrors(prev => ({ ...prev, senhaAtual: '' }));
              }}
              placeholder="Digite sua senha atual"
              error={passwordErrors.senhaAtual}
              required
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FormInput
              label="Nova Senha"
              value={novaSenha}
              onChangeText={(value) => {
                setNovaSenha(value);
                if (passwordErrors.novaSenha) setPasswordErrors(prev => ({ ...prev, novaSenha: '' }));
              }}
              placeholder="Mínimo 6 caracteres"
              error={passwordErrors.novaSenha}
              required
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FormInput
              label="Confirmar Nova Senha"
              value={confirmarSenha}
              onChangeText={(value) => {
                setConfirmarSenha(value);
                if (passwordErrors.confirmarSenha) setPasswordErrors(prev => ({ ...prev, confirmarSenha: '' }));
              }}
              placeholder="Repita a nova senha"
              error={passwordErrors.confirmarSenha}
              required
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </FormSection>

          {/* Botão Alterar Senha */}
          <TouchableOpacity
            style={[styles.passwordButton, alterandoSenha && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={alterandoSenha}
            activeOpacity={0.7}
          >
            {alterandoSenha ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="key-outline" size={20} color="#FFFFFF" />
                <Text style={styles.passwordButtonText}>Alterar Senha</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer} />
        </ScrollView>
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
    paddingBottom: 40,
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
  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  permTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 6,
  },
  permTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Read-only info
  readOnlyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  readOnlyHint: {
    fontSize: 12,
    color: '#94A3B8',
  },
  // Buttons
  profileSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  profileSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  passwordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  passwordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    height: 20,
  },
});
