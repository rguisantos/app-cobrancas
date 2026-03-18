/**
 * SyncStatusScreen.tsx
 * Status detalhado de sincronização
 */

import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';
import { useSync }      from '../contexts/SyncContext';
import { formatarData } from '../utils/currency';

type Props = NativeStackScreenProps<ModalStackParamList, 'SyncStatus'>;

const STATUS_MAP = {
  syncing: { icon: 'sync' as const,             color: '#2563EB', bg: '#EFF6FF', label: 'Sincronizando...' },
  synced:  { icon: 'checkmark-circle' as const,  color: '#16A34A', bg: '#F0FDF4', label: 'Sincronizado' },
  error:   { icon: 'alert-circle' as const,      color: '#DC2626', bg: '#FEF2F2', label: 'Erro na sincronização' },
  pending: { icon: 'time' as const,              color: '#D97706', bg: '#FFFBEB', label: 'Mudanças pendentes' },
  offline: { icon: 'cloud-offline' as const,     color: '#64748B', bg: '#F1F5F9', label: 'Sem conexão' },
};

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor ? { color: valueColor, fontWeight: '700' } : null]}>{value}</Text>
    </View>
  );
}

export default function SyncStatusScreen({ navigation }: Props) {
  const { status, lastSync, pendingItems, syncNow, isSyncing, mudancasPendentes } = useSync();

  const cfg = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending;

  const handleSyncNow = useCallback(async () => {
    try { await syncNow(); }
    catch (e) { console.error('Erro ao sincronizar:', e); }
  }, [syncNow]);

  const totalPendentes = typeof pendingItems === 'object'
    ? Object.values(pendingItems as Record<string, number>).reduce((a, b) => a + b, 0)
    : mudancasPendentes;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={handleSyncNow}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      >
        {/* Status principal */}
        <View style={[s.statusCard, { backgroundColor: cfg.bg }]}>
          <View style={[s.statusIconCircle, { backgroundColor: cfg.color }]}>
            {isSyncing
              ? <ActivityIndicator color="#FFFFFF" size="large" />
              : <Ionicons name={cfg.icon} size={32} color="#FFFFFF" />}
          </View>
          <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          {lastSync && (
            <Text style={s.lastSync}>
              Última: {new Date(lastSync).toLocaleString('pt-BR')}
            </Text>
          )}
        </View>

        {/* Mudanças pendentes */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Mudanças Pendentes</Text>
          <InfoRow label="Total de pendências"
            value={String(totalPendentes)}
            valueColor={totalPendentes > 0 ? '#D97706' : '#16A34A'}
          />
          {typeof pendingItems === 'object' && Object.entries(pendingItems as Record<string, number>).map(([k, v]) =>
            v > 0 ? <InfoRow key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={String(v)} /> : null
          )}
        </View>

        {/* Detalhes da última sync */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Informações</Text>
          <InfoRow label="Status atual"    value={cfg.label} valueColor={cfg.color} />
          <InfoRow label="Última sync"     value={lastSync ? new Date(lastSync).toLocaleString('pt-BR') : 'Nunca'} />
          <InfoRow label="Mudanças locais" value={mudancasPendentes > 0 ? `${mudancasPendentes} alterações` : 'Tudo sincronizado'} />
        </View>

        {/* Botão */}
        <TouchableOpacity
          style={[s.btnSync, isSyncing && s.btnDisabled]}
          onPress={handleSyncNow}
          disabled={isSyncing}
          activeOpacity={0.85}
        >
          {isSyncing
            ? <><ActivityIndicator color="#FFFFFF" size="small" /><Text style={s.btnSyncText}>Sincronizando...</Text></>
            : <><Ionicons name="cloud-download" size={20} color="#FFFFFF" /><Text style={s.btnSyncText}>Sincronizar Agora</Text></>}
        </TouchableOpacity>

        <Text style={s.hint}>Puxe a tela para baixo para atualizar</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F8FAFC' },
  scroll:           { flex: 1, padding: 16 },
  statusCard:       { alignItems: 'center', borderRadius: 16, padding: 32, marginBottom: 16, gap: 8 },
  statusIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  statusLabel:      { fontSize: 20, fontWeight: '700', marginTop: 8 },
  lastSync:         { fontSize: 13, color: '#64748B' },
  section:          { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle:     { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel:        { fontSize: 14, color: '#64748B' },
  infoValue:        { fontSize: 14, color: '#1E293B', fontWeight: '500', textAlign: 'right' },
  btnSync:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563EB', padding: 16, borderRadius: 14, marginTop: 8, marginBottom: 8 },
  btnDisabled:      { backgroundColor: '#93C5FD' },
  btnSyncText:      { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  hint:             { textAlign: 'center', fontSize: 12, color: '#CBD5E1', marginBottom: 16 },
});
