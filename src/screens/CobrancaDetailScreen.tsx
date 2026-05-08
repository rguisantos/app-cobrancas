/**
 * CobrancaDetailScreen.tsx
 * ✅ Corrigido: usa CobrancaContext real, sem mock
 */

import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons }     from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';

import { useCobranca }   from '../contexts/CobrancaContext';
import { CobrancasStackParamList } from '../navigation/CobrancasStack';
import { StatusPagamento, formatarMoeda } from '../types';
import { formatarData }  from '../utils/currency';

type CobrancaDetailRouteProp = RouteProp<CobrancasStackParamList, 'CobrancaDetail'>;

const STATUS_CONFIG: Record<StatusPagamento, { bg: string; text: string; icon: string; label: string }> = {
  Pago:     { bg: '#F0FDF4', text: '#16A34A', icon: 'checkmark-circle', label: 'Pago' },
  Parcial:  { bg: '#DBEAFE', text: '#2563EB', icon: 'time',             label: 'Parcial' },
  Pendente: { bg: '#FFFBEB', text: '#EA580C', icon: 'hourglass',        label: 'Pendente' },
  Atrasado: { bg: '#FEF2F2', text: '#DC2626', icon: 'alert-circle',     label: 'Atrasado' },
};

function InfoRow({ label, value, destaque, cor }: { label: string; value: string; destaque?: boolean; cor?: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, destaque && { fontWeight: '700', color: cor || '#1E293B' }]}>{value}</Text>
    </View>
  );
}

