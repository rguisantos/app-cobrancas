/**
 * SettingsScreen.tsx
 * Tela de configurações técnicas do aplicativo
 * 
 * Funcionalidades:
 * - Configurações de sincronização
 * - Gerenciamento de dados locais
 * - Configurações de aparência
 * - Informações do app e versão
 * - Opções avançadas (force resync, etc.)
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useSync } from '../contexts/SyncContext';
import { useBranding } from '../components/BrandingProvider';

// Services
import { databaseService } from '../services/DatabaseService';
import { syncService } from '../services/SyncService';
import logger from '../utils/logger';

// Config
import { ENV } from '../config/env';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { primaryColor, appName, companyName } = useBranding();
  const {
    syncConfig,
    ativarAutoSync,
    sincronizar,
    isSyncing,
    lastSyncAt,
    mudancasPendentes,
  } = useSync();

  // Estado local para configurações
  const [settings, setSettings] = useState({
    autoSync: syncConfig?.autoSyncEnabled ?? true,
    syncOnAppStart: syncConfig?.syncOnAppStart ?? true,
    syncOnAppResume: syncConfig?.syncOnAppResume ?? true,
    warnBeforeLargeSync: syncConfig?.warnBeforeLargeSync ?? false,
  });

  const [limpando, setLimpando] = useState(false);
  const [forceResyncing, setForceResyncing] = useState(false);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleToggle = useCallback((key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'autoSync') {
      ativarAutoSync(value);
    }
  }, [ativarAutoSync]);

  const handleSyncNow = useCallback(async () => {
    try {
      await sincronizar(true);
      Alert.alert('Sincronização', 'Sincronização realizada com sucesso');
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
              setLimpando(true);
              const pendentes = await databaseService.getPendingChanges();
              if (pendentes.length > 0) {
                Alert.alert(
                  'Sincronização pendente',
                  `Existem ${pendentes.length} alterações locais ainda não enviadas. Sincronize antes de limpar os dados.`
                );
                return;
              }

              await databaseService.clearLocalData();
              Alert.alert('Sucesso', 'Dados locais limpos. A ativação do dispositivo foi preservada.');
              logger.info('Dados locais limpos pelo usuário', undefined, 'Settings');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível limpar os dados');
              logger.error('Erro ao limpar dados locais', error, 'Settings');
            } finally {
              setLimpando(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleForceFullResync = useCallback(() => {
    Alert.alert(
      'Sincronização Completa',
      'Isso irá buscar todos os dados do servidor novamente, substituindo os dados locais. Use esta opção se os dados estiverem inconsistentes. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sincronizar Tudo',
          style: 'default',
          onPress: async () => {
            try {
              setForceResyncing(true);
              // Resetar lastSyncAt para forçar sync completa
              await databaseService.updateSyncMetadata({
                lastSyncAt: '',
                lastPushAt: '',
                lastPullAt: '',
              });
              await sincronizar(true);
              Alert.alert('Sucesso', 'Sincronização completa realizada com sucesso');
              logger.info('Force full resync executado pelo usuário', undefined, 'Settings');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível realizar a sincronização completa');
              logger.error('Erro no force full resync', error, 'Settings');
            } finally {
              setForceResyncing(false);
            }
          },
        },
      ]
    );
  }, [sincronizar]);

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const renderSettingItem = (
    id: string,
    title: string,
    subtitle: string | undefined,
    icon: keyof typeof Ionicons.glyphMap,
    options: {
      type?: 'toggle' | 'button' | 'info';
      value?: boolean;
      onPress?: () => void;
      onToggle?: (value: boolean) => void;
      danger?: boolean;
      disabled?: boolean;
      iconColor?: string;
    } = {}
  ) => {
    const {
      type = 'button',
      value,
      onPress,
      onToggle,
      danger = false,
      disabled = false,
      iconColor,
    } = options;
    
    const color = danger ? '#DC2626' : (iconColor || primaryColor);

    return (
      <TouchableOpacity
        key={id}
        style={[
          styles.settingItem,
          danger && styles.settingItemDanger,
          disabled && styles.settingItemDisabled,
        ]}
        onPress={type === 'toggle' ? undefined : onPress}
        disabled={type === 'toggle' || disabled}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <View style={[styles.settingIcon, { backgroundColor: `${color}1A` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>

        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingTitle, danger && { color: '#DC2626' }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.settingSubtitle, danger && { color: '#991B1B' }]}>
              {subtitle}
            </Text>
          )}
        </View>

        {type === 'toggle' && (
          <Switch
            value={value ?? false}
            onValueChange={onToggle}
            trackColor={{ false: '#CBD5E1', true: `${primaryColor}80` }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#CBD5E1"
            disabled={disabled}
          />
        )}

        {type === 'button' && !disabled && (
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        )}

        {type === 'button' && disabled && (isSyncing || limpando || forceResyncing) && (
          <ActivityIndicator size="small" color={primaryColor} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
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
        {/* ── Sincronização ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sincronização</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem('autoSync', 'Sincronização Automática', 'Sincronizar dados em segundo plano', 'sync', {
              type: 'toggle',
              value: settings.autoSync,
              onToggle: (value) => handleToggle('autoSync', value),
            })}
            {renderSettingItem('syncOnAppStart', 'Ao Abrir o App', 'Sincronizar ao iniciar o aplicativo', 'play', {
              type: 'toggle',
              value: settings.syncOnAppStart,
              onToggle: (value) => handleToggle('syncOnAppStart', value),
              iconColor: '#16A34A',
            })}
            {renderSettingItem('syncOnAppResume', 'Ao Retornar ao App', 'Sincronizar ao trazer o app para primeiro plano', 'refresh', {
              type: 'toggle',
              value: settings.syncOnAppResume,
              onToggle: (value) => handleToggle('syncOnAppResume', value),
              iconColor: '#0891B2',
            })}
            {renderSettingItem('warnLargeSync', 'Avisar Sincronização Grande', 'Mostrar aviso antes de sincronizar muitos dados', 'warning', {
              type: 'toggle',
              value: settings.warnBeforeLargeSync,
              onToggle: (value) => handleToggle('warnBeforeLargeSync', value),
              iconColor: '#D97706',
            })}
            {renderSettingItem('syncNow', 'Sincronizar Agora', 
              lastSyncAt ? `Última: ${new Date(lastSyncAt).toLocaleTimeString('pt-BR')}` : 'Nunca sincronizado',
              isSyncing ? 'sync' : 'cloud-download', {
              type: 'button',
              onPress: handleSyncNow,
              disabled: isSyncing,
              iconColor: '#2563EB',
            })}
            {renderSettingItem('forceResync', 'Sincronização Completa', 'Buscar todos os dados do servidor novamente', 'cloud-download-outline', {
              type: 'button',
              onPress: handleForceFullResync,
              disabled: isSyncing || forceResyncing,
              iconColor: '#9333EA',
            })}
          </View>
        </View>

        {/* ── Armazenamento & Dados ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Armazenamento & Dados</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem('clearData', 'Limpar Dados Locais', 'Apagar cache e dados offline', 'trash', {
              type: 'button',
              danger: true,
              onPress: handleClearData,
            })}
            {renderSettingItem('pendingCount', 'Alterações Pendentes', 
              `${mudancasPendentes} alteração${mudancasPendentes !== 1 ? 'ões' : ''} aguardando envio`,
              'cloud-upload', {
              type: 'info',
              iconColor: mudancasPendentes > 0 ? '#D97706' : '#16A34A',
            })}
          </View>
        </View>

        {/* ── Aparência ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aparência</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem('theme', 'Tema', 'Ajustar ao sistema (automático)', 'color-palette', {
              type: 'info',
              iconColor: '#9333EA',
            })}
          </View>
        </View>

        {/* ── Sobre ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem('appName', 'Aplicativo', appName, 'apps', {
              type: 'info',
              iconColor: '#2563EB',
            })}
            {renderSettingItem('appVersion', 'Versão do App', `v${ENV.APP_VERSION}`, 'information-circle', {
              type: 'info',
              iconColor: '#64748B',
            })}
            {renderSettingItem('company', 'Empresa', companyName, 'business', {
              type: 'info',
              iconColor: '#0891B2',
            })}
            {renderSettingItem('env', 'Ambiente', ENV.DEBUG ? 'Desenvolvimento' : 'Produção', 'code-working', {
              type: 'info',
              iconColor: ENV.DEBUG ? '#D97706' : '#16A34A',
            })}
            {renderSettingItem('syncInterval', 'Intervalo de Sync', `${syncConfig?.autoSyncInterval || 15} minutos`, 'time', {
              type: 'info',
              iconColor: '#64748B',
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {appName} © {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerVersion}>v{ENV.APP_VERSION}</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
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
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingItemDanger: {},
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
