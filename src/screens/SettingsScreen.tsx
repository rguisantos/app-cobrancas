/**
 * SettingsScreen.tsx
 * Tela de configurações do aplicativo
 * 
 * Funcionalidades:
 * - Preferências de sincronização
 * - Notificações
 * - Tema (claro/escuro)
 * - Idioma
 * - Limpar dados locais
 * - Restaurar padrões
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useSync } from '../contexts/SyncContext';
import { useBranding } from '../components/BrandingProvider';
import { useAuth } from '../contexts/AuthContext';

// Utils
import { databaseService } from '../services/DatabaseService';
import logger from '../utils/logger';

// Config
import { ENV } from '../config/env';

// ============================================================================
// TIPOS DE CONFIGURAÇÃO
// ============================================================================

interface SettingGroup {
  id: string;
  title: string;
  items: SettingItem[];
}

interface SettingItem {  id: string;
  title: string;
  subtitle?: string;
  type: 'toggle' | 'select' | 'button' | 'info';
  value?: any;
  options?: Array<{ label: string; value: any }>;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { primaryColor, appName, supportEmail } = useBranding();
  const { user } = useAuth();
  const { 
    syncConfig, 
    ativarAutoSync, 
    setAutoSyncInterval,
    sincronizar,
    isSyncing,
    lastSyncAt,
  } = useSync();

  // Estado local para configurações
  const [settings, setSettings] = useState({
    autoSync: syncConfig?.autoSyncEnabled ?? true,
    syncInterval: syncConfig?.autoSyncInterval ?? 15,
    syncOnStart: syncConfig?.syncOnAppStart ?? true,
    syncOnResume: syncConfig?.syncOnAppResume ?? true,
    darkMode: false,
    notifications: true,
    language: 'pt-BR',
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleToggle = useCallback((key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Aplicar configurações de sync
    if (key === 'autoSync') {      ativarAutoSync(value);
    }
  }, [ativarAutoSync]);

  const handleSyncNow = useCallback(async () => {
    try {
      await sincronizar(true);
      Alert.alert('Sincronização', 'Sincronização iniciada com sucesso');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível sincronizar');
    }
  }, [sincronizar]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Limpar Dados Locais',
      'Esta ação irá apagar todos os dados armazenados localmente no dispositivo. Os dados serão recuperados na próxima sincronização. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.clearLocalData();
              Alert.alert('Sucesso', 'Dados locais limpos com sucesso');
              logger.info('Dados locais limpos pelo usuário', undefined, 'Settings');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível limpar os dados');
              logger.error('Erro ao limpar dados locais', error, 'Settings');
            }
          },
        },
      ]
    );
  }, []);

  const handleResetSettings = useCallback(() => {
    Alert.alert(
      'Restaurar Padrões',
      'Deseja restaurar todas as configurações para os valores padrão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: () => {
            setSettings({
              autoSync: true,
              syncInterval: 15,              syncOnStart: true,
              syncOnResume: true,
              darkMode: false,
              notifications: true,
              language: 'pt-BR',
            });
            Alert.alert('Sucesso', 'Configurações restauradas');
          },
        },
      ]
    );
  }, []);

  const handleSupport = useCallback(() => {
    if (supportEmail) {
      Linking.openURL(`mailto:${supportEmail}`);
    }
  }, [supportEmail]);

  // ==========================================================================
  // GRUPOS DE CONFIGURAÇÃO
  // ==========================================================================

  const settingGroups: SettingGroup[] = [
    {
      id: 'user',
      title: 'Usuário',
      items: [
        {
          id: 'userInfo',
          title: user?.nome || 'Usuário',
          subtitle: user?.email || user?.cpf,
          type: 'info',
          icon: 'person',
        },
        {
          id: 'userRole',
          title: 'Tipo de Acesso',
          subtitle: user?.tipoPermissao || 'Administrador',
          type: 'info',
          icon: 'shield-checkmark',
        },
      ],
    },
    {
      id: 'sync',
      title: 'Sincronização',
      items: [
        {
          id: 'autoSync',          title: 'Sincronização Automática',
          subtitle: 'Sincronizar em segundo plano',
          type: 'toggle',
          value: settings.autoSync,
          icon: 'sync',
          onToggle: (value) => handleToggle('autoSync', value),
        },
        {
          id: 'syncInterval',
          title: 'Intervalo de Sync',
          subtitle: `${settings.syncInterval} minutos`,
          type: 'select',
          value: settings.syncInterval,
          options: [
            { label: '5 minutos', value: 5 },
            { label: '15 minutos', value: 15 },
            { label: '30 minutos', value: 30 },
            { label: '1 hora', value: 60 },
          ],
          icon: 'time',
        },
        {
          id: 'syncOnStart',
          title: 'Sync ao Iniciar',
          subtitle: 'Sincronizar ao abrir o app',
          type: 'toggle',
          value: settings.syncOnStart,
          icon: 'power',
          onToggle: (value) => handleToggle('syncOnStart', value),
        },
        {
          id: 'syncNow',
          title: 'Sincronizar Agora',
          subtitle: lastSyncAt 
            ? `Última: ${new Date(lastSyncAt).toLocaleTimeString('pt-BR')}`
            : 'Nunca sincronizado',
          type: 'button',
          icon: isSyncing ? 'sync' : 'cloud-download',
          onPress: handleSyncNow,
          disabled: isSyncing,
        },
      ],
    },
    {
      id: 'appearance',
      title: 'Aparência',
      items: [
        {
          id: 'darkMode',
          title: 'Modo Escuro',          subtitle: 'Tema escuro para o aplicativo',
          type: 'toggle',
          value: settings.darkMode,
          icon: 'moon',
          onToggle: (value) => handleToggle('darkMode', value),
          disabled: true, // Implementar quando tiver tema escuro
        },
        {
          id: 'language',
          title: 'Idioma',
          subtitle: settings.language === 'pt-BR' ? 'Português (Brasil)' : 'English',
          type: 'select',
          value: settings.language,
          options: [
            { label: 'Português (Brasil)', value: 'pt-BR' },
            { label: 'English', value: 'en' },
          ],
          icon: 'language',
        },
      ],
    },
    {
      id: 'notifications',
      title: 'Notificações',
      items: [
        {
          id: 'notifications',
          title: 'Notificações Push',
          subtitle: 'Alertas de cobranças e sincronização',
          type: 'toggle',
          value: settings.notifications,
          icon: 'notifications',
          onToggle: (value) => handleToggle('notifications', value),
        },
      ],
    },
    {
      id: 'data',
      title: 'Dados',
      items: [
        {
          id: 'clearData',
          title: 'Limpar Dados Locais',
          subtitle: 'Apagar cache e dados offline',
          type: 'button',
          icon: 'trash',
          onPress: handleClearData,
          danger: true,
        },
        {          id: 'resetSettings',
          title: 'Restaurar Padrões',
          subtitle: 'Voltar configurações ao original',
          type: 'button',
          icon: 'refresh',
          onPress: handleResetSettings,
          danger: true,
        },
      ],
    },
    {
      id: 'about',
      title: 'Sobre',
      items: [
        {
          id: 'appVersion',
          title: 'Versão do App',
          subtitle: `v${ENV.APP_VERSION}`,
          type: 'info',
          icon: 'information-circle',
        },
        {
          id: 'appName',
          title: 'Aplicativo',
          subtitle: appName,
          type: 'info',
          icon: 'apps',
        },
        {
          id: 'support',
          title: 'Suporte Técnico',
          subtitle: supportEmail || 'suporte@empresa.com.br',
          type: 'button',
          icon: 'headset',
          onPress: handleSupport,
        },
        {
          id: 'privacy',
          title: 'Política de Privacidade',
          type: 'button',
          icon: 'shield-checkmark',
          onPress: () => Alert.alert('Política de Privacidade', 'Conteúdo em desenvolvimento'),
        },
        {
          id: 'terms',
          title: 'Termos de Uso',
          type: 'button',
          icon: 'document-text',
          onPress: () => Alert.alert('Termos de Uso', 'Conteúdo em desenvolvimento'),
        },      ],
    },
  ];

  // ==========================================================================
  // RENDERIZAÇÃO DE ITENS
  // ==========================================================================

  const renderSettingItem = useCallback((item: SettingItem) => {
    const iconColor = item.danger ? '#DC2626' : primaryColor;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.settingItem,
          item.type === 'button' && styles.settingItemButton,
          item.danger && styles.settingItemDanger,
          item.disabled && styles.settingItemDisabled,
        ]}
        onPress={item.type === 'toggle' ? undefined : item.onPress}
        disabled={item.type === 'toggle' || item.disabled}
        activeOpacity={item.disabled ? 1 : 0.7}
      >
        {/* Ícone */}
        {item.icon && (
          <View style={[
            styles.settingIcon,
            { backgroundColor: `${iconColor}1A` },
          ]}>
            <Ionicons 
              name={item.icon as any} 
              size={20} 
              color={item.danger ? '#DC2626' : iconColor} 
            />
          </View>
        )}

        {/* Texto */}
        <View style={styles.settingTextContainer}>
          <Text style={[
            styles.settingTitle,
            item.danger && { color: '#DC2626' },
            item.disabled && { opacity: 0.5 },
          ]}>
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={[
              styles.settingSubtitle,              item.danger && { color: '#991B1B' },
              item.disabled && { opacity: 0.5 },
            ]}>
              {item.subtitle}
            </Text>
          )}
        </View>

        {/* Controle */}
        {item.type === 'toggle' && (
          <Switch
            value={item.value as boolean}
            onValueChange={(value) => item.onToggle?.(value)}
            trackColor={{ false: '#CBD5E1', true: `${primaryColor}80` }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#CBD5E1"
            disabled={item.disabled}
          />
        )}

        {item.type === 'select' && (
          <View style={styles.selectContainer}>
            <Text style={styles.selectValue}>{item.subtitle}</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </View>
        )}

        {item.type === 'button' && (
          <>
            {item.disabled && isSyncing && (
              <ActivityIndicator size="small" color={primaryColor} />
            )}
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </>
        )}

        {item.type === 'info' && (
          <Ionicons name="chevron-forward" size={20} color="#E2E8F0" />
        )}
      </TouchableOpacity>
    );
  }, [primaryColor, isSyncing]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Configurações */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {settingGroups.map((group) => (
          <View key={group.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.sectionCard}>
              {group.items.map(renderSettingItem)}
            </View>
          </View>
        ))}

        {/* Espaço extra */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {appName} © {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerVersion}>
            v{ENV.APP_VERSION}
          </Text>
        </View>
      </ScrollView>
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,  },

  // Setting Item
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingItemButton: {
    // Estilo para itens do tipo button
  },
  settingItemDanger: {
    // Estilo para itens perigosos
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },

  // Select
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectValue: {
    fontSize: 13,
    color: '#64748B',  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  footerVersion: {
    fontSize: 11,
    color: '#CBD5E1',
  },
});