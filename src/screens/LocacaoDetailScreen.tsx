/**
 * LocacaoDetailScreen.tsx
 * Detalhes de uma locação com todas as ações disponíveis
 */

import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { ModalStackParamList } from '../navigation/AppNavigator';

import { useLocacao }  from '../contexts/LocacaoContext';
import { useAuth }     from '../contexts/AuthContext';
import { Locacao, StatusLocacao, formatarMoeda } from '../types';
import { ClientesStackParamList } from '../navigation/ClientesStack';

type Props = NativeStackScreenProps<ModalStackParamList, 'LocacaoDetail'>;
// Also compatible with ClientesStack via useRoute

const STATUS_CFG: Record<StatusLocacao, { bg: string; text: string }> = {
  Ativa:      { bg: '#DCFCE7', text: '#16A34A' },
  Finalizada: { bg: '#F1F5F9', text: '#64748B' },
  Cancelada:  { bg: '#FEE2E2', text: '#DC2626' },
};

const FORMA_LABELS: Record<string, string> = {
  Periodo:           'Valor Fixo por Período',
  PercentualPagar:   'Percentual a Pagar',
  PercentualReceber: 'Percentual a Receber',
};

function InfoRow({ label, value, destaque, cor }: { label: string; value: string; destaque?: boolean; cor?: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, destaque && { fontWeight: '700', color: cor || '#1E293B' }]}>{value}</Text>
    </View>
  );
}

