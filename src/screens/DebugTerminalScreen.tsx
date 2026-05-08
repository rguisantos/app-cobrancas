/**
 * DebugTerminalScreen.tsx
 * Tela de terminal de debug para visualização de logs em tempo real
 * - Mostra todos os logs do Logger (info, warn, error, debug)
 * - Atualização em tempo real via listener
 * - Filtros por nível de log
 * - Estilo terminal com fundo escuro e fonte monospace
 * - Contagem de registros no SQLite local
 * - Botão para exportar logs
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import logger, { LogEntry } from '../utils/logger';
import { databaseService } from '../services/DatabaseService';
import { useSync } from '../contexts/SyncContext';

// ============================================================================
// TIPOS
// ============================================================================

type FilterLevel = 'all' | 'info' | 'warn' | 'error' | 'debug';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function DebugTerminalScreen() {
  const { dispositivo, lastSyncAt, syncVersion } = useSync();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<FilterLevel>('all');
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // ─── Carregar logs existentes + listener em tempo real ────────────────
  useEffect(() => {
    // Carregar logs existentes
    setLogs(logger.getLogs());

    // Listener para novos logs em tempo real
    const unsubscribe = logger.addLogListener((entry) => {
      setLogs(prev => [...prev, entry]);
    });

    return unsubscribe;
  }, []);

  // ─── Auto-scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [logs.length, autoScroll]);

  // ─── Carregar contagem do banco local ────────────────────────────────
  const loadDbCounts = useCallback(async () => {
    try {
      const tables = [
        'clientes', 'produtos', 'locacoes', 'cobrancas', 'rotas',
        'usuarios', 'tipos_produto', 'descricoes_produto', 'tamanhos_produto',
        'manutencoes', 'metas', 'estabelecimentos', 'change_log',
      ];
      const counts: Record<string, number> = {};
      for (const table of tables) {
        try {
          const result = await databaseService.getFirstAsync<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM ${table} WHERE deletedAt IS NULL`, []
          );
          counts[table] = result?.cnt ?? 0;
        } catch {
          counts[table] = -1; // tabela não existe
        }
      }
      setDbCounts(counts);
    } catch (error) {
      logger.error('[DebugTerminal] Erro ao contar registros:', error);
    }
  }, []);

  useEffect(() => {
    loadDbCounts();
  }, [loadDbCounts, syncVersion]); // Recarregar quando sync completa

  // ─── Filtrar logs ────────────────────────────────────────────────────
  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.level === filter);

  // ─── Limpar logs ─────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    logger.clearLogs();
    setLogs([]);
  }, []);

  // ─── Exportar logs ───────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    try {
      const text = logger.exportLogs();
      await Share.share({
        message: text,
        title: 'Logs do App Cobranças',
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar os logs');
    }
  }, []);

  // ─── Cores por nível ─────────────────────────────────────────────────
  const levelColors: Record<string, string> = {
    debug: '#64748B',
    info: '#3B82F6',
    warn: '#F59E0B',
    error: '#EF4444',
  };

  const levelBg: Record<string, string> = {
    debug: 'rgba(100,116,139,0.1)',
    info: 'rgba(59,130,246,0.1)',
    warn: 'rgba(245,158,11,0.1)',
    error: 'rgba(239,68,68,0.15)',
  };

  // ─── Filtros ─────────────────────────────────────────────────────────
  const filters: { key: FilterLevel; label: string; color: string }[] = [
    { key: 'all', label: 'Tudo', color: '#94A3B8' },
    { key: 'info', label: 'Info', color: '#3B82F6' },
    { key: 'warn', label: 'Warn', color: '#F59E0B' },
    { key: 'error', label: 'Error', color: '#EF4444' },
    { key: 'debug', label: 'Debug', color: '#64748B' },
  ];

  // ─── Contagem por nível ──────────────────────────────────────────────
  const levelCounts = {
    error: logs.filter(l => l.level === 'error').length,
    warn: logs.filter(l => l.level === 'warn').length,
    info: logs.filter(l => l.level === 'info').length,
    debug: logs.filter(l => l.level === 'debug').length,
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Header com stats */}
      <View style={s.header}>
        <View style={s.statsRow}>
          <View style={[s.statBadge, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
            <Text style={[s.statText, { color: '#EF4444' }]}>{levelCounts.error} err</Text>
          </View>
          <View style={[s.statBadge, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
            <Text style={[s.statText, { color: '#F59E0B' }]}>{levelCounts.warn} warn</Text>
          </View>
          <View style={[s.statBadge, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
            <Text style={[s.statText, { color: '#3B82F6' }]}>{levelCounts.info} info</Text>
          </View>
          <Text style={s.totalText}>{filteredLogs.length} logs</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={() => setAutoScroll(!autoScroll)} style={s.iconBtn}>
            <Ionicons name={autoScroll ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={20} color={autoScroll ? '#3B82F6' : '#64748B'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExport} style={s.iconBtn}>
            <Ionicons name="share-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterBtn, filter === f.key && { backgroundColor: f.color + '25', borderColor: f.color }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterText, filter === f.key && { color: f.color, fontWeight: '700' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Terminal de logs */}
      <ScrollView
        ref={scrollViewRef}
        style={s.terminal}
        contentContainerStyle={s.terminalContent}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const atBottom = contentSize.height - layoutMeasurement.height - contentOffset.y < 100;
          if (autoScroll && !atBottom) setAutoScroll(false);
        }}
      >
        {filteredLogs.length === 0 ? (
          <Text style={s.emptyText}>Nenhum log registrado ainda.{"\n"}Faça uma sincronização para ver os logs aqui.</Text>
        ) : (
          filteredLogs.map((log, i) => (
            <View key={i} style={[s.logLine, { backgroundColor: levelBg[log.level] || 'transparent' }]}>
              <Text style={s.logTimestamp}>
                {log.timestamp.substring(11, 19)}
              </Text>
              <Text style={[s.logLevel, { color: levelColors[log.level] || '#94A3B8' }]}>
                {log.level.toUpperCase().padEnd(5)}
              </Text>
              <Text style={s.logMessage} numberOfLines={3}>
                {log.message}
                {log.data ? ` ${typeof log.data === 'string' ? log.data : JSON.stringify(log.data).substring(0, 120)}` : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* DB Counts */}
      <View style={s.dbPanel}>
        <View style={s.dbPanelHeader}>
          <Text style={s.dbPanelTitle}>REGISTROS LOCAIS (SQLite)</Text>
          <TouchableOpacity onPress={loadDbCounts}>
            <Ionicons name="refresh" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.entries(dbCounts).map(([table, count]) => (
            <View key={table} style={s.dbCountItem}>
              <Text style={s.dbCountLabel}>{table.replace('_', ' ')}</Text>
              <Text style={[s.dbCountValue, count === 0 && { color: '#64748B' }, count < 0 && { color: '#EF4444' }]}>
                {count < 0 ? 'ERR' : count}
              </Text>
            </View>
          ))}
        </ScrollView>
        <Text style={s.dbSyncInfo}>
          Sync v{syncVersion} | {dispositivo?.id ? `Dev: ${dispositivo.id.substring(0, 8)}...` : 'Sem device'} | {lastSyncAt ? `Last: ${new Date(lastSyncAt).toLocaleTimeString('pt-BR')}` : 'Nunca'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E293B',
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  totalText: { fontSize: 11, color: '#64748B', marginLeft: 4, fontFamily: 'monospace' },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 4,
  },
  filterBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: '#334155', backgroundColor: '#1E293B',
  },
  filterText: { fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' },

  terminal: { flex: 1, backgroundColor: '#0F172A' },
  terminalContent: { paddingHorizontal: 8, paddingVertical: 4 },
  emptyText: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 40, lineHeight: 20 },
  logLine: {
    flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4,
    borderRadius: 2, marginBottom: 1, gap: 4,
  },
  logTimestamp: { color: '#475569', fontSize: 10, fontFamily: 'monospace', width: 60 },
  logLevel: { fontSize: 10, fontFamily: 'monospace', fontWeight: '700', width: 40 },
  logMessage: { color: '#E2E8F0', fontSize: 11, fontFamily: 'monospace', flex: 1 },

  dbPanel: {
    backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155',
    paddingHorizontal: 12, paddingVertical: 8, maxHeight: 140,
  },
  dbPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dbPanelTitle: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
  dbCountItem: { alignItems: 'center', marginRight: 12, minWidth: 50 },
  dbCountLabel: { fontSize: 9, color: '#64748B', fontFamily: 'monospace', textTransform: 'uppercase' },
  dbCountValue: { fontSize: 16, fontWeight: '700', color: '#E2E8F0', fontFamily: 'monospace' },
  dbSyncInfo: { fontSize: 9, color: '#475569', fontFamily: 'monospace', marginTop: 4 },
});
