/**
 * ReciboScreen.tsx
 * Exibe recibo de cobrança formatado com opções de compartilhar
 * - Busca recibo da API (A4 ou térmico)
 * - Fallback para dados locais da cobrança
 * - Botão de compartilhar via React Native Share API
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

import { apiService } from '../../services/ApiService';
import { useCobranca } from '../../contexts/CobrancaContext';
import { formatarMoeda, formatarData } from '../../utils/currency';
import { ModalStackParamList } from '../../navigation/AppNavigator';

type ReciboRouteProp = RouteProp<ModalStackParamList, 'Recibo'>;

// ─── Componente de linha de informação ────────────────────────────────────────
function ReciboLinha({ label, valor, destaque, cor, mono }: {
  label: string; valor: string; destaque?: boolean; cor?: string; mono?: boolean;
}) {
  return (
    <View style={rs.linha}>
      <Text style={rs.linhaLabel}>{label}</Text>
      <Text style={[
        rs.linhaValor,
        destaque && { fontWeight: '700', fontSize: 16 },
        cor && { color: cor },
        mono && { fontFamily: 'monospace' },
      ]}>
        {valor}
      </Text>
    </View>
  );
}

// ─── Componente divisor ──────────────────────────────────────────────────────
function Divisor() {
  return <View style={rs.divisor} />;
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function ReciboScreen() {
  const route = useRoute<ReciboRouteProp>();
  const navigation = useNavigation();
  const { cobrancaId } = route.params;

  const { cobrancaSelecionada, selecionarCobranca } = useCobranca();

  const [carregando, setCarregando] = useState(true);
  const [recibo, setRecibo] = useState<any>(null);
  const [modoTermico, setModoTermico] = useState(false);
  const [offline, setOffline] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);

  // Carregar recibo ao montar
  useEffect(() => {
    carregarRecibo(false);
  }, [cobrancaId]);

  const carregarRecibo = useCallback(async (termico: boolean) => {
    setCarregando(true);
    setOffline(false);

    try {
      // Tentar API
      const response = termico
        ? await apiService.getReciboTermico(cobrancaId)
        : await apiService.getRecibo(cobrancaId);

      if (response.success && response.data) {
        setRecibo(response.data);
        setOffline(false);
      } else {
        // Fallback: usar dados locais da cobrança
        await selecionarCobranca(cobrancaId);
        setRecibo(null);
        setOffline(true);
      }
    } catch {
      // Fallback offline
      await selecionarCobranca(cobrancaId);
      setRecibo(null);
      setOffline(true);
    } finally {
      setCarregando(false);
    }
  }, [cobrancaId, selecionarCobranca]);

  // Gerar texto do recibo para compartilhamento
  const gerarTextoRecibo = useCallback((): string => {
    const c = cobrancaSelecionada;
    if (!c) return 'Recibo não disponível';

    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    const linhas = [
      '═══════════════════════════════',
      '         RECIBO DE COBRANÇA',
      '═══════════════════════════════',
      '',
      `Data de Emissão: ${dataEmissao}`,
      '',
      `Cliente: ${c.clienteNome}`,
      `Produto: ${c.produtoIdentificador}`,
      `Período: ${formatarData(c.dataInicio)} → ${formatarData(c.dataFim)}`,
      '',
      '─── Leitura do Relógio ───',
      `Anterior: ${c.relogioAnterior.toLocaleString('pt-BR')}`,
      `Atual:    ${c.relogioAtual.toLocaleString('pt-BR')}`,
      `Fichas:   ${c.fichasRodadas.toLocaleString('pt-BR')}`,
      '',
      '─── Valores ───',
      `Total Bruto:    ${formatarMoeda(c.totalBruto)}`,
      c.descontoPartidasValor ? `Desc. Partidas: -${formatarMoeda(c.descontoPartidasValor)}` : null,
      c.descontoDinheiro ? `Desc. Dinheiro: -${formatarMoeda(c.descontoDinheiro)}` : null,
      `Subtotal:       ${formatarMoeda(c.subtotalAposDescontos)}`,
      `Empresa (${c.percentualEmpresa}%): ${formatarMoeda(c.valorPercentual)}`,
      '',
      `TOTAL A PAGAR:  ${formatarMoeda(c.totalClientePaga)}`,
      `VALOR RECEBIDO: ${formatarMoeda(c.valorRecebido)}`,
      c.saldoDevedorGerado > 0 ? `SALDO DEVEDOR:  ${formatarMoeda(c.saldoDevedorGerado)}` : null,
      '',
      `Status: ${c.status}`,
      c.observacao ? `Obs: ${c.observacao}` : null,
      '',
      '═══════════════════════════════',
    ].filter(Boolean).join('\n');

    return linhas;
  }, [cobrancaSelecionada]);

  // Compartilhar recibo
  const handleCompartilhar = useCallback(async () => {
    try {
      setCompartilhando(true);
      const texto = gerarTextoRecibo();
      await Share.share({
        message: texto,
        title: `Recibo - ${cobrancaSelecionada?.clienteNome || 'Cobrança'}`,
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o recibo');
    } finally {
      setCompartilhando(false);
    }
  }, [gerarTextoRecibo, cobrancaSelecionada]);

  // Alternar A4 / Térmico
  const handleAlternarFormato = useCallback(() => {
    const novoModo = !modoTermico;
    setModoTermico(novoModo);
    carregarRecibo(novoModo);
  }, [modoTermico, carregarRecibo]);

  // Dados para exibição
  const c = cobrancaSelecionada;
  const dadosRecibo = recibo || null;

  if (carregando) {
    return (
      <View style={rs.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={rs.loadingText}>Carregando recibo...</Text>
      </View>
    );
  }

  if (!c && !dadosRecibo) {
    return (
      <View style={rs.centered}>
        <Ionicons name="document-text-outline" size={56} color="#CBD5E1" />
        <Text style={rs.emptyTitle}>Recibo não disponível</Text>
        <Text style={rs.emptySub}>Não foi possível carregar os dados do recibo</Text>
        <TouchableOpacity style={rs.voltarBtn} onPress={() => navigation.goBack()}>
          <Text style={rs.voltarText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Se temos dados da API, usar; senão montar com dados locais
  const clienteNome = dadosRecibo?.clienteNome || c?.clienteNome || '';
  const produtoId = dadosRecibo?.produtoIdentificador || c?.produtoIdentificador || '';
  const periodo = dadosRecibo?.periodo ||
    (c ? `${formatarData(c.dataInicio)} → ${formatarData(c.dataFim)}` : '');
  const relogioAnterior = dadosRecibo?.relogioAnterior || c?.relogioAnterior || 0;
  const relogioAtual = dadosRecibo?.relogioAtual || c?.relogioAtual || 0;
  const fichasRodadas = dadosRecibo?.fichasRodadas || c?.fichasRodadas || 0;
  const totalBruto = dadosRecibo?.totalBruto || c?.totalBruto || 0;
  const descontoPartidas = dadosRecibo?.descontoPartidasValor || c?.descontoPartidasValor || 0;
  const descontoDinheiro = dadosRecibo?.descontoDinheiro || c?.descontoDinheiro || 0;
  const subtotal = dadosRecibo?.subtotalAposDescontos || c?.subtotalAposDescontos || 0;
  const percentualEmpresa = dadosRecibo?.percentualEmpresa || c?.percentualEmpresa || 0;
  const valorPercentual = dadosRecibo?.valorPercentual || c?.valorPercentual || 0;
  const totalPagar = dadosRecibo?.totalClientePaga || c?.totalClientePaga || 0;
  const valorRecebido = dadosRecibo?.valorRecebido || c?.valorRecebido || 0;
  const saldoDevedor = dadosRecibo?.saldoDevedorGerado || c?.saldoDevedorGerado || 0;
  const status = dadosRecibo?.status || c?.status || '';
  const observacao = dadosRecibo?.observacao || c?.observacao || '';

  return (
    <SafeAreaView style={rs.container} edges={['bottom']}>
      {/* Offline banner */}
      {offline && (
        <View style={rs.offlineBanner}>
          <Ionicons name="cloud-offline" size={14} color="#D97706" />
          <Text style={rs.offlineText}>Modo offline — dados locais</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={rs.scroll} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho do Recibo */}
        <View style={rs.reciboHeader}>
          <Ionicons name="document-text" size={32} color="#2563EB" />
          <Text style={rs.reciboTitle}>RECIBO DE COBRANÇA</Text>
          <Text style={rs.reciboData}>
            Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Formato tag */}
        <View style={rs.formatoRow}>
          <TouchableOpacity
            style={[rs.formatoBtn, !modoTermico && rs.formatoBtnAtivo]}
            onPress={() => { setModoTermico(false); carregarRecibo(false); }}
          >
            <Ionicons name="document" size={16} color={!modoTermico ? '#2563EB' : '#94A3B8'} />
            <Text style={[rs.formatoText, !modoTermico && { color: '#2563EB' }]}>A4</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[rs.formatoBtn, modoTermico && rs.formatoBtnAtivo]}
            onPress={() => { setModoTermico(true); carregarRecibo(true); }}
          >
            <Ionicons name="receipt" size={16} color={modoTermico ? '#2563EB' : '#94A3B8'} />
            <Text style={[rs.formatoText, modoTermico && { color: '#2563EB' }]}>Térmico 58mm</Text>
          </TouchableOpacity>
        </View>

        {/* Informações do Cliente */}
        <View style={rs.section}>
          <Text style={rs.sectionTitle}>Cliente</Text>
          <ReciboLinha label="Nome" valor={clienteNome} destaque />
          <ReciboLinha label="Produto N°" valor={produtoId} />
          <ReciboLinha label="Período" valor={periodo} />
        </View>

        {/* Leitura do Relógio */}
        <View style={rs.section}>
          <Text style={rs.sectionTitle}>Leitura do Relógio</Text>
          <View style={rs.relogioRow}>
            <View style={rs.relogioBox}>
              <Text style={rs.relogioLabel}>Anterior</Text>
              <Text style={rs.relogioValor}>{relogioAnterior.toLocaleString('pt-BR')}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#94A3B8" />
            <View style={[rs.relogioBox, rs.relogioBoxAtual]}>
              <Text style={rs.relogioLabel}>Atual</Text>
              <Text style={[rs.relogioValor, { color: '#2563EB' }]}>{relogioAtual.toLocaleString('pt-BR')}</Text>
            </View>
          </View>
          <ReciboLinha label="Fichas Rodadas" valor={`${fichasRodadas.toLocaleString('pt-BR')} fichas`} destaque />
        </View>

        {/* Cálculo de Valores */}
        <View style={rs.section}>
          <Text style={rs.sectionTitle}>Cálculo de Valores</Text>
          <ReciboLinha label="Total Bruto" valor={formatarMoeda(totalBruto)} />
          {descontoPartidas > 0 && (
            <ReciboLinha label="Desc. Partidas" valor={`– ${formatarMoeda(descontoPartidas)}`} cor="#DC2626" />
          )}
          {descontoDinheiro > 0 && (
            <ReciboLinha label="Desc. Dinheiro" valor={`– ${formatarMoeda(descontoDinheiro)}`} cor="#DC2626" />
          )}
          <ReciboLinha label="Subtotal" valor={formatarMoeda(subtotal)} />
          <ReciboLinha label={`Empresa (${percentualEmpresa}%)`} valor={formatarMoeda(valorPercentual)} />
          <Divisor />
          <ReciboLinha label="TOTAL A PAGAR" valor={formatarMoeda(totalPagar)} destaque />
          <ReciboLinha label="VALOR RECEBIDO" valor={formatarMoeda(valorRecebido)} destaque cor="#16A34A" />
          {saldoDevedor > 0 && (
            <ReciboLinha label="SALDO DEVEDOR" valor={formatarMoeda(saldoDevedor)} destaque cor="#DC2626" />
          )}
        </View>

        {/* Status */}
        <View style={rs.statusSection}>
          <View style={[rs.statusBadge, {
            backgroundColor: status === 'Pago' ? '#F0FDF4' : status === 'Parcial' ? '#DBEAFE' : '#FEF2F2',
          }]}>
            <Ionicons name={
              status === 'Pago' ? 'checkmark-circle' : status === 'Parcial' ? 'time' : 'alert-circle'
            } size={16} color={
              status === 'Pago' ? '#16A34A' : status === 'Parcial' ? '#2563EB' : '#DC2626'
            } />
            <Text style={[rs.statusText, {
              color: status === 'Pago' ? '#16A34A' : status === 'Parcial' ? '#2563EB' : '#DC2626',
            }]}>{status}</Text>
          </View>
        </View>

        {/* Observação */}
        {observacao ? (
          <View style={rs.section}>
            <Text style={rs.sectionTitle}>Observação</Text>
            <View style={rs.obsBox}>
              <Text style={rs.obsText}>{observacao}</Text>
            </View>
          </View>
        ) : null}

        {/* Rodapé do recibo */}
        <View style={rs.reciboFooter}>
          <Text style={rs.footerText}>Documento gerado eletronicamente</Text>
          <Text style={rs.footerText}>sem valor fiscal</Text>
        </View>
      </ScrollView>

      {/* Barra de ações fixa */}
      <View style={rs.actionBar}>
        <TouchableOpacity
          style={rs.compartilharBtn}
          onPress={handleCompartilhar}
          disabled={compartilhando}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social" size={20} color="#FFFFFF" />
          <Text style={rs.compartilharText}>
            {compartilhando ? 'Compartilhando...' : 'Compartilhar'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const rs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText: { color: '#64748B', fontSize: 15, marginTop: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#64748B' },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 280, marginTop: 4 },
  voltarBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 10 },
  voltarText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  // Offline
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFFBEB', paddingVertical: 8, paddingHorizontal: 16,
  },
  offlineText: { fontSize: 12, color: '#D97706', fontWeight: '600' },

  // Scroll
  scroll: { padding: 16, paddingBottom: 100 },

  // Header recibo
  reciboHeader: { alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  reciboTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', letterSpacing: 1 },
  reciboData: { fontSize: 12, color: '#94A3B8' },

  // Formato
  formatoRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  formatoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  formatoBtnAtivo: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  formatoText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },

  // Seções
  section: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  // Linhas
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  linhaLabel: { fontSize: 14, color: '#64748B', flex: 1 },
  linhaValor: { fontSize: 14, fontWeight: '500', color: '#1E293B', textAlign: 'right', flex: 1 },

  // Divisor
  divisor: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },

  // Relógio
  relogioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginVertical: 10, gap: 8 },
  relogioBox: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14 },
  relogioBoxAtual: { backgroundColor: '#EFF6FF' },
  relogioLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  relogioValor: { fontSize: 18, fontWeight: '800', color: '#1E293B' },

  // Status
  statusSection: { alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  statusText: { fontSize: 14, fontWeight: '700' },

  // Observação
  obsBox: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: '#2563EB' },
  obsText: { fontSize: 14, color: '#475569', lineHeight: 20 },

  // Footer
  reciboFooter: { alignItems: 'center', paddingVertical: 16, gap: 2 },
  footerText: { fontSize: 11, color: '#CBD5E1' },

  // Action bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', padding: 16, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  compartilharBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 16,
  },
  compartilharText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
