/**
 * MaisScreen.tsx
 * Tela "Mais" - Menu com opções adicionais e configurações
 * 
 * Funcionalidades:
 * - Perfil do usuário
 * - Configurações do app
 * - Status de sincronização
 * - Sobre o aplicativo
 * - Sair/Logout
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import { useBranding } from '../components/BrandingProvider';

// Types
import { AppTabsNavigationProp } from '../navigation/AppNavigator';

// Config
import { ENV } from '../config/env';

// ============================================================================
// TIPOS DE ITENS DO MENU
// ============================================================================

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  badge?: number;
  disabled?: boolean;  divider?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MaisScreen() {
  const navigation = useNavigation<AppTabsNavigationProp>();
  const { user, logout, isAdmin } = useAuth();
  const { status: syncStatus, lastSyncAt, mudancasPendentes, sincronizar, isSyncing } = useSync();
  const { appName, primaryColor, supportEmail, companyName } = useBranding();

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sair do Aplicativo',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  }, [logout]);

  const handleSync = useCallback(async () => {
    await sincronizar(true);
  }, [sincronizar]);

  const handleSupport = useCallback(() => {
    Linking.openURL(`mailto:${supportEmail}`);
  }, [supportEmail]);

  const handleWebsite = useCallback(() => {
    if (companyName) {
      Linking.openURL(`https://${companyName.replace(/\s+/g, '').toLowerCase()}.com.br`);
    }
  }, [companyName]);

  // ==========================================================================
  // ITENS DO MENU  // ==========================================================================

  const menuItems: MenuItem[] = [
    // Perfil
    {
      id: 'profile',
      title: user?.nome || 'Usuário',
      subtitle: user?.email || user?.cpf,
      icon: 'person-circle',
      iconColor: primaryColor,
      disabled: true,
    },
    {
      id: 'role',
      title: 'Tipo de Acesso',
      subtitle: user?.tipoPermissao || 'Administrador',
      icon: 'shield-checkmark',
      disabled: true,
      divider: true,
    },

    // Sincronização
    {
      id: 'sync',
      title: 'Sincronizar Agora',
      subtitle: lastSyncAt 
        ? `Última: ${new Date(lastSyncAt).toLocaleTimeString('pt-BR')}`
        : 'Nunca sincronizado',
      icon: isSyncing ? 'sync' : 'cloud-download',
      iconColor: syncStatus === 'synced' ? '#16A34A' : '#2563EB',
      onPress: handleSync,
      badge: mudancasPendentes > 0 ? mudancasPendentes : undefined,
    },
    {
      id: 'sync-status',
      title: 'Status da Sincronização',
      subtitle: 'Ver detalhes e conflitos',
      icon: 'information-circle',
      onPress: () => navigation.navigate('Modal', { screen: 'SyncStatus' } as any),
    },
    {
      id: 'divider-sync',
      title: '',
      icon: 'none',
      divider: true,
    },

    // Configurações
    {
      id: 'settings',      title: 'Configurações',
      subtitle: 'Preferências do aplicativo',
      icon: 'settings',
      onPress: () => navigation.navigate('Modal', { screen: 'Settings' } as any),
    },
    {
      id: 'notifications',
      title: 'Notificações',
      subtitle: 'Alertas e lembretes',
      icon: 'notifications',
      disabled: true,
    },
    {
      id: 'divider-settings',
      title: '',
      icon: 'none',
      divider: true,
    },

    // Suporte
    {
      id: 'support',
      title: 'Central de Ajuda',
      subtitle: 'Dúvidas e suporte técnico',
      icon: 'help-circle',
      onPress: handleSupport,
    },
    {
      id: 'feedback',
      title: 'Enviar Feedback',
      subtitle: 'Sugestões e melhorias',
      icon: 'chatbubble-ellipses',
      onPress: handleSupport,
    },
    {
      id: 'divider-support',
      title: '',
      icon: 'none',
      divider: true,
    },

    // Sobre
    {
      id: 'about',
      title: 'Sobre o Aplicativo',
      subtitle: `Versão ${ENV.APP_VERSION}`,
      icon: 'information-circle',
      onPress: () => Alert.alert(
        appName,
        `Versão: ${ENV.APP_VERSION}\n\n${companyName}\n\n© ${new Date().getFullYear()}`,        [{ text: 'OK' }]
      ),
    },
    {
      id: 'website',
      title: 'Visitar Site',
      subtitle: companyName,
      icon: 'globe',
      onPress: handleWebsite,
    },
    {
      id: 'divider-about',
      title: '',
      icon: 'none',
      divider: true,
    },

    // Sair
    {
      id: 'logout',
      title: 'Sair do Aplicativo',
      subtitle: 'Encerrar sessão atual',
      icon: 'log-out',
      iconColor: '#DC2626',
      onPress: handleLogout,
    },
  ];

  // ==========================================================================
  // RENDERIZAÇÃO DE ITENS
  // ==========================================================================

  const renderMenuItem = useCallback((item: MenuItem) => {
    if (item.divider) {
      return <View key={item.id} style={styles.divider} />;
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.menuItem,
          item.disabled && styles.menuItemDisabled,
        ]}
        onPress={item.onPress}
        disabled={item.disabled}
        activeOpacity={item.disabled ? 1 : 0.7}
      >
        {/* Ícone */}
        <View style={[styles.menuIcon, item.iconColor && { backgroundColor: `${item.iconColor}1A` }]}>          <Ionicons 
            name={item.icon as any} 
            size={24} 
            color={item.iconColor || '#64748B'} 
          />
        </View>

        {/* Texto */}
        <View style={styles.menuTextContainer}>
          <Text style={[
            styles.menuTitle,
            item.iconColor === '#DC2626' && { color: '#DC2626' },
          ]}>
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          )}
        </View>

        {/* Badge */}
        {item.badge !== undefined && item.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {item.badge > 99 ? '99+' : item.badge}
            </Text>
          </View>
        )}

        {/* Chevron */}
        {!item.disabled && item.onPress && (
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        )}
      </TouchableOpacity>
    );
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mais</Text>
          <Text style={styles.headerSubtitle}>{appName}</Text>
        </View>
        {/* Card de Perfil */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.nome?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.nome || 'Usuário'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'email@exemplo.com'}</Text>
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>
                {user?.tipoPermissao || 'Administrador'}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu de Itens */}
        <View style={styles.menuContainer}>
          {menuItems.map(renderMenuItem)}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {companyName} © {new Date().getFullYear()}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {    padding: 16,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  profileBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Menu
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },

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