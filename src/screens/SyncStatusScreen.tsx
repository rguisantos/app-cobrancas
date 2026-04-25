/**
 * SyncStatusScreen.tsx
 * Status detalhado de sincronização com logs em tempo real
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ModalStackParamList } from '../navigation/AppNavigator';
import { useSync }      from '../contexts/SyncContext';
import { useAuth }      from '../contexts/AuthContext';
import { syncService }  from '../services/SyncService';
import { apiService }   from '../services/ApiService';
import { databaseService } from '../services/DatabaseService';
import { formatarData } from '../utils/currency';
import logger from '../utils/logger';

type Props = NativeStackScreenProps<ModalStackParamList, 'SyncStatus'>;

const STATUS_MAP = {
  syncing: { icon: 'sync' as const,             color: '#2563EB', bg: '#EFF6FF', label: 'Sincronizando...' },
  synced:  { icon: 'checkmark-circle' as const,  color: '#16A34A', bg: '#F0FDF4', label: 'Sincronizado' },
  error:   { icon: 'alert-circle' as const,      color: '#DC2626', bg: '#FEF2F2', label: 'Erro na sincronização' },
  pending: { icon: 'time' as const,              color: '#D97706', bg: '#FFFBEB', label: 'Mudanças pendentes' },
  offline: { icon: 'cloud-offline' as const,     color: '#64748B', bg: '#F1F5F9', label: 'Sem conexão' },
};

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor ? { color: valueColor, fontWeight: '700' } : null]}>{value}</Text>
    </View>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  const levelColors = {
    info: '#2563EB',
    warn: '#D97706',
    error: '#DC2626',
    success: '#16A34A',
  };

  return (
    <View style={[s.logItem, { borderLeftColor: levelColors[log.level] }]}>
      <View style={s.logHeader}>
        <Text style={[s.logLevel, { color: levelColors[log.level] }]}>
          {log.level.toUpperCase()}
        </Text>
        <Text style={s.logTime}>{log.timestamp}</Text>
      </View>
      <Text style={s.logMessage}>{log.message}</Text>
      {log.details && <Text style={s.logDetails}>{log.details}</Text>}
    </View>
  );
}

export default function SyncStatusScreen({ navigation }: Props) {
  const { status, lastSync, pendingItems, syncNow, isSyncing, mudancasPendentes, dispositivo, erro, ultimoErro } = useSync();
  const { user, token } = useAuth();
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    apiURL: '',
    deviceId: '',
    deviceKey: '',
    hasToken: false,
    dbInitialized: false,
  });
  
  const scrollViewRef = useRef<ScrollView>(null);

  // Adicionar log
  const addLog = useCallback((level: LogEntry['level'], message: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setLogs(prev => [...prev.slice(-99), { timestamp, level, message, details }]);
  }, []);

  // Carregar informações de debug
  const loadDebugInfo = useCallback(async () => {
    try {
      const metadata = await databaseService.getSyncMetadata();
      const apiURL = apiService['baseURL'] || 'N/A';
      
      setDebugInfo({
        apiURL,
        deviceId: metadata.deviceId || 'Não registrado',
        deviceKey: metadata.deviceKey ? `${metadata.deviceKey.substring(0, 15)}...` : 'N/A',
        hasToken: !!token,
        dbInitialized: true,
      });
      
      addLog('info', 'Debug info carregado', `API: ${apiURL}`);
    } catch (error) {
      addLog('error', 'Erro ao carregar debug info', String(error));
    }
  }, [token, addLog]);

  // Testar conexão com a API
  const testConnection = useCallback(async () => {
    addLog('info', 'Testando conexão com a API...');
    try {
      const health = await apiService.healthCheck();
      if (health.ok) {
        addLog('success', 'Conexão com API OK', `Timestamp: ${health.timestamp}`);
      } else {
        addLog('error', 'API retornou erro', `Status: ${health.timestamp}`);
      }
    } catch (error) {
      addLog('error', 'Falha ao conectar com API', String(error));
    }
  }, [addLog]);

  // Testar registro de dispositivo
  const testDeviceRegistration = useCallback(async () => {
    addLog('info', 'Testando registro de dispositivo...');
    try {
      const metadata = await databaseService.getSyncMetadata();
      addLog('info', 'Metadata atual', JSON.stringify({
        deviceId: metadata.deviceId || 'N/A',
        deviceKey: metadata.deviceKey ? 'presente' : 'ausente',
        deviceName: metadata.deviceName || 'N/A',
      }));

      if (!metadata.deviceId || !metadata.deviceKey) {
        addLog('warn', 'Dispositivo não registrado. Tentando registrar...');
        const registrado = await syncService.registerDevice();
        if (registrado) {
          addLog('success', 'Dispositivo registrado com sucesso!');
          await loadDebugInfo();
        } else {
          addLog('error', 'Falha ao registrar dispositivo');
        }
      } else {
        addLog('success', 'Dispositivo já registrado', `ID: ${metadata.deviceId}`);
      }
    } catch (error) {
      addLog('error', 'Erro no registro', String(error));
    }
  }, [addLog, loadDebugInfo]);

  // Executar sync com logs
  const handleSyncNow = useCallback(async () => {
    addLog('info', 'Iniciando sincronização manual...');
    try {
      await syncNow();
      addLog('success', 'Sincronização concluída!');
    } catch (e) {
      addLog('error', 'Erro na sincronização', String(e));
    }
  }, [syncNow, addLog]);

  // Sync completo (forçar download)
  const handleFullSync = useCallback(async () => {
    Alert.alert(
      'Sincronização Completa',
      'Isso irá baixar todos os dados do servidor novamente. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Continuar', 
          style: 'destructive',
          onPress: async () => {
            addLog('info', 'Iniciando sincronização completa...');
            try {
              const result = await syncService.fullSync();
              if (result.success) {
                addLog('success', 'Sync completa!', `Push: ${result.pushed}, Pull: ${result.pulled}`);
              } else {
                addLog('error', 'Falha na sync completa', result.errors.join(', '));
              }
            } catch (error) {
              addLog('error', 'Erro na sync completa', String(error));
            }
          }
        }
      ]
    );
  }, [addLog]);

  // Limpar logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'Logs limpos');
  }, [addLog]);

  // Carregar ao iniciar
  useEffect(() => {
    loadDebugInfo();
    addLog('info', 'Tela de sincronização aberta');
  }, [loadDebugInfo, addLog]);

  // Auto-scroll para o final
  useEffect(() => {
    if (logs.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [logs]);

  const cfg = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending;
  const totalPendentes = typeof pendingItems === 'object'
    ? Object.values(pendingItems as Record<string, number>).reduce((a, b) => a + b, 0)
    : mudancasPendentes;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView
        ref={scrollViewRef}
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
          {erro && <Text style={s.errorText}>{erro}</Text>}
        </View>

        {/* Debug Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>DEBUG INFO</Text>
          <InfoRow label="API URL" value={debugInfo.apiURL} />
          <InfoRow label="Device ID" value={debugInfo.deviceId} 
            valueColor={debugInfo.deviceId !== 'Não registrado' ? '#16A34A' : '#DC2626'} />
          <InfoRow label="Device Key" value={debugInfo.deviceKey} />
          <InfoRow label="Token" value={debugInfo.hasToken ? 'Presente' : 'Ausente'}
            valueColor={debugInfo.hasToken ? '#16A34A' : '#DC2626'} />
          <InfoRow label="DB" value={debugInfo.dbInitialized ? 'Inicializado' : 'Erro'}
            valueColor={debugInfo.dbInitialized ? '#16A34A' : '#DC2626'} />
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

        {/* Dispositivo */}
        {dispositivo && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Dispositivo</Text>
            <InfoRow label="Nome" value={dispositivo.nome || 'N/A'} />
            <InfoRow label="Registrado" value={dispositivo.registrado ? 'Sim' : 'Não'}
              valueColor={dispositivo.registrado ? '#16A34A' : '#DC2626'} />
          </View>
        )}

        {/* Botões de teste */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>AÇÕES DE DEBUG</Text>
          
          <TouchableOpacity style={s.debugBtn} onPress={testConnection}>
            <Ionicons name="wifi" size={18} color="#2563EB" />
            <Text style={s.debugBtnText}>Testar Conexão API</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={s.debugBtn} onPress={testDeviceRegistration}>
            <Ionicons name="phone-portrait" size={18} color="#2563EB" />
            <Text style={s.debugBtnText}>Testar Registro Dispositivo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={s.debugBtn} onPress={handleFullSync}>
            <Ionicons name="download" size={18} color="#D97706" />
            <Text style={s.debugBtnText}>Sync Completa (Forçar Download)</Text>
          </TouchableOpacity>
        </View>

        {/* Botão principal */}
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

        {/* Logs */}
        <View style={s.logsSection}>
          <View style={s.logsHeader}>
            <Text style={s.sectionTitle}>LOGS EM TEMPO REAL</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={s.clearBtn}>Limpar</Text>
            </TouchableOpacity>
          </View>
          
          {logs.length === 0 ? (
            <Text style={s.noLogs}>Nenhum log ainda</Text>
          ) : (
            logs.map((log, index) => (
              <LogItem key={index} log={log} />
            ))
          )}
        </View>

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
  errorText:        { fontSize: 13, color: '#DC2626', marginTop: 8, textAlign: 'center' },
  section:          { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle:     { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel:        { fontSize: 14, color: '#64748B' },
  infoValue:        { fontSize: 14, color: '#1E293B', fontWeight: '500', textAlign: 'right' },
  btnSync:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563EB', padding: 16, borderRadius: 14, marginTop: 8, marginBottom: 8 },
  btnDisabled:      { backgroundColor: '#93C5FD' },
  btnSyncText:      { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  hint:             { textAlign: 'center', fontSize: 12, color: '#CBD5E1', marginBottom: 16 },
  
  // Debug buttons
  debugBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  debugBtnText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  
  // Logs
  logsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearBtn: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  noLogs: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  logItem: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 8,
    marginBottom: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  logLevel: {
    fontSize: 10,
    fontWeight: '700',
  },
  logTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  logMessage: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },
  logDetails: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
