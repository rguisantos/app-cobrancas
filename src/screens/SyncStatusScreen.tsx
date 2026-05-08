/**
 * SyncStatusScreen.tsx
 * Status detalhado de sincronização com logs em tempo real
 * - Usa SyncContext para informações de sync
 * - Mostra última sincronização, mudanças pendentes, status atual
 * - Estatísticas por entidade
 * - Conflitos pendentes
 * - Status de conectividade
 * - Botões: Sincronizar Agora, Forçar Sincronização, Sync Completa
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useSync }      from '../contexts/SyncContext';
import { useAuth }      from '../contexts/AuthContext';
import { syncService }  from '../services/SyncService';
import { apiService }   from '../services/ApiService';
import { databaseService } from '../services/DatabaseService';

// ============================================================================
// TIPOS
// ============================================================================

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

interface EntityStat {
  name: string;
  pending: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// ============================================================================
// STATUS MAP
// ============================================================================

const STATUS_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  syncing: { icon: 'sync',              color: '#2563EB', bg: '#EFF6FF', label: 'Sincronizando...' },
  synced:  { icon: 'checkmark-circle',  color: '#16A34A', bg: '#F0FDF4', label: 'Sincronizado' },
  error:   { icon: 'alert-circle',      color: '#DC2626', bg: '#FEF2F2', label: 'Erro na sincronização' },
  pending: { icon: 'time',              color: '#D97706', bg: '#FFFBEB', label: 'Mudanças pendentes' },
  offline: { icon: 'cloud-offline',     color: '#64748B', bg: '#F1F5F9', label: 'Sem conexão' },
  conflict:{ icon: 'swap-horizontal',   color: '#EA580C', bg: '#FFF7ED', label: 'Conflitos pendentes' },
};

// ============================================================================
// ENTITY CONFIG
// ============================================================================

const ENTITY_ICONS: Record<string, { name: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  cliente:    { name: 'Clientes',      icon: 'people',     color: '#2563EB' },
  produto:    { name: 'Produtos',      icon: 'cube',       color: '#16A34A' },
  locacao:    { name: 'Locações',      icon: 'key',        color: '#8B5CF6' },
  cobranca:   { name: 'Cobranças',     icon: 'cash',       color: '#D97706' },
  manutencao: { name: 'Manutenções',   icon: 'construct',  color: '#EA580C' },
  meta:       { name: 'Metas',         icon: 'trophy',     color: '#7C3AED' },
  rota:       { name: 'Rotas',         icon: 'map',        color: '#059669' },
  usuario:    { name: 'Usuários',      icon: 'person',     color: '#64748B' },
  estabelecimento: { name: 'Estabelecimentos', icon: 'business', color: '#0891B2' },
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

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

function EntityStatRow({ stat }: { stat: EntityStat }) {
  return (
    <View style={s.entityRow}>
      <View style={[s.entityIcon, { backgroundColor: stat.color + '1A' }]}>
        <Ionicons name={stat.icon} size={16} color={stat.color} />
      </View>
      <Text style={s.entityName}>{stat.name}</Text>
      {stat.pending > 0 ? (
        <View style={[s.entityBadge, { backgroundColor: '#FEF3C7' }]}>
          <Text style={s.entityBadgeText}>{stat.pending} pendente{stat.pending > 1 ? 's' : ''}</Text>
        </View>
      ) : (
        <View style={[s.entityBadge, { backgroundColor: '#F0FDF4' }]}>
          <Text style={[s.entityBadgeText, { color: '#16A34A' }]}>✓</Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SyncStatusScreen() {
  const {
    status, lastSync, pendingItems, syncNow, isSyncing,
    mudancasPendentes, dispositivo, erro, ultimoErro,
    conflitosPendentes, totalConflitos, progress,
    sincronizar, verificarConexao,
  } = useSync();
  const { user, token } = useAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [entityStats, setEntityStats] = useState<EntityStat[]>([]);
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

  // ─── carregar informações ─────────────────────────────────────────────────
  const loadInfo = useCallback(async () => {
    try {
      // Debug info
      const metadata = await databaseService.getSyncMetadata();
      const apiURL = apiService['baseURL'] || 'N/A';

      setDebugInfo({
        apiURL,
        deviceId: metadata.deviceId || 'Não registrado',
        deviceKey: metadata.deviceKey ? `${metadata.deviceKey.substring(0, 15)}...` : 'N/A',
        hasToken: !!token,
        dbInitialized: true,
      });

      // Network status
      setNetworkStatus('checking');
      const connected = await verificarConexao();
      setNetworkStatus(connected ? 'online' : 'offline');

      // Entity stats
      const counts = await databaseService.getPendingChangesCountByEntity();
      const stats: EntityStat[] = [];
      for (const [entityType, count] of Object.entries(counts)) {
        const cfg = ENTITY_ICONS[entityType] || {
          name: entityType.charAt(0).toUpperCase() + entityType.slice(1),
          icon: 'ellipse' as keyof typeof Ionicons.glyphMap,
          color: '#64748B',
        };
        stats.push({ name: cfg.name, pending: count, icon: cfg.icon, color: cfg.color });
      }
      // Adicionar entidades sem pendências
      for (const [entityType, cfg] of Object.entries(ENTITY_ICONS)) {
        if (!counts[entityType]) {
          stats.push({ name: cfg.name, pending: 0, icon: cfg.icon, color: cfg.color });
        }
      }
      setEntityStats(stats);

      addLog('info', 'Informações carregadas');
    } catch (error) {
      addLog('error', 'Erro ao carregar informações', String(error));
    }
  }, [token, addLog, verificarConexao]);

  // ─── testar conexão ───────────────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    addLog('info', 'Testando conexão com a API...');
    setNetworkStatus('checking');
    try {
      const health = await apiService.healthCheck();
      if (health.ok) {
        setNetworkStatus('online');
        addLog('success', 'Conexão com API OK', `Timestamp: ${health.timestamp}`);
      } else {
        setNetworkStatus('offline');
        addLog('error', 'API retornou erro', `Status: ${health.timestamp}`);
      }
    } catch (error) {
      setNetworkStatus('offline');
      addLog('error', 'Falha ao conectar com API', String(error));
    }
  }, [addLog]);

  // ─── sincronizar agora ────────────────────────────────────────────────────
  const handleSyncNow = useCallback(async () => {
    addLog('info', 'Iniciando sincronização...');
    try {
      await syncNow();
      addLog('success', 'Sincronização concluída!');
      await loadInfo(); // Recarregar stats
    } catch (e) {
      addLog('error', 'Erro na sincronização', String(e));
    }
  }, [syncNow, addLog, loadInfo]);

  // ─── forçar sincronização ─────────────────────────────────────────────────
  const handleForceSync = useCallback(async () => {
    Alert.alert(
      'Forçar Sincronização',
      'Isso irá forçar uma sincronização completa, reenviando todas as mudanças pendentes. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Forçar Sync',
          style: 'destructive',
          onPress: async () => {
            addLog('info', 'Forçando sincronização...');
            try {
              await sincronizar(true);
              addLog('success', 'Sincronização forçada concluída!');
              await loadInfo();
            } catch (e) {
              addLog('error', 'Erro na sincronização forçada', String(e));
            }
          },
        },
      ]
    );
  }, [sincronizar, addLog, loadInfo]);

  // ─── sync completo (forçar download) ──────────────────────────────────────
  const handleFullSync = useCallback(async () => {
    Alert.alert(
      'Sincronização Completa',
      'Isso irá baixar todos os dados do servidor novamente. Isso pode demorar. Continuar?',
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
              await loadInfo();
            } catch (error) {
              addLog('error', 'Erro na sync completa', String(error));
            }
          },
        },
      ]
    );
  }, [addLog, loadInfo]);

  // ─── limpar logs ──────────────────────────────────────────────────────────
  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'Logs limpos');
  }, [addLog]);

  // ─── carregar ao iniciar ──────────────────────────────────────────────────
  useEffect(() => {
    loadInfo();
    addLog('info', 'Tela de sincronização aberta');
  }, [loadInfo, addLog]);

  // Auto-scroll
  useEffect(() => {
    if (logs.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [logs]);

  // ─── cálculos ─────────────────────────────────────────────────────────────
  const cfg = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending;
  const totalPendentes = typeof pendingItems === 'object'
    ? Object.values(pendingItems as Record<string, number>).reduce((a, b) => a + b, 0)
    : mudancasPendentes;

  const pendingEntities = typeof pendingItems === 'object'
    ? Object.entries(pendingItems as Record<string, number>).filter(([, v]) => v > 0)
    : [];

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

          {/* Progress bar */}
          {isSyncing && progress && (
            <View style={s.progressContainer}>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }]} />
              </View>
              <Text style={s.progressText}>{progress.message}</Text>
            </View>
          )}
        </View>

        {/* Conectividade */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CONECTIVIDADE</Text>
          <View style={s.connectivityRow}>
            <View style={[s.connectivityDot, {
              backgroundColor: networkStatus === 'online' ? '#16A34A' : networkStatus === 'offline' ? '#DC2626' : '#D97706',
            }]} />
            <Text style={s.connectivityText}>
              {networkStatus === 'online' ? 'Online' : networkStatus === 'offline' ? 'Offline' : 'Verificando...'}
            </Text>
            <TouchableOpacity style={s.smallBtn} onPress={testConnection}>
              <Ionicons name="refresh" size={14} color="#2563EB" />
              <Text style={s.smallBtnText}>Testar</Text>
            </TouchableOpacity>
          </View>
          <InfoRow label="API URL" value={debugInfo.apiURL} />
          <InfoRow label="Token" value={debugInfo.hasToken ? 'Presente' : 'Ausente'}
            valueColor={debugInfo.hasToken ? '#16A34A' : '#DC2626'} />
        </View>

        {/* Conflitos */}
        {totalConflitos > 0 && (
          <View style={[s.section, { borderLeftWidth: 3, borderLeftColor: '#EA580C' }]}>
            <Text style={s.sectionTitle}>CONFLITOS PENDENTES</Text>
            <View style={s.conflictRow}>
              <Ionicons name="warning" size={20} color="#EA580C" />
              <Text style={s.conflictText}>
                {totalConflitos} conflito{totalConflitos > 1 ? 's' : ''} sem resolução
              </Text>
            </View>
            {conflitosPendentes.slice(0, 5).map((c, i) => (
              <View key={c.entityId || i} style={s.conflictItem}>
                <Text style={s.conflictEntity}>{c.entityType}: {c.entityId.substring(0, 8)}...</Text>
                <Text style={s.conflictType}>{c.conflictType}</Text>
              </View>
            ))}
            {conflitosPendentes.length > 5 && (
              <Text style={s.conflictMore}>...e mais {conflitosPendentes.length - 5} conflitos</Text>
            )}
          </View>
        )}

        {/* Mudanças pendentes */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MUDANÇAS PENDENTES</Text>
          <InfoRow label="Total de pendências"
            value={String(totalPendentes)}
            valueColor={totalPendentes > 0 ? '#D97706' : '#16A34A'}
          />
          {pendingEntities.map(([k, v]) => {
            const cfg = ENTITY_ICONS[k];
            return (
              <InfoRow key={k} label={cfg?.name || k} value={String(v)} valueColor="#D97706" />
            );
          })}
        </View>

        {/* Estatísticas por entidade */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ESTATÍSTICAS POR ENTIDADE</Text>
          {entityStats.length > 0 ? (
            entityStats.map(stat => (
              <EntityStatRow key={stat.name} stat={stat} />
            ))
          ) : (
            <Text style={s.noData}>Carregando estatísticas...</Text>
          )}
        </View>

        {/* Dispositivo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>DISPOSITIVO</Text>
          <InfoRow label="Device ID" value={debugInfo.deviceId}
            valueColor={debugInfo.deviceId !== 'Não registrado' ? '#16A34A' : '#DC2626'} />
          <InfoRow label="Device Key" value={debugInfo.deviceKey} />
          {dispositivo && (
            <>
              <InfoRow label="Nome" value={dispositivo.nome || 'N/A'} />
              <InfoRow label="Registrado" value={dispositivo.registrado ? 'Sim' : 'Não'}
                valueColor={dispositivo.registrado ? '#16A34A' : '#DC2626'} />
            </>
          )}
          <InfoRow label="DB" value={debugInfo.dbInitialized ? 'Inicializado' : 'Erro'}
            valueColor={debugInfo.dbInitialized ? '#16A34A' : '#DC2626'} />
        </View>

        {/* Botões de ação */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>AÇÕES</Text>

          <TouchableOpacity style={s.actionBtn} onPress={testConnection}>
            <Ionicons name="wifi" size={18} color="#2563EB" />
            <Text style={s.actionBtnText}>Testar Conexão API</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={handleForceSync}>
            <Ionicons name="sync" size={18} color="#D97706" />
            <Text style={s.actionBtnText}>Forçar Sincronização</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={handleFullSync}>
            <Ionicons name="download" size={18} color="#DC2626" />
            <Text style={s.actionBtnText}>Sync Completa (Forçar Download)</Text>
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

// ============================================================================
// ESTILOS
// ============================================================================

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F8FAFC' },
  scroll:           { flex: 1, padding: 16 },

  // Status card
  statusCard:       { alignItems: 'center', borderRadius: 16, padding: 28, marginBottom: 16, gap: 8 },
  statusIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  statusLabel:      { fontSize: 20, fontWeight: '700', marginTop: 8 },
  lastSync:         { fontSize: 13, color: '#64748B' },
  errorText:        { fontSize: 13, color: '#DC2626', marginTop: 8, textAlign: 'center' },

  // Progress
  progressContainer:{ width: '100%', marginTop: 8, gap: 4 },
  progressBar:      { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: '#2563EB', borderRadius: 2 },
  progressText:     { fontSize: 11, color: '#64748B', textAlign: 'center' },

  // Sections
  section:          { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle:     { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  noData:           { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },

  // Connectivity
  connectivityRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  connectivityDot:  { width: 10, height: 10, borderRadius: 5 },
  connectivityText: { fontSize: 14, fontWeight: '600', color: '#1E293B', flex: 1 },
  smallBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#EFF6FF' },
  smallBtnText:     { fontSize: 12, fontWeight: '600', color: '#2563EB' },

  // Conflicts
  conflictRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  conflictText:     { fontSize: 14, fontWeight: '600', color: '#EA580C', flex: 1 },
  conflictItem:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  conflictEntity:   { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  conflictType:     { fontSize: 12, color: '#64748B' },
  conflictMore:     { fontSize: 12, color: '#94A3B8', paddingTop: 4 },

  // Entity stats
  entityRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  entityIcon:       { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  entityName:       { fontSize: 14, color: '#1E293B', fontWeight: '500', flex: 1 },
  entityBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  entityBadgeText:  { fontSize: 11, fontWeight: '700', color: '#D97706' },

  // Info
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel:        { fontSize: 14, color: '#64748B' },
  infoValue:        { fontSize: 14, color: '#1E293B', fontWeight: '500', textAlign: 'right' },

  // Action buttons
  actionBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionBtnText:    { fontSize: 14, color: '#2563EB', fontWeight: '600' },

  // Main sync button
  btnSync:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563EB', padding: 16, borderRadius: 14, marginTop: 8, marginBottom: 8 },
  btnDisabled:      { backgroundColor: '#93C5FD' },
  btnSyncText:      { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  hint:             { textAlign: 'center', fontSize: 12, color: '#CBD5E1', marginBottom: 16 },

  // Logs
  logsSection:      { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  logsHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  clearBtn:         { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  noLogs:           { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 20 },
  logItem:          { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 8, marginBottom: 4, backgroundColor: '#F8FAFC', borderRadius: 4 },
  logHeader:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  logLevel:         { fontSize: 10, fontWeight: '700' },
  logTime:          { fontSize: 10, color: '#94A3B8' },
  logMessage:       { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  logDetails:       { fontSize: 11, color: '#64748B', marginTop: 2, fontFamily: 'monospace' },
});
