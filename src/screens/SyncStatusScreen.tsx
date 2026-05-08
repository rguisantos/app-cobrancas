/**
 * SyncStatusScreen.tsx
 * Terminal de sincronização — mostra logs em tempo real como um terminal
 * - Captura automaticamente logs do SyncService, DatabaseService e ApiService
 * - Mostra o que está acontecendo em cada etapa do sync
 * - Contagem de registros por tabela no SQLite local
 * - Botões: Sincronizar Agora, Forçar Sincronização, Sync Completa, Snapshot
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../contexts/SyncContext';
import { useAuth } from '../contexts/AuthContext';
import { syncService } from '../services/SyncService';
import { apiService } from '../services/ApiService';
import { databaseService } from '../services/DatabaseService';
import syncEvents from '../utils/sync-events';
import logger from '../utils/logger';

// ============================================================================
// TIPOS
// ============================================================================

type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
}

interface TableCount {
  table: string;
  total: number;
  active: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#8B5CF6',
  info: '#2563EB',
  warn: '#D97706',
  error: '#DC2626',
  success: '#16A34A',
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  debug: 'bug',
  info: 'information-circle',
  warn: 'warning',
  error: 'close-circle',
  success: 'checkmark-circle',
};

const STATUS_MAP: Record<string, { icon: string; color: string; label: string }> = {
  syncing: { icon: 'sync', color: '#2563EB', label: 'Sincronizando...' },
  synced: { icon: 'checkmark-circle', color: '#16A34A', label: 'Sincronizado' },
  error: { icon: 'alert-circle', color: '#DC2626', label: 'Erro' },
  pending: { icon: 'time', color: '#D97706', label: 'Pendente' },
  offline: { icon: 'cloud-offline', color: '#64748B', label: 'Offline' },
  conflict: { icon: 'swap-horizontal', color: '#EA580C', label: 'Conflitos' },
};

const TABLES_TO_COUNT = [
  { table: 'clientes', label: 'Clientes', hasDeletedAt: true },
  { table: 'produtos', label: 'Produtos', hasDeletedAt: true },
  { table: 'locacoes', label: 'Locações', hasDeletedAt: true },
  { table: 'cobrancas', label: 'Cobranças', hasDeletedAt: true },
  { table: 'rotas', label: 'Rotas', hasDeletedAt: true },
  { table: 'usuarios', label: 'Usuários', hasDeletedAt: true },
  { table: 'manutencoes', label: 'Manutenções', hasDeletedAt: true },
  { table: 'metas', label: 'Metas', hasDeletedAt: true },
  { table: 'estabelecimentos', label: 'Estabelecimentos', hasDeletedAt: true },
  { table: 'tipos_produto', label: 'Tipos Produto', hasDeletedAt: true },
  { table: 'descricoes_produto', label: 'Descrições', hasDeletedAt: true },
  { table: 'tamanhos_produto', label: 'Tamanhos', hasDeletedAt: true },
  { table: 'change_log', label: 'Change Log', hasDeletedAt: false },
  { table: 'sync_metadata', label: 'Sync Meta', hasDeletedAt: false },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

let logCounter = 0;

export default function SyncStatusScreen() {
  const {
    status, lastSync, isSyncing, syncNow,
    mudancasPendentes, dispositivo, erro, ultimoErro,
    conflitosPendentes, totalConflitos, progress,
    sincronizar, verificarConexao, lastSyncAt, lastSyncMessage,
  } = useSync();
  const { user, token } = useAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [debugInfo, setDebugInfo] = useState({
    apiURL: '',
    deviceId: '',
    deviceKey: '',
    hasToken: false,
    dbInitialized: false,
    lastSyncAt: '',
  });
  const [showCounts, setShowCounts] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  const flatListRef = useRef<FlatList>(null);

  // ─── Adicionar log ──────────────────────────────────────────────────────
  const addLog = useCallback((level: LogLevel, message: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    logCounter++;
    setLogs(prev => [...prev.slice(-199), { id: logCounter, timestamp, level, message, details }]);
  }, []);

  // ─── Capturar logs do console automaticamente ───────────────────────────
  useEffect(() => {
    // Interceptar console.log/error/warn para capturar logs do sync
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      originalLog(...args);
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (msg.includes('[Sync') || msg.includes('[Database]') || msg.includes('applyRemoteChanges') || msg.includes('upsertFromSync')) {
        const level: LogLevel = msg.includes('ERRO') || msg.includes('❌') ? 'error' : msg.includes('warn') ? 'warn' : 'info';
        addLog(level, msg.substring(0, 200));
      }
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (msg.includes('[Sync') || msg.includes('[Database]') || msg.includes('[Api')) {
        addLog('error', msg.substring(0, 200));
      }
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (msg.includes('[Sync') || msg.includes('[Database]')) {
        addLog('warn', msg.substring(0, 200));
      }
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [addLog]);

  // ─── Escutar eventos de sync ────────────────────────────────────────────
  useEffect(() => {
    const unsub = syncEvents.onSyncComplete(() => {
      addLog('success', 'Sync completo — contextos notificados para recarregar dados');
      loadTableCounts();
    });
    return unsub;
  }, [addLog]);

  // ─── Contar registros por tabela ────────────────────────────────────────
  const loadTableCounts = useCallback(async () => {
    try {
      const counts: TableCount[] = [];
      for (const { table, label, hasDeletedAt } of TABLES_TO_COUNT) {
        try {
          const totalResult = await databaseService.getFirstAsync<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM ${table}`, []
          );
          // Só query deletedAt IS NULL para tabelas que têm essa coluna
          // change_log e sync_metadata NÃO têm deletedAt — causava ERR_INTERNAL_SQLITE_ERROR
          let active = totalResult?.cnt || 0;
          if (hasDeletedAt) {
            const activeResult = await databaseService.getFirstAsync<{ cnt: number }>(
              `SELECT COUNT(*) as cnt FROM ${table} WHERE deletedAt IS NULL`, []
            );
            active = activeResult?.cnt || 0;
          }
          counts.push({
            table: label,
            total: totalResult?.cnt || 0,
            active,
          });
        } catch {
          counts.push({ table: label, total: -1, active: -1 });
        }
      }
      setTableCounts(counts);
    } catch (error) {
      addLog('error', 'Erro ao contar registros', String(error));
    }
  }, [addLog]);

  // ─── Carregar informações ───────────────────────────────────────────────
  const loadInfo = useCallback(async () => {
    try {
      const metadata = await databaseService.getSyncMetadata();
      const apiURL = apiService['baseURL'] || 'N/A';

      setDebugInfo({
        apiURL,
        deviceId: metadata.deviceId || 'Não registrado',
        deviceKey: metadata.deviceKey ? `${metadata.deviceKey.substring(0, 20)}...` : 'N/A',
        hasToken: !!token,
        dbInitialized: true,
        lastSyncAt: metadata.lastSyncAt || 'Nunca',
      });

      // Network
      setNetworkStatus('checking');
      const connected = await verificarConexao();
      setNetworkStatus(connected ? 'online' : 'offline');

      await loadTableCounts();
      addLog('info', 'Informações carregadas');
    } catch (error) {
      addLog('error', 'Erro ao carregar informações', String(error));
    }
  }, [token, addLog, verificarConexao, loadTableCounts]);

  // ─── Sincronizar ────────────────────────────────────────────────────────
  const handleSyncNow = useCallback(async () => {
    addLog('info', '▶ Iniciando sincronização...');
    try {
      await syncNow();
      addLog('success', '✓ Sincronização concluída!');
      await loadInfo();
    } catch (e) {
      addLog('error', '✗ Erro na sincronização', String(e));
    }
  }, [syncNow, addLog, loadInfo]);

  // ─── Forçar sync ────────────────────────────────────────────────────────
  const handleForceSync = useCallback(async () => {
    Alert.alert(
      'Forçar Sincronização',
      'Isso irá forçar uma sincronização completa. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Forçar Sync',
          style: 'destructive',
          onPress: async () => {
            addLog('info', '▶ Forçando sincronização...');
            try {
              await sincronizar(true);
              addLog('success', '✓ Sincronização forçada concluída!');
              await loadInfo();
            } catch (e) {
              addLog('error', '✗ Erro na sync forçada', String(e));
            }
          },
        },
      ]
    );
  }, [sincronizar, addLog, loadInfo]);

  // ─── Sync completa ──────────────────────────────────────────────────────
  const handleFullSync = useCallback(async () => {
    Alert.alert(
      'Sincronização Completa',
      'Isso irá baixar TODOS os dados do servidor novamente. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: async () => {
            addLog('info', '▶ Iniciando sincronização completa (fullSync)...');
            try {
              const result = await syncService.fullSync();
              if (result.success) {
                addLog('success', `✓ Sync completa! Push: ${result.pushed}, Pull: ${result.pulled}`);
                syncEvents.emitSyncComplete();
              } else {
                addLog('error', `✗ Falha na sync completa: ${result.errors.join(', ')}`);
              }
              await loadInfo();
            } catch (error) {
              addLog('error', '✗ Erro na sync completa', String(error));
            }
          },
        },
      ]
    );
  }, [addLog, loadInfo]);

  // ─── Snapshot sync ──────────────────────────────────────────────────────
  const handleSnapshotSync = useCallback(async () => {
    Alert.alert(
      'Snapshot Sync',
      'Isso baixa o snapshot completo do servidor (para dispositivo desatualizado). Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: async () => {
            addLog('info', '▶ Iniciando snapshot sync...');
            try {
              const count = await syncService.syncFromSnapshot();
              if (count > 0) {
                addLog('success', `✓ Snapshot baixado! ${count} registros`);
                syncEvents.emitSyncComplete();
              } else {
                addLog('warn', '⚠ Snapshot retornou 0 registros');
              }
              await loadInfo();
            } catch (error) {
              addLog('error', '✗ Erro no snapshot', String(error));
            }
          },
        },
      ]
    );
  }, [addLog, loadInfo]);

  // ─── Testar conexão ─────────────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    addLog('info', 'Testando conexão com a API...');
    setNetworkStatus('checking');
    try {
      const health = await apiService.healthCheck();
      if (health.ok) {
        setNetworkStatus('online');
        addLog('success', '✓ API online');
      } else {
        setNetworkStatus('offline');
        addLog('error', '✗ API retornou erro');
      }
    } catch (error) {
      setNetworkStatus('offline');
      addLog('error', '✗ Falha ao conectar', String(error));
    }
  }, [addLog]);

  // ─── Testar pull manualmente ────────────────────────────────────────────
  const handleTestPull = useCallback(async () => {
    addLog('info', '▶ Teste: Executando pull manual...');
    try {
      const result = await syncService.pullChanges();
      addLog('info', `Pull result: ${result.pulled} registros, ${result.errors.length} erros`);
      if (result.pulled > 0) {
        addLog('success', `✓ ${result.pulled} registros baixados do servidor`);
        syncEvents.emitSyncComplete();
      } else {
        addLog('info', 'Nenhum registro novo para baixar');
      }
      await loadTableCounts();
    } catch (error) {
      addLog('error', '✗ Erro no pull', String(error));
    }
  }, [addLog, loadTableCounts]);

  // ─── Limpar logs ────────────────────────────────────────────────────────
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // ─── Carregar ao iniciar ────────────────────────────────────────────────
  useEffect(() => {
    loadInfo();
    addLog('info', 'Terminal de sincronização aberto');
    addLog('info', `Status atual: ${status}`);
    if (dispositivo?.registrado) {
      addLog('success', `Dispositivo registrado: ${dispositivo.chave?.substring(0, 20)}...`);
    } else {
      addLog('warn', 'Dispositivo NÃO registrado');
    }
  }, []);

  // ─── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [logs, autoScroll]);

  // ─── Cálculos ───────────────────────────────────────────────────────────
  const cfg = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending;

  // ============================================================================
  // RENDER
  // ============================================================================

  const renderLog = useCallback(({ item }: { item: LogEntry }) => (
    <View style={[t.logLine, { borderLeftColor: LEVEL_COLORS[item.level] }]}>
      <Text style={t.logTime}>{item.timestamp}</Text>
      <Ionicons
        name={LEVEL_ICONS[item.level] as any}
        size={12}
        color={LEVEL_COLORS[item.level]}
        style={t.logIcon}
      />
      <Text style={[t.logMsg, { color: LEVEL_COLORS[item.level] }]} numberOfLines={3}>
        {item.message}
      </Text>
    </View>
  ), []);

  return (
    <SafeAreaView style={t.container} edges={['bottom']}>
      {/* Header com status */}
      <View style={[t.header, { backgroundColor: cfg.color + '15' }]}>
        <View style={t.headerLeft}>
          {isSyncing
            ? <ActivityIndicator color={cfg.color} size="small" />
            : <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />}
          <Text style={[t.headerTitle, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={t.headerRight}>
          <View style={[t.dot, {
            backgroundColor: networkStatus === 'online' ? '#16A34A' : networkStatus === 'offline' ? '#DC2626' : '#D97706'
          }]} />
          <Text style={t.headerSub}>
            {lastSyncAt ? new Date(lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}
          </Text>
        </View>
      </View>

      {/* Progresso */}
      {isSyncing && progress && (
        <View style={t.progressWrap}>
          <View style={t.progressBar}>
            <View style={[t.progressFill, { width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }]} />
          </View>
          <Text style={t.progressText}>{progress.message}</Text>
        </View>
      )}

      {/* Mensagem do último sync */}
      {lastSyncMessage && !isSyncing && (
        <View style={t.msgWrap}>
          <Text style={t.msgText} numberOfLines={1}>{lastSyncMessage}</Text>
        </View>
      )}

      {/* Ações rápidas */}
      <View style={t.actions}>
        <TouchableOpacity style={[t.actionBtn, { backgroundColor: '#2563EB' }]} onPress={handleSyncNow} disabled={isSyncing}>
          {isSyncing ? <ActivityIndicator color="#FFF" size={14} /> : <Ionicons name="sync" size={16} color="#FFF" />}
          <Text style={t.actionBtnText}>Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[t.actionBtn, { backgroundColor: '#D97706' }]} onPress={handleForceSync} disabled={isSyncing}>
          <Ionicons name="refresh" size={16} color="#FFF" />
          <Text style={t.actionBtnText}>Forçar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[t.actionBtn, { backgroundColor: '#DC2626' }]} onPress={handleFullSync} disabled={isSyncing}>
          <Ionicons name="download" size={16} color="#FFF" />
          <Text style={t.actionBtnText}>Full</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[t.actionBtn, { backgroundColor: '#7C3AED' }]} onPress={handleSnapshotSync} disabled={isSyncing}>
          <Ionicons name="cloud-download" size={16} color="#FFF" />
          <Text style={t.actionBtnText}>Snap</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[t.actionBtn, { backgroundColor: '#059669' }]} onPress={handleTestPull} disabled={isSyncing}>
          <Ionicons name="arrow-down" size={16} color="#FFF" />
          <Text style={t.actionBtnText}>Pull</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[t.actionBtn, { backgroundColor: '#64748B' }]} onPress={testConnection}>
          <Ionicons name="wifi" size={16} color="#FFF" />
          <Text style={t.actionBtnText}>Ping</Text>
        </TouchableOpacity>
      </View>

      {/* Contagem de registros (colapsável) */}
      <TouchableOpacity style={t.countsHeader} onPress={() => setShowCounts(!showCounts)}>
        <Text style={t.countsTitle}>REGISTROS LOCAIS ({tableCounts.reduce((a, c) => a + Math.max(c.active, 0), 0)})</Text>
        <Ionicons name={showCounts ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
      </TouchableOpacity>

      {showCounts && (
        <View style={t.countsGrid}>
          {tableCounts.map(tc => (
            <View key={tc.table} style={t.countItem}>
              <Text style={t.countLabel}>{tc.table}</Text>
              <Text style={[t.countValue, { color: tc.active > 0 ? '#16A34A' : '#94A3B8' }]}>
                {tc.total >= 0 ? String(tc.active) : '?'}
              </Text>
              {tc.total > tc.active && (
                <Text style={t.countDeleted}>+{tc.total - tc.active} del</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Debug info */}
      <View style={t.debugRow}>
        <Text style={t.debugText}>
          Device: {debugInfo.deviceId.substring(0, 12)}{debugInfo.deviceId.length > 12 ? '...' : ''}
        </Text>
        <Text style={t.debugText}>
          Token: {debugInfo.hasToken ? '✓' : '✗'}
        </Text>
        <Text style={t.debugText}>
          DB: {debugInfo.dbInitialized ? '✓' : '✗'}
        </Text>
        <Text style={t.debugText}>
          Pending: {mudancasPendentes}
        </Text>
      </View>

      {/* Terminal de logs */}
      <View style={t.terminal}>
        <View style={t.terminalHeader}>
          <View style={t.terminalDots}>
            <View style={[t.terminalDot, { backgroundColor: '#EF4444' }]} />
            <View style={[t.terminalDot, { backgroundColor: '#F59E0B' }]} />
            <View style={[t.terminalDot, { backgroundColor: '#22C55E' }]} />
          </View>
          <Text style={t.terminalTitle}>TERMINAL — LOGS</Text>
          <View style={t.terminalActions}>
            <TouchableOpacity onPress={clearLogs} style={t.terminalAction}>
              <Ionicons name="trash" size={14} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAutoScroll(!autoScroll)} style={t.terminalAction}>
              <Ionicons name={autoScroll ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={14} color={autoScroll ? '#2563EB' : '#64748B'} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={logs}
          renderItem={renderLog}
          keyExtractor={item => String(item.id)}
          style={t.terminalBody}
          ListEmptyComponent={
            <Text style={t.emptyLog}>Aguardando atividades... Pressione "Sync" para iniciar.</Text>
          }
          onContentSizeChange={() => {
            if (autoScroll) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS (Terminal-like)
// ============================================================================

const t = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Progress
  progressWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Last sync message
  msgWrap: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  msgText: {
    fontSize: 12,
    color: '#64748B',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Counts
  countsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  countsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  countsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  countValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  countDeleted: {
    fontSize: 9,
    color: '#64748B',
  },

  // Debug row
  debugRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  debugText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
  },

  // Terminal
  terminal: {
    flex: 1,
    backgroundColor: '#020617',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  terminalDots: {
    flexDirection: 'row',
    gap: 4,
  },
  terminalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  terminalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    flex: 1,
  },
  terminalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  terminalAction: {
    padding: 4,
  },
  terminalBody: {
    flex: 1,
    padding: 8,
  },
  emptyLog: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    paddingVertical: 24,
    fontFamily: 'monospace',
  },

  // Log line
  logLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderLeftWidth: 2,
    paddingLeft: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  logTime: {
    fontSize: 10,
    color: '#475569',
    fontFamily: 'monospace',
    width: 65,
  },
  logIcon: {
    marginTop: 1,
  },
  logMsg: {
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
  },
});
