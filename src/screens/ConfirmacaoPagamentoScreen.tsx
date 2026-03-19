/**
 * ConfirmacaoPagamentoScreen.tsx
 * Passo 4 — confirmação com resumo completo + próxima cobrança
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { Ionicons }      from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

import { useCobranca }   from '../contexts/CobrancaContext';
import { locacaoRepository } from '../repositories/LocacaoRepository';
import { useLocacao }    from '../contexts/LocacaoContext';
import { useProduto }    from '../contexts/ProdutoContext';
import { manutencaoRepository } from '../repositories/ManutencaoRepository';
import { formatarMoeda } from '../utils/currency';
import { printService, DadosComprovante } from '../services/PrintService';
import { masks }         from '../utils/masks';
import {
  CobrancasStackParamList,
  CobrancasStackNavigationProp,
} from '../navigation/CobrancasStack';

type RoutePropType = RouteProp<CobrancasStackParamList, 'ConfirmacaoPagamento'>;

const FORMA_LABELS: Record<string, string> = {
  PercentualReceber: 'Empresa recebe percentual de',
  PercentualPagar:   'Cliente recebe percentual de',
  Periodo:           'Período:',
};

function parseDateBR(str: string): string {
  const p = str.split('/');
  if (p.length === 3) return new Date(`${p[2]}-${p[1]}-${p[0]}`).toISOString();
  return str;
}

function TRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tRow}>
      <Text style={s.tLabel}>{label}</Text>
      <Text style={s.tValue}>{value}</Text>
    </View>
  );
}

export default function ConfirmacaoPagamentoScreen() {
  const route      = useRoute<RoutePropType>();
  const navigation = useNavigation<CobrancasStackNavigationProp>();
  const { dados }  = route.params;

  const { registrarCobranca, carregando } = useCobranca();
  const { atualizarLocacao }              = useLocacao();
  const { atualizarProduto }              = useProduto();

  const [dataPrevisao,         setDataPrevisao]         = useState('');
  const [marcarVoltar,         setMarcarVoltar]         = useState(true);
  const [fisicamenteNoCliente, setFisicamenteNoCliente] = useState(false);

  const saldoAnterior  = dados.saldoAnterior ?? 0;
  const bonificacao    = dados.bonificacao    ?? 0;
  const incluirPeriodo = dados.incluirPeriodo ?? false;
  const valorPeriodo   = dados.valorPeriodo   ?? 0;
  const trocaPano  = dados.trocaPano  ?? false;
  const isPagar    = dados.formaPagamento === 'PercentualPagar';
  const isPeriodo  = dados.formaPagamento === 'Periodo';
  const totalComSaldo  = dados.totalClientePaga + (isPagar ? 0 : saldoAnterior);
  const saldoDevedor   = Math.max(0, totalComSaldo - dados.valorRecebido);
  const troco          = Math.max(0, dados.valorRecebido - totalComSaldo);
  const hoje = new Date().toLocaleDateString('pt-BR');

  const handleImprimir = useCallback(async () => {
    const dadosComprovante: DadosComprovante = {
      clienteNome:          dados.clienteNome,
      produtoTipo:          dados.produtoTipo,
      produtoIdentificador: dados.produtoIdentificador,
      formaPagamento:       dados.formaPagamento,
      dataCobranca:         new Date().toISOString(),
      relogioAnterior:      dados.relogioAnterior || undefined,
      relogioAtual:         dados.relogioAtual    || undefined,
      fichasRodadas:        dados.fichasRodadas   || undefined,
      totalBruto:           dados.totalBruto      || undefined,
      descontoPartidas:     dados.descontoPartidasValor || undefined,
      descontoDinheiro:     dados.descontoDinheiro     || undefined,
      percentualEmpresa:    dados.percentualEmpresa,
      valorEmpresaRecebe:   dados.valorPercentual,
      totalClientePaga:     dados.totalClientePaga,
      valorRecebido:        dados.valorRecebido > 0 ? dados.valorRecebido : undefined,
      saldoDevedor:         saldoDevedor > 0 ? saldoDevedor : undefined,
      troco:                troco > 0 ? troco : undefined,
      observacao:           dados.observacao || undefined,
    };
    await printService.imprimirComprovante(dadosComprovante);
  }, [dados, saldoDevedor, troco]);

  const handleConfirmar = useCallback(async () => {
    try {
      const obsArr: string[] = [];
      if (dados.observacao)     obsArr.push(dados.observacao);
      if (marcarVoltar)         obsArr.push('Marcar para voltar depois');
      if (fisicamenteNoCliente) obsArr.push('Estou fisicamente no cliente');

      const cobranca = await registrarCobranca({
        locacaoId:             dados.locacaoId,
        clienteId:             dados.clienteId,
        clienteNome:           dados.clienteNome,
        produtoIdentificador:  dados.produtoIdentificador,
        dataInicio:            dados.dataInicio,
        dataFim:               new Date().toISOString(),
        dataVencimento:        dataPrevisao ? parseDateBR(dataPrevisao) : undefined,
        relogioAnterior:       dados.relogioAnterior,
        relogioAtual:          dados.relogioAtual,
        fichasRodadas:         dados.fichasRodadas,
        valorFicha:            dados.valorFicha,
        totalBruto:            dados.totalBruto,
        descontoPartidasQtd:   dados.descontoPartidasQtd,
        descontoPartidasValor: dados.descontoPartidasValor,
        descontoDinheiro:      dados.descontoDinheiro,
        percentualEmpresa:     dados.percentualEmpresa,
        subtotalAposDescontos: dados.subtotalAposDescontos,
        valorPercentual:       dados.valorPercentual,
        totalClientePaga:      dados.totalClientePaga,
        valorRecebido:         dados.valorRecebido,
        observacao:            obsArr.join(' | ') || undefined,
      });

      if (cobranca) {
        await atualizarLocacao({
          id:                   dados.locacaoId,
          ultimaLeituraRelogio: dados.relogioAtual,
          dataUltimaCobranca:   new Date().toISOString(),
        });

        // Se marcou troca de pano/manutenção, atualizar produto
        if (trocaPano) {
          try {
            const locacao = await locacaoRepository.getById(dados.locacaoId);
            if (locacao?.produtoId) {
              const nowManut = new Date().toISOString();
              await atualizarProduto({
                id: String(locacao.produtoId),
                dataUltimaManutencao: nowManut,
                relatorioUltimaManutencao: 'Troca de pano registrada durante cobrança',
              });
              // Salvar no histórico de manutenções
              await manutencaoRepository.registrar({
                produtoId: String(locacao.produtoId),
                produtoIdentificador: locacao.produtoIdentificador,
                produtoTipo: locacao.produtoTipo,
                clienteId: String(locacao.clienteId),
                clienteNome: locacao.clienteNome,
                locacaoId: String(locacao.id),
                cobrancaId: cobranca ? String(cobranca.id) : undefined,
                tipo: 'trocaPano',
                descricao: 'Troca de pano durante cobrança',
                data: nowManut,
              });
            }
          } catch (e) {
            console.warn('[ConfirmacaoPagamento] Erro ao registrar manutenção:', e);
          }
        }

        Alert.alert(
          'Pagamento Confirmado!',
          saldoDevedor > 0
            ? `Saldo devedor: ${formatarMoeda(saldoDevedor)}`
            : 'Cobrança registrada com sucesso.',
          [{ text: 'OK', onPress: () => navigation.pop(2) }],
        );
      } else {
        Alert.alert('Erro', 'Não foi possível registrar o pagamento');
      }
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao confirmar pagamento');
    }
  }, [dados, dataPrevisao, marcarVoltar, fisicamenteNoCliente, saldoDevedor,
      registrarCobranca, atualizarLocacao, navigation]);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* subheader azul */}
        <View style={s.subHeader}>
          <View>
            <Text style={s.subProduto}>{dados.produtoTipo} N. {dados.produtoIdentificador}</Text>
            <Text style={s.subDataLabel}>Data pagamento</Text>
            <Text style={s.subDataValor}>{hoje}</Text>
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalBoxLabel}>Total</Text>
            <Text style={s.totalBoxValue}>{formatarMoeda(totalComSaldo)}</Text>
          </View>
        </View>

        {/* forma pagamento */}
        <View style={s.section}>
          <Text style={s.secLabel}>Pagamento</Text>
          <Text style={s.secDesc}>
            {trocaPano && (
              <Text style={s.trocaPanoTag}>
                <Ionicons name="construct-outline" size={12} color="#16A34A" /> Manutenção registrada
              </Text>
            )}
            {dados.formaPagamento === 'Periodo'
              ? (isPeriodo && !incluirPeriodo
                  ? 'Valor referente apenas ao saldo devedor. Para cobrar o valor do período junto, volte e atualize a cobrança'
                  : `Período ${dados.percentualEmpresa.toFixed(0)}% incluído`)
              : `${FORMA_LABELS[dados.formaPagamento] ?? dados.formaPagamento} ${dados.percentualEmpresa.toFixed(1)}%`}
          </Text>
        </View>

        {/* tabela */}
        <View style={s.table}>
          <TRow label="Relógio atual"    value={String(dados.relogioAtual)} />
          <TRow label="Relógio anterior" value={String(dados.relogioAnterior)} />
          <TRow label="Fichas rodadas"   value={String(dados.fichasRodadas)} />
          <TRow label="Total bruto"      value={formatarMoeda(dados.totalBruto)} />
          <TRow label={`Subtotal (${dados.percentualEmpresa.toFixed(1)}%)`}
                value={formatarMoeda(dados.valorPercentual)} />
          {saldoAnterior > 0 && !isPagar && (
            <TRow label="Saldo devedor anterior" value={formatarMoeda(saldoAnterior)} />
          )}
          {bonificacao > 0 && (
            <TRow label="Bonificação" value={formatarMoeda(bonificacao)} />
          )}
          {isPeriodo && incluirPeriodo && valorPeriodo > 0 && (
            <TRow label={`+ Período (${dados.observacao || 'fixo'})`} value={formatarMoeda(valorPeriodo)} />
          )}
        </View>

        <View style={s.div} />

        {/* totais */}
        <View style={s.totaisSection}>
          <View style={s.tTotalRow}>
            <Text style={s.tTotalLabel}>
              {saldoAnterior > 0 ? 'Total com Saldo' : 'Total a Pagar'}
            </Text>
            <Text style={[s.tTotalValue, saldoAnterior > 0 && { color: '#E53935' }]}>
              {formatarMoeda(totalComSaldo)}
            </Text>
          </View>
          <View style={s.tTotalRow}>
            <Text style={s.tTotalLabel}>Total Recebido</Text>
            <Text style={s.tTotalValue}>{formatarMoeda(dados.valorRecebido)}</Text>
          </View>
          <View style={s.tTotalRow}>
            <Text style={[s.tTotalLabel, s.saldoLabel]}>Saldo devedor atual</Text>
            <Text style={[s.tTotalValue, s.saldoValue]}>{formatarMoeda(saldoDevedor)}</Text>
          </View>
          <Text style={s.nota}>
            O valor previsto para o cliente nessa cobrança é de {formatarMoeda(totalComSaldo)}
            {saldoAnterior > 0 ? ` (inclui ${formatarMoeda(saldoAnterior)} de saldo anterior)` : ''}
          </Text>
        </View>

        {/* próxima cobrança */}
        <View style={s.section}>
          <View style={s.proximaHeader}>
            <Ionicons name="cash" size={20} color="#1976D2" />
            <Text style={s.proximaTitulo}>Próxima cobrança</Text>
          </View>
          <View style={s.div} />
          <TextInput
            style={s.inputDate} placeholder="Data de previsão"
            placeholderTextColor="#9E9E9E" value={dataPrevisao}
            onChangeText={v => setDataPrevisao(masks.date(v))}
            keyboardType="numeric" maxLength={10}
          />
          <View style={s.checkRow}>
            <Text style={s.checkLabel}>Marcar para voltar depois</Text>
            <TouchableOpacity
              style={[s.checkbox, marcarVoltar && s.checkboxChecked]}
              onPress={() => setMarcarVoltar(v => !v)}
            >
              {marcarVoltar && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* fisicamente no cliente */}
        <View style={s.fisicRow}>
          <TouchableOpacity
            style={[s.checkboxSq, fisicamenteNoCliente && s.checkboxSqChecked]}
            onPress={() => setFisicamenteNoCliente(v => !v)}
          >
            {fisicamenteNoCliente && <Ionicons name="checkmark" size={16} color="#1976D2" />}
          </TouchableOpacity>
          <Text style={s.fisicLabel}>Estou fisicamente no cliente</Text>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btnConfirmar, carregando && s.btnDisabled]}
          onPress={handleConfirmar} disabled={carregando} activeOpacity={0.85}
        >
          {carregando
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={s.btnText}>CONFIRMAR PAGAMENTO</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#EEEEEE' },
  scrollContent:  { paddingBottom: 16 },
  subHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    backgroundColor: '#1976D2', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  subProduto:     { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 8 },
  subDataLabel:   { fontSize: 11, color: '#BBDEFB' },
  subDataValor:   { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  totalBox: {
    backgroundColor: '#0D47A1', borderRadius: 4,
    paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', minWidth: 110,
  },
  totalBoxLabel:  { fontSize: 11, color: '#90CAF9', marginBottom: 4 },
  totalBoxValue:  { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  section:        { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  secLabel:       { fontSize: 11, color: '#9E9E9E', marginBottom: 4 },
  secDesc:        { fontSize: 15, color: '#212121' },
  table:          { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8 },
  tRow:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  tLabel:         { fontSize: 13, color: '#757575' },
  tValue:         { fontSize: 13, color: '#212121', textAlign: 'right' },
  div:            { height: 1, backgroundColor: '#E0E0E0' },
  totaisSection:  { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, marginBottom: 8 },
  tTotalRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  tTotalLabel:    { fontSize: 14, color: '#212121' },
  tTotalValue:    { fontSize: 14, color: '#212121' },
  saldoLabel:     { fontWeight: '700' },
  saldoValue:     { fontWeight: '700', color: '#E53935' },
  nota:           { fontSize: 12, color: '#757575', marginTop: 8, lineHeight: 18 },
  proximaHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  proximaTitulo:  { fontSize: 15, fontWeight: '600', color: '#1976D2' },
  inputDate:      { borderBottomWidth: 1, borderBottomColor: '#9E9E9E', fontSize: 15, color: '#212121', paddingVertical: 6, marginTop: 12 },
  checkRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  checkLabel:     { fontSize: 14, color: '#212121' },
  checkbox:       { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#BDBDBD', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked:{ backgroundColor: '#1976D2', borderColor: '#1976D2' },
  fisicRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  checkboxSq:     { width: 24, height: 24, borderWidth: 2, borderColor: '#9E9E9E', justifyContent: 'center', alignItems: 'center' },
  checkboxSqChecked:{ borderColor: '#1976D2' },
  fisicLabel:     { fontSize: 14, color: '#212121' },
  footer:         { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  btnImprimir:  { justifyContent: 'center', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#BFDBFE', marginBottom: 10 },
  btnConfirmar:   { backgroundColor: '#1565C0', borderRadius: 6, padding: 16, alignItems: 'center' },
  btnDisabled:    { backgroundColor: '#BDBDBD' },
  btnText:        { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
});