export default function CobrancaDetailScreen() {
  const route      = useRoute<CobrancaDetailRouteProp>();
  const navigation = useNavigation();
  const { cobrancaSelecionada: cobranca, selecionarCobranca, carregando } = useCobranca();
  const { cobrancaId } = route.params;

  useFocusEffect(
    useCallback(() => {
      if (cobrancaId) selecionarCobranca(cobrancaId);
    }, [cobrancaId, selecionarCobranca])
  );

  if (carregando) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando cobrança...</Text>
      </View>
    );
  }

  if (!cobranca) {
    return (
      <View style={s.centered}>
        <Ionicons name="alert-circle-outline" size={56} color="#CBD5E1" />
        <Text style={s.emptyTitle}>Cobrança não encontrada</Text>
        <TouchableOpacity style={s.voltarBtn} onPress={() => navigation.goBack()}>
          <Text style={s.voltarText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[cobranca.status] || STATUS_CONFIG.Pendente;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Status header */}
        <View style={[s.statusHeader, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={40} color={cfg.text} />
          <Text style={[s.statusLabel, { color: cfg.text }]}>{cfg.label}</Text>
          <Text style={s.totalValor}>{formatarMoeda(cobranca.totalClientePaga)}</Text>
          {cobranca.saldoDevedorGerado > 0 && (
            <View style={s.saldoRow}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={s.saldoText}>Saldo devedor: {formatarMoeda(cobranca.saldoDevedorGerado)}</Text>
            </View>
          )}
        </View>

        {/* Informações */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Informações</Text>
          <InfoRow label="Cliente"  value={cobranca.clienteNome} />
          <InfoRow label="Produto N°" value={cobranca.produtoIdentificador} />
          <InfoRow label="Período"  value={`${formatarData(cobranca.dataInicio)} → ${formatarData(cobranca.dataFim)}`} />
          {cobranca.dataPagamento && <InfoRow label="Pago em" value={formatarData(cobranca.dataPagamento)} destaque cor="#16A34A" />}
        </View>

        {/* Leituras */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Leituras do Relógio</Text>
          <View style={s.relogioContainer}>
            <View style={s.relogioBox}>
              <Text style={s.relogioBoxLabel}>Anterior</Text>
              <Text style={s.relogioBoxValue}>{cobranca.relogioAnterior.toLocaleString('pt-BR')}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#94A3B8" />
            <View style={[s.relogioBox, s.relogioBoxAtual]}>
              <Text style={s.relogioBoxLabel}>Atual</Text>
              <Text style={[s.relogioBoxValue, { color: '#2563EB' }]}>{cobranca.relogioAtual.toLocaleString('pt-BR')}</Text>
            </View>
          </View>
          <InfoRow label="Fichas Rodadas" value={`${cobranca.fichasRodadas.toLocaleString('pt-BR')} fichas`} destaque />
        </View>

        {/* Valores */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cálculo de Valores</Text>
          <InfoRow label="Total Bruto" value={formatarMoeda(cobranca.totalBruto)} />
          {(cobranca.descontoPartidasQtd ?? 0) > 0 && (
            <InfoRow label={`Desc. Partidas (${cobranca.descontoPartidasQtd} fichas)`}
              value={`– ${formatarMoeda(cobranca.descontoPartidasValor || 0)}`} destaque cor="#DC2626" />
          )}
          {(cobranca.descontoDinheiro ?? 0) > 0 && (
            <InfoRow label="Desc. Dinheiro"
              value={`– ${formatarMoeda(cobranca.descontoDinheiro || 0)}`} destaque cor="#DC2626" />
          )}
          <InfoRow label="Subtotal após descontos" value={formatarMoeda(cobranca.subtotalAposDescontos)} />
          <InfoRow label={`Empresa (${cobranca.percentualEmpresa}%)`} value={formatarMoeda(cobranca.valorPercentual)} />
          <View style={s.divisor} />
          <InfoRow label="Total a Pagar"   value={formatarMoeda(cobranca.totalClientePaga)} destaque />
          <InfoRow label="Valor Recebido"  value={formatarMoeda(cobranca.valorRecebido)} destaque cor="#16A34A" />
          {cobranca.saldoDevedorGerado > 0 && (
            <InfoRow label="Saldo Devedor" value={formatarMoeda(cobranca.saldoDevedorGerado)} destaque cor="#DC2626" />
          )}
        </View>

        {cobranca.observacao ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Observação</Text>
            <View style={s.obsBox}><Text style={s.obsText}>{cobranca.observacao}</Text></View>
          </View>
        ) : null}

        {/* Botão Ver Recibo */}
        <TouchableOpacity
          style={s.reciboBtn}
          onPress={() => {
            const parent = navigation.getParent();
            if (parent) (parent as any).navigate('Recibo', { cobrancaId: cobranca.id });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="document-text" size={20} color="#FFFFFF" />
          <Text style={s.reciboBtnText}>Ver Recibo</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8FAFC' },
  scroll:      { padding: 16, paddingBottom: 32 },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText: { color: '#64748B', fontSize: 15 },
  emptyTitle:  { fontSize: 17, fontWeight: '600', color: '#64748B' },
  voltarBtn:   { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 10 },
  voltarText:  { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  statusHeader:{ alignItems: 'center', padding: 24, borderRadius: 16, marginBottom: 16, gap: 6 },
  statusLabel: { fontSize: 16, fontWeight: '700' },
  totalValor:  { fontSize: 36, fontWeight: '800', color: '#1E293B', marginTop: 4 },
  saldoRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  saldoText:   { fontSize: 13, color: '#DC2626', fontWeight: '600' },
  section:     { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle:{ fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel:   { fontSize: 14, color: '#64748B', flex: 1 },
  infoValue:   { fontSize: 14, fontWeight: '500', color: '#1E293B', textAlign: 'right', flex: 1 },
  relogioContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginVertical: 12, gap: 8 },
  relogioBox:       { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14 },
  relogioBoxAtual:  { backgroundColor: '#EFF6FF' },
  relogioBoxLabel:  { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  relogioBoxValue:  { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  divisor:     { height: 1, backgroundColor: '#E2E8F0', marginVertical: 6 },
  obsBox:      { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#2563EB' },
  obsText:     { fontSize: 14, color: '#475569', lineHeight: 20 },

  // Recibo button
  reciboBtn:   {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  reciboBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
