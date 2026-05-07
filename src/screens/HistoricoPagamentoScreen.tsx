/**
 * HistoricoPagamentoScreen.tsx
 * Tela de histórico de pagamentos de uma cobrança (timeline vertical)
 * - Route params: cobrancaId, clienteNome?
 * - Cada evento mostra: tipo, statusAnterior→statusNovo, valorPago, observacao
 * - Codificação por cor: pagamento=verde, estorno=vermelho, vencimento=âmbar, geracao=azul
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';

import { apiService } from '../services/ApiService';
import { formatarMoeda, formatarDataHora, formatarData } from '../utils/currency';

// ============================================================================
// TIPOS
// ============================================================================

interface HistoricoEvento {
  id: string;
  tipo: HistoricoTipo;
  data: string;
  statusAnterior?: string;
  statusNovo?: string;
  valorPago?: number;
  observacao?: string;
  usuario?: string;
}

type HistoricoTipo = 'pagamento' | 'pagamento_parcial' | 'estorno' | 'alteracao_status' | 'vencimento' | 'geracao';

interface CobrancaResumo {
  clienteNome?: string;
  valor?: number;
  status?: string;
}

type HistoricoPagamentoRouteProp = RouteProp<
  { HistoricoPagamento: { cobrancaId: string; clienteNome?: string } },
  'HistoricoPagamento'
>;

// ============================================================================
// CONFIG DE TIPO DO EVENTO
// ============================================================================

const TIPO_EVENTO_CONFIG: Record<HistoricoTipo, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  label: string;
}> = {
  pagamento:        { icon: 'checkmark-circle',   color: '#16A34A', bg: '#F0FDF4', label: 'Pagamento' },
  pagamento_parcial:{ icon: 'time',               color: '#2563EB', bg: '#DBEAFE', label: 'Pagamento Parcial' },
  estorno:          { icon: 'return-down-back',    color: '#DC2626', bg: '#FEF2F2', label: 'Estorno' },
  alteracao_status: { icon: 'swap-horizontal',     color: '#64748B', bg: '#F1F5F9', label: 'Alteração de Status' },
  vencimento:       { icon: 'alert-circle',        color: '#D97706', bg: '#FFFBEB', label: 'Vencimento' },
  geracao:          { icon: 'document-text',       color: '#2563EB', bg: '#EFF6FF', label: 'Geração' },
};

// ============================================================================
// HELPERS
// ============================================================================

function getTipoConfig(tipo: string): typeof TIPO_EVENTO_CONFIG['pagamento'] {
  return TIPO_EVENTO_CONFIG[tipo as HistoricoTipo] || {
    icon: 'ellipsis-horizontal-circle',
    color: '#64748B',
    bg: '#F1F5F9',
    label: tipo,
  };
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function HistoricoPagamentoScreen() {
  const route = useRoute<HistoricoPagamentoRouteProp>();
  const { cobrancaId, clienteNome: clienteNomeParam } = route.params;

  const [eventos, setEventos] = useState<HistoricoEvento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<CobrancaResumo>({ clienteNome: clienteNomeParam });

  // ─── carregar histórico ───────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const response = await apiService.getHistoricoPagamentos(cobrancaId);
      if (response.success && response.data) {
        const data = response.data as any;
        // Suporta resposta como array direto ou objeto com eventos
        const lista = Array.isArray(data) ? data : data.eventos || [];
        setEventos(lista);

        // Tenta extrair resumo da cobrança da resposta
        if (!Array.isArray(data) && data.cobranca) {
          setResumo(prev => ({ ...prev, ...data.cobranca }));
        }
      } else {
        setErro(response.error || 'Erro ao carregar histórico');
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setCarregando(false);
    }
  }, [cobrancaId]);

  useEffect(() => { carregar(); }, [carregar]);

  // ─── loading ──────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  // ─── erro ─────────────────────────────────────────────────────────────────
  if (erro && eventos.length === 0) {
    return (
      <View style={s.centered}>
        <Ionicons name="alert-circle-outline" size={56} color="#CBD5E1" />
        <Text style={s.errorTitle}>Erro ao carregar</Text>
        <Text style={s.errorText}>{erro}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header: resumo da cobrança */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="receipt-outline" size={28} color="#2563EB" />
          </View>
          <View style={s.headerInfo}>
            <Text style={s.headerCliente}>{resumo.clienteNome || 'Cobrança'}</Text>
            {resumo.valor != null && (
              <Text style={s.headerValor}>{formatarMoeda(resumo.valor)}</Text>
            )}
            {resumo.status && (
              <View style={[s.headerStatusBadge, { backgroundColor: getStatusBg(resumo.status) }]}>
                <Text style={[s.headerStatusText, { color: getStatusColor(resumo.status) }]}>
                  {resumo.status}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Erro parcial */}
        {erro && (
          <View style={s.erroCard}>
            <Ionicons name="warning" size={16} color="#DC2626" />
            <Text style={s.erroText}>{erro}</Text>
          </View>
        )}

        {/* Título da seção */}
        <Text style={s.sectionTitle}>LINHA DO TEMPO</Text>

        {/* Timeline */}
        {eventos.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="time-outline" size={48} color="#CBD5E1" />
            <Text style={s.emptyTitle}>Nenhum evento registrado</Text>
            <Text style={s.emptyText}>O histórico desta cobrança está vazio</Text>
          </View>
        ) : (
          <View style={s.timeline}>
            {eventos.map((evento, index) => {
              const isLast = index === eventos.length - 1;
              return (
                <TimelineItem key={evento.id} evento={evento} isLast={isLast} />
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// SUBCOMPONENTES
// ============================================================================

function TimelineItem({ evento, isLast }: { evento: HistoricoEvento; isLast: boolean }) {
  const cfg = getTipoConfig(evento.tipo);

  return (
    <View style={s.timelineRow}>
      {/* Coluna da data */}
      <View style={s.timelineDateCol}>
        <Text style={s.timelineDate}>{formatarData(evento.data)}</Text>
        <Text style={s.timelineTime}>
          {evento.data ? new Date(evento.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
      </View>

      {/* Coluna do conector */}
      <View style={s.timelineConnectorCol}>
        <View style={[s.timelineDot, { backgroundColor: cfg.color }]} />
        {!isLast && <View style={s.timelineLine} />}
      </View>

      {/* Coluna do conteúdo */}
      <View style={s.timelineContentCol}>
        <View style={[s.eventCard, { borderLeftColor: cfg.color }]}>
          {/* Tipo do evento */}
          <View style={s.eventHeader}>
            <View style={[s.eventTypeIcon, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={16} color={cfg.color} />
            </View>
            <Text style={[s.eventTypeLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          {/* Status change */}
          {evento.statusAnterior && evento.statusNovo && (
            <View style={s.statusChangeRow}>
              <View style={[s.statusChip, { backgroundColor: getStatusBg(evento.statusAnterior) }]}>
                <Text style={[s.statusChipText, { color: getStatusColor(evento.statusAnterior) }]}>
                  {evento.statusAnterior}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
              <View style={[s.statusChip, { backgroundColor: getStatusBg(evento.statusNovo) }]}>
                <Text style={[s.statusChipText, { color: getStatusColor(evento.statusNovo) }]}>
                  {evento.statusNovo}
                </Text>
              </View>
            </View>
          )}

          {/* Valor pago */}
          {evento.valorPago != null && evento.valorPago > 0 && (
            <View style={s.valorRow}>
              <Ionicons name="cash-outline" size={14} color="#16A34A" />
              <Text style={s.valorText}>{formatarMoeda(evento.valorPago)}</Text>
            </View>
          )}

          {/* Observação */}
          {evento.observacao ? (
            <Text style={s.observacaoText}>{evento.observacao}</Text>
          ) : null}

          {/* Usuário */}
          {evento.usuario ? (
            <Text style={s.usuarioText}>Por: {evento.usuario}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// HELPERS DE COR
// ============================================================================

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    Pago: '#16A34A', Parcial: '#2563EB', Pendente: '#EA580C', Atrasado: '#DC2626',
  };
  return map[status] || '#64748B';
}

function getStatusBg(status: string): string {
  const map: Record<string, string> = {
    Pago: '#F0FDF4', Parcial: '#DBEAFE', Pendente: '#FFFBEB', Atrasado: '#FEF2F2',
  };
  return map[status] || '#F1F5F9';
}

// ============================================================================
// ESTILOS
// ============================================================================

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F8FAFC' },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText:    { color: '#64748B', fontSize: 15 },
  scroll:         { padding: 16, paddingBottom: 32 },

  // Header
  header:         { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, gap: 14, alignItems: 'center' },
  headerIcon:     { width: 52, height: 52, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  headerInfo:     { flex: 1, gap: 4 },
  headerCliente:  { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  headerValor:    { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  headerStatusBadge:{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  headerStatusText:{ fontSize: 12, fontWeight: '700' },

  // Erro
  erroCard:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10, marginBottom: 12 },
  erroText:       { flex: 1, color: '#DC2626', fontSize: 13 },
  errorTitle:     { fontSize: 17, fontWeight: '600', color: '#64748B', marginTop: 8 },
  errorText:      { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  // Seção
  sectionTitle:   { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 },

  // Timeline
  timeline:       { gap: 0 },
  timelineRow:    { flexDirection: 'row', minHeight: 80 },

  // Data
  timelineDateCol:{ width: 56, paddingTop: 4 },
  timelineDate:   { fontSize: 12, fontWeight: '700', color: '#1E293B', textAlign: 'right' },
  timelineTime:   { fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 2 },

  // Conector
  timelineConnectorCol:{ width: 32, alignItems: 'center', paddingTop: 6 },
  timelineDot:    { width: 14, height: 14, borderRadius: 7, zIndex: 2, borderWidth: 2, borderColor: '#FFFFFF' },
  timelineLine:   { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 2 },

  // Conteúdo
  timelineContentCol:{ flex: 1, paddingBottom: 12 },
  eventCard:      { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderLeftWidth: 3, marginBottom: 4, gap: 8 },
  eventHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTypeIcon:  { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  eventTypeLabel: { fontSize: 13, fontWeight: '700' },

  // Status change
  statusChangeRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusChip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  // Valor
  valorRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  valorText:      { fontSize: 14, fontWeight: '700', color: '#16A34A' },

  // Observação
  observacaoText: { fontSize: 12, color: '#64748B', lineHeight: 17, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8 },

  // Usuário
  usuarioText:    { fontSize: 11, color: '#94A3B8' },

  // Empty
  empty:          { justifyContent: 'center', alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle:     { fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 8 },
  emptyText:      { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
