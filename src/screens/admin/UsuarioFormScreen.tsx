/**
 * UsuarioFormScreen.tsx
 * Formulário de cadastro/edição de usuários (admin)
 *
 * Funcionalidades:
 * - Campos: nome, cpf, telefone, email, tipoPermissao, senha (só para novos)
 * - Modo criar / editar
 * - Usa UsuarioRepository para persistência local
 * - Validação de campos obrigatórios e duplicidade de email
 * - Delete com confirmação (modo editar)
 * - Senha hasheada com bcrypt antes de armazenar
 * - Permission guard: adminUsuarios
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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import bcrypt from 'bcryptjs';

// Repository
import { usuarioRepository } from '../../repositories/UsuarioRepository';

// Hooks
import { usePermissionGuard } from '../../hooks/usePermissionGuard';
import { useAuth } from '../../contexts/AuthContext';

// Components
import FormInput from '../../components/forms/FormInput';
import FormSection from '../../components/forms/FormSection';

// Types
import { TipoPermissaoUsuario, PermissoesUsuario } from '../../types';
import { ModalStackParamList } from '../../navigation/AppNavigator';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type UsuarioFormRouteProp = RouteProp<
  ModalStackParamList,
  'UsuarioForm'
>;

// ============================================================================
// PERMISSÕES PADRÃO POR TIPO
// ============================================================================

const PERMISSOES_PADRAO: Record<TipoPermissaoUsuario, PermissoesUsuario> = {
  Administrador: {
    web: {
      clientes: true, produtos: true, rotas: true,
      locacaoRelocacaoEstoque: true, cobrancas: true, manutencoes: true, relogios: true,
      relatorios: true, dashboard: true, agenda: true, mapa: true,
      adminCadastros: true, adminUsuarios: true, adminDispositivos: true, adminSincronizacao: true, adminAuditoria: true,
    },
    mobile: {
      clientes: true, produtos: true,
      alteracaoRelogio: true, locacaoRelocacaoEstoque: true, cobrancasFaturas: true, manutencoes: true,
      relatorios: true, sincronizacao: true,
    },
  },
  Secretario: {
    web: {
      clientes: true, produtos: true, rotas: true,
      locacaoRelocacaoEstoque: true, cobrancas: true, manutencoes: true, relogios: true,
      relatorios: true, dashboard: true, agenda: true, mapa: true,
      adminCadastros: false, adminUsuarios: false, adminDispositivos: false, adminSincronizacao: false, adminAuditoria: false,
    },
    mobile: {
      clientes: true, produtos: true,
      alteracaoRelogio: false, locacaoRelocacaoEstoque: true, cobrancasFaturas: true, manutencoes: true,
      relatorios: true, sincronizacao: true,
    },
  },
  'AcessoControlado': {
    web: {
      clientes: false, produtos: false, rotas: false,
      locacaoRelocacaoEstoque: false, cobrancas: false, manutencoes: false, relogios: false,
      relatorios: false, dashboard: true, agenda: false, mapa: false,
      adminCadastros: false, adminUsuarios: false, adminDispositivos: false, adminSincronizacao: false, adminAuditoria: false,
    },
    mobile: {
      clientes: false, produtos: false,
      alteracaoRelogio: false, locacaoRelocacaoEstoque: false, cobrancasFaturas: true, manutencoes: false,
      relatorios: false, sincronizacao: true,
    },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

const getTipoPermissaoLabel = (tipo: TipoPermissaoUsuario) => {
  const labels: Record<TipoPermissaoUsuario, string> = {
    'Administrador': 'Administrador',
    'Secretario': 'Secretário',
    'AcessoControlado': 'Acesso Controlado',
  };
  return labels[tipo];
};

const getTipoPermissaoColor = (tipo: TipoPermissaoUsuario) => {
  const colors: Record<TipoPermissaoUsuario, string> = {
    'Administrador': '#2563EB',
    'Secretario': '#16A34A',
    'AcessoControlado': '#F59E0B',
  };
  return colors[tipo];
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function UsuarioFormScreen() {
  const route = useRoute<UsuarioFormRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { canDo } = usePermissionGuard();

  const modo = route.params?.modo || 'criar';
  const usuarioId = route.params?.usuarioId;
  const usuarioNome = route.params?.usuarioNome || '';
  const usuarioEmail = route.params?.usuarioEmail || '';
  const usuarioCpf = route.params?.usuarioCpf || '';
  const usuarioTelefone = route.params?.usuarioTelefone || '';
  const usuarioTipoPermissao = route.params?.usuarioTipoPermissao || 'AcessoControlado';
  const usuarioStatus = route.params?.usuarioStatus || 'Ativo';

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipoPermissao, setTipoPermissao] = useState<TipoPermissaoUsuario>('AcessoControlado');
  const [senha, setSenha] = useState('');
  const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [salvando, setSalvando] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ==========================================================================
  // CARREGAMENTO PARA EDIÇÃO
  // ==========================================================================

  useEffect(() => {
    if (modo === 'editar' && usuarioId) {
      setNome(usuarioNome);
      setEmail(usuarioEmail);
      setCpf(usuarioCpf);
      setTelefone(usuarioTelefone);
      setTipoPermissao(usuarioTipoPermissao as TipoPermissaoUsuario);
      setStatus(usuarioStatus as 'Ativo' | 'Inativo');
    }
  }, [modo, usuarioId, usuarioNome, usuarioEmail, usuarioCpf, usuarioTelefone, usuarioTipoPermissao, usuarioStatus]);

  // ==========================================================================
  // VALIDAÇÃO
  // ==========================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Email inválido';
    }

    if (!editando && !senha.trim()) {
      newErrors.senha = 'Senha é obrigatória para novos usuários';
    }

    if (senha.trim() && senha.trim().length < 6) {
      newErrors.senha = 'Senha deve ter no mínimo 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [nome, email, senha, modo]);

  const editando = modo === 'editar';

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  const handleSubmit = useCallback(async () => {
    // Permission guard — apenas administradores podem gerenciar usuários
    if (user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Sem permissão', 'Você não tem permissão para gerenciar usuários.');
      return;
    }

    if (!validate()) {
      Alert.alert('Erro', 'Por favor, corrija os campos obrigatórios');
      return;
    }

    // Verificar duplicidade de email
    const existe = await usuarioRepository.emailExiste(email.trim().toLowerCase(), editando ? usuarioId : undefined);
    if (existe) {
      Alert.alert('Erro', 'Já existe um usuário com este email');
      return;
    }

    setSalvando(true);
    try {
      const dadosUsuario: any = {
        id: editando ? usuarioId : `usr_${Date.now()}`,
        tipo: 'usuario',
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        cpf: cpf.replace(/\D/g, ''),
        telefone: telefone.replace(/\D/g, ''),
        tipoPermissao,
        permissoes: PERMISSOES_PADRAO[tipoPermissao],
        rotasPermitidas: [],
        status,
        bloqueado: false,
        syncStatus: 'pending',
        needsSync: true,
        version: 1,
        deviceId: '',
      };

      if (senha.trim()) {
        // Hashear senha antes de armazenar
        dadosUsuario.senha = await bcrypt.hash(senha.trim(), 10);
      }

      if (editando) {
        await usuarioRepository.update(dadosUsuario);
        Alert.alert('Sucesso', 'Usuário atualizado com sucesso', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        await usuarioRepository.save(dadosUsuario);
        Alert.alert('Sucesso', 'Usuário criado com sucesso', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível salvar o usuário');
    } finally {
      setSalvando(false);
    }
  }, [modo, usuarioId, nome, email, cpf, telefone, tipoPermissao, senha, status, editando, user, canDo, validate, navigation]);

  // ==========================================================================
  // DELETE
  // ==========================================================================

  const handleDelete = useCallback(() => {
    if (usuarioId === user?.id) {
      Alert.alert('Erro', 'Você não pode excluir seu próprio usuário');
      return;
    }

    Alert.alert(
      'Excluir Usuário',
      `Tem certeza que deseja excluir "${nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await usuarioRepository.delete(usuarioId!);
              Alert.alert('Sucesso', 'Usuário excluído com sucesso', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir o usuário');
            }
          },
        },
      ]
    );
  }, [usuarioId, nome, user, navigation]);

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
              {editando ? 'Editar Usuário' : 'Novo Usuário'}
            </Text>
          </View>

          {/* Dados Pessoais */}
          <FormSection title="Dados Pessoais" icon="person-outline">
            <FormInput
              label="Nome"
              value={nome}
              onChangeText={(value) => {
                setNome(value);
                if (errors.nome) setErrors(prev => ({ ...prev, nome: '' }));
              }}
              placeholder="Nome completo"
              error={errors.nome}
              required
              autoCapitalize="words"
            />

            <FormInput
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="email@exemplo.com"
              error={errors.email}
              required
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FormInput
              label="CPF"
              value={cpf}
              onChangeText={setCpf}
              placeholder="000.000.000-00"
              keyboardType="numeric"
            />

            <FormInput
              label="Telefone"
              value={telefone}
              onChangeText={setTelefone}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
            />
          </FormSection>

          {/* Acesso */}
          <FormSection title="Acesso" icon="lock-closed-outline">
            <FormInput
              label={editando ? 'Senha (deixe vazio para manter a atual)' : 'Senha'}
              value={senha}
              onChangeText={(value) => {
                setSenha(value);
                if (errors.senha) setErrors(prev => ({ ...prev, senha: '' }));
              }}
              placeholder={editando ? 'Deixe vazio para manter' : 'Mínimo 6 caracteres'}
              error={errors.senha}
              required={!editando}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Tipo de Permissão */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tipo de Permissão *</Text>
              <View style={styles.permissoesContainer}>
                {(['Administrador', 'Secretario', 'AcessoControlado'] as TipoPermissaoUsuario[]).map((tipo) => (
                  <TouchableOpacity
                    key={tipo}
                    style={[
                      styles.permissaoButton,
                      tipoPermissao === tipo && styles.permissaoButtonActive,
                      { borderColor: getTipoPermissaoColor(tipo) },
                      tipoPermissao === tipo && { backgroundColor: `${getTipoPermissaoColor(tipo)}20` },
                    ]}
                    onPress={() => setTipoPermissao(tipo)}
                  >
                    <Text
                      style={[
                        styles.permissaoText,
                        tipoPermissao === tipo && { color: getTipoPermissaoColor(tipo) },
                      ]}
                    >
                      {getTipoPermissaoLabel(tipo)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  {status === 'Ativo' ? 'Usuário Ativo' : 'Usuário Inativo'}
                </Text>
                <Switch
                  value={status === 'Ativo'}
                  onValueChange={(value) => setStatus(value ? 'Ativo' : 'Inativo')}
                  trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                  thumbColor={status === 'Ativo' ? '#16A34A' : '#F8FAFC'}
                />
              </View>
            </View>
          </FormSection>

          {/* Botão Excluir (só no modo editar) */}
          {editando && usuarioId !== user?.id && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={styles.deleteButtonText}>Excluir Usuário</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footer} />
        </ScrollView>

        {/* Botão Salvar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveButton, salvando && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {editando ? 'Atualizar Usuário' : 'Criar Usuário'}
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
  // Field group for non-FormInput fields
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  // Permissões
  permissoesContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  permissaoButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#F8FAFC',
  },
  permissaoButtonActive: {
    borderWidth: 2,
  },
  permissaoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 15,
    color: '#1E293B',
  },
  // Delete
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
