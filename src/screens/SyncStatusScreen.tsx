/**
 * SyncStatusScreen.tsx
 * Tela de status de sincronização
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';
import { useSync } from '../contexts/SyncContext';

type Props = NativeStackScreenProps<ModalStackParamList, 'SyncStatus'>;

export default function SyncStatusScreen({ navigation }: Props) {
  const { status, lastSync, pendingItems, syncNow } = useSync();

  const getStatusInfo = () => {
    switch (status) {
      case 'syncing':
        return {
          icon: 'sync' as const,
          color: '#2563EB',
          text: 'Sincronizando...',
          bg: '#EFF6FF',
        };
      case 'synced':
        return {
          icon: 'checkmark-circle' as const,
          color: '#22C55E',
          text: 'Sincronizado',
          bg: '#F0FDF4',
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          color: '#EF4444',
          text: 'Erro na sincronização',
          bg: '#FEF2F2',
        };
      default:
        return {
          icon: 'time' as const,
          color: '#F59E0B',
          text: 'Aguardando',
          bg: '#FFFBEB',
        };
  
  }
  };

  const statusInfo = getStatusInfo();

  const handleSyncNow = async () => {
    try {
      await syncNow();
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
  
  }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={status === 'syncing'}
            onRefresh={handleSyncNow}
            colors={['#2563EB']}
          />
      
  }
      >
        {/* Status Principal */}
        <View style={[styles.statusCard, { backgroundColor: statusInfo.bg }]}>
          <View style={[styles.statusIconContainer, { backgroundColor: statusInfo.color }]}>
            <Ionicons 
              name={statusInfo.icon} 
              size={32} 
              color="#FFFFFF" 
            />
          </View>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
          {lastSync && (
            <Text style={styles.lastSyncText}>
              Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
            </Text>
          )}
        </View>

        {/* Itens Pendentes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens Pendentes</Text>
          
          <View style={styles.pendingGrid}>
            <View style={styles.pendingItem}>
              <View style={[styles.pendingBadge, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="people" size={20} color="#D97706" />
              </View>
              <Text style={styles.pendingNumber}>{pendingItems?.clientes || 0}</Text>
              <Text style={styles.pendingLabel}>Clientes</Text>
            </View>

            <View style={styles.pendingItem}>
              <View style={[styles.pendingBadge, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="cube" size={20} color="#2563EB" />
              </View>
              <Text style={styles.pendingNumber}>{pendingItems?.produtos || 0}</Text>
              <Text style={styles.pendingLabel}>Produtos</Text>
            </View>

            <View style={styles.pendingItem}>
              <View style={[styles.pendingBadge, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="document-text" size={20} color="#059669" />
              </View>
              <Text style={styles.pendingNumber}>{pendingItems?.locacoes || 0}</Text>
              <Text style={styles.pendingLabel}>Locações</Text>
            </View>

            <View style={styles.pendingItem}>
              <View style={[styles.pendingBadge, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="cash" size={20} color="#DB2777" />
              </View>
              <Text style={styles.pendingNumber}>{pendingItems?.cobrancas || 0}</Text>
              <Text style={styles.pendingLabel}>Cobranças</Text>
            </View>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações</Text>
          
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleSyncNow}
            disabled={status === 'syncing'}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="cloud-upload" size={22} color="#2563EB" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Sincronizar Agora</Text>
              <Text style={styles.actionSubtitle}>
                Enviar e receber dados do servidor
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="trash" size={22} color="#EF4444" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Limpar Cache</Text>
              <Text style={styles.actionSubtitle}>
                Limpar dados locais e sincronizar novamente
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#64748B" />
          <Text style={styles.infoText}>
            A sincronização é feita automaticamente a cada 15 minutos quando conectado à internet.
          </Text>
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
  statusCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  lastSyncText: {
    fontSize: 13,
    color: '#64748B',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  pendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pendingItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  pendingBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  pendingLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
});