export default function LocacaoDetailScreen({ route, navigation }: Props) {
  const { locacaoId } = route.params;
  const { locacaoSelecionada: locacao, selecionarLocacao, carregando } = useLocacao();
  const { user, hasPermission, isAdmin } = useAuth();

  const podeGerenciar = isAdmin() || hasPermission('locacaoRelocacaoEstoque', 'mobile');

  useFocusEffect(useCallback(() => {
    selecionarLocacao(locacaoId);
  }, [locacaoId, selecionarLocacao]));

  const handleRelocar = useCallback(() => {
    if (!locacao) return;
    // Navega para o formulário em modo relocar
    // Como estamos no ModalStack, precisamos usar o navigate do pai
    (navigation as any).navigate('LocacaoForm', {
      clienteId: String(locacao.clienteId),
      produtoId: String(locacao.produtoId),
      locacaoId: String(locacao.id),
      modo: 'relocar',
    });
  }, [locacao, navigation]);

  const handleEditar = useCallback(() => {
    if (!locacao) return;
    // Navega para o formulário em modo editar
    (navigation as any).navigate('LocacaoForm', {
      clienteId: String(locacao.clienteId),
      produtoId: String(locacao.produtoId),
      locacaoId: String(locacao.id),
      modo: 'editar',
    });
  }, [locacao, navigation]);

  const handleEnviarEstoque = useCallback(() => {
    if (!locacao) return;
    navigation.navigate('EnviarEstoque', {
      locacaoId: String(locacao.id),
      produtoId: String(locacao.produtoId),
    });
  }, [locacao, navigation]);

  const handleCobrar = useCallback(() => {
    if (!locacao) return;
    // CobrancaConfirm is in ModalStack (AppNavigator) and CobrancasStack
    // Try parent navigator first (works when inside ClientesStack/ProdutosStack)
    const parent = (navigation as any).getParent?.();
    if (parent) {
      parent.navigate('CobrancaConfirm', { locacaoId: String(locacao.id) });
    } else {
      (navigation as any).navigate('CobrancaConfirm', { locacaoId: String(locacao.id) });
    }
  }, [locacao, navigation]);

  if (carregando) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  if (!locacao) {
    return (
      <View style={s.centered}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={s.emptyText}>Locação não encontrada</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CFG[locacao.status] || STATUS_CFG.Ativa;
  const ativa = locacao.status === 'Ativa';

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HEADER: produto + status ─────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.prodIcon}>
              <Ionicons name="cube" size={28} color="#2563EB" />
            </View>
            <View>
              <Text style={s.prodNome}>N° {locacao.produtoIdentificador}</Text>
              <Text style={s.prodTipo}>{locacao.produtoTipo}</Text>
            </View>
          </View>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[s.statusText, { color: statusCfg.text }]}>{locacao.status}</Text>
          </View>
        </View>

        {/* ── AÇÕES RÁPIDAS (só locações ativas) ──────────────────── */}
        {ativa && podeGerenciar && (
          <View style={s.acoesRapidas}>
            <TouchableOpacity style={[s.acaoBtn, s.acaoBtnBlue]} onPress={handleCobrar}>
              <Ionicons name="cash" size={20} color="#2563EB" />
              <Text style={[s.acaoBtnText, { color: '#2563EB' }]}>Cobrar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.acaoBtn, s.acaoBtnPurple]} onPress={handleEditar}>
              <Ionicons name="create" size={20} color="#7C3AED" />
              <Text style={[s.acaoBtnText, { color: '#7C3AED' }]}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.acaoBtn, s.acaoBtnCyan]} onPress={handleRelocar}>
              <Ionicons name="swap-horizontal" size={20} color="#0891B2" />
              <Text style={[s.acaoBtnText, { color: '#0891B2' }]}>Relocar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Segunda linha de ações */}
        {ativa && podeGerenciar && (
          <View style={s.acoesRapidas}>
            <TouchableOpacity style={[s.acaoBtn, s.acaoBtnOrange]} onPress={handleEnviarEstoque}>
              <Ionicons name="archive" size={20} color="#EA580C" />
              <Text style={[s.acaoBtnText, { color: '#EA580C' }]}>Enviar para Estoque</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CLIENTE ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cliente</Text>
          <TouchableOpacity
            style={s.clienteCard}
            onPress={() => (navigation as any).navigate('ClienteDetail', { clienteId: String(locacao.clienteId) })}
          >
            <View style={s.clienteAvatar}>
              <Text style={s.clienteAvatarText}>
                {locacao.clienteNome?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.clienteNome}>{locacao.clienteNome}</Text>
              <Text style={s.clienteAction}>Ver detalhes do cliente</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* ── DADOS DA LOCAÇÃO ────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dados da Locação</Text>
          <InfoRow label="Data Início"     value={new Date(locacao.dataLocacao).toLocaleDateString('pt-BR')} />
          <InfoRow label="Forma Pagamento" value={FORMA_LABELS[locacao.formaPagamento] ?? locacao.formaPagamento} />
          <InfoRow label="N° Relógio"      value={locacao.numeroRelogio} />
          {locacao.ultimaLeituraRelogio != null && (
            <InfoRow label="Última Leitura" value={String(locacao.ultimaLeituraRelogio)} />
          )}
          <InfoRow label="% Empresa"       value={`${locacao.percentualEmpresa}%`} />
          <InfoRow label="% Cliente"       value={`${locacao.percentualCliente ?? 100 - locacao.percentualEmpresa}%`} />
          {locacao.precoFicha > 0 && (
            <InfoRow label="Preço Ficha"   value={formatarMoeda(locacao.precoFicha)} destaque cor="#2563EB" />
          )}
          {locacao.valorFixo != null && locacao.valorFixo > 0 && (
            <InfoRow label="Valor Fixo"    value={formatarMoeda(locacao.valorFixo)} destaque cor="#2563EB" />
          )}
          {locacao.periodicidade && (
            <InfoRow label="Periodicidade" value={locacao.periodicidade} />
          )}
          {locacao.dataUltimaCobranca && (
            <InfoRow label="Última Cobrança" value={new Date(locacao.dataUltimaCobranca).toLocaleDateString('pt-BR')} />
          )}
          {locacao.dataFim && (
            <InfoRow label="Data Fim"      value={new Date(locacao.dataFim).toLocaleDateString('pt-BR')} />
          )}
          {locacao.trocaPano && (
            <InfoRow label="Troca de Pano"  value="Sim" destaque cor="#16A34A" />
          )}
          {locacao.dataUltimaManutencao && (
            <InfoRow label="Última Manutenção" value={new Date(locacao.dataUltimaManutencao).toLocaleDateString('pt-BR')} />
          )}
          {locacao.observacao ? (
            <View style={s.obsBox}>
              <Text style={s.obsText}>{locacao.observacao}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  scroll:     { padding: 16 },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText:  { fontSize: 16, color: '#64748B', marginTop: 8 },

  // header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prodIcon:    { width: 52, height: 52, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  prodNome:    { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  prodTipo:    { fontSize: 14, color: '#64748B', marginTop: 2 },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusText:  { fontSize: 13, fontWeight: '700' },

  // ações rápidas
  acoesRapidas:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  acaoBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5 },
  acaoBtnBlue:   { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  acaoBtnPurple: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
  acaoBtnCyan:   { backgroundColor: '#ECFEFF', borderColor: '#A5F3FC' },
  acaoBtnOrange: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  acaoBtnRed:    { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  acaoBtnText:   { fontSize: 13, fontWeight: '700' },

  // section
  section:      { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  // cliente card
  clienteCard:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clienteAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  clienteAvatarText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  clienteNome:    { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  clienteAction:  { fontSize: 12, color: '#2563EB', marginTop: 2 },

  // info rows
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { fontSize: 14, color: '#64748B' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#1E293B', textAlign: 'right', flex: 1 },

  obsBox:  { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#2563EB' },
  obsText: { fontSize: 14, color: '#475569', lineHeight: 20 },
});
