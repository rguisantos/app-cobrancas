/**
 * CobrancaConfirmScreen.tsx
 * Fluxo de cobrança direta (a partir de uma locação)
 *
 * PASSO 1 — Preenchimento: relógio atual, descontos, valor recebido
 * PASSO 2 — Resumo/Confirmação: exibe todos os detalhes calculados,
 *            permite voltar para corrigir ou confirmar a cobrança
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView }  from 'react-native-safe-area-context';

import { useLocacao }      from '../contexts/LocacaoContext';
import { useCobranca }     from '../contexts/CobrancaContext';
import { useProduto }      from '../contexts/ProdutoContext';
import { manutencaoRepository } from '../repositories/ManutencaoRepository';
import { locacaoRepository }   from '../repositories/LocacaoRepository';
import { cobrancaService } from '../services/CobrancaService';
import { formatarMoeda, formatarNumero } from '../utils/currency';
import { masks }           from '../utils/masks';
import { CobrancasStackParamList } from '../navigation/CobrancasStack';

type CobrancaConfirmRouteProp = RouteProp<CobrancasStackParamList, 'CobrancaConfirm'>;

// ─── componente auxiliar para linha do resumo ─────────────────────────────────
function TRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={s.tRow}>
      <Text style={[s.tLabel, bold && { fontWeight: '700', color: '#1E293B' }]}>{label}</Text>
      <Text style={[s.tValue, bold && { fontWeight: '800', fontSize: 16 }, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

export default function CobrancaConfirmScreen() {
  const route      = useRoute<CobrancaConfirmRouteProp>();
  const navigation = useNavigation();

  const { locacaoSelecionada, selecionarLocacao, atualizarLocacao } = useLocacao();
  const { atualizarProduto } = useProduto();
  const { registrarCobranca, carregando } = useCobranca();

  const { locacaoId } = route.params;

  // ── estado ────────────────────────────────────────────────────────────────
  const [passo,           setPasso]           = useState<1 | 2>(1);
  const [relogioAnterior, setRelogioAnterior] = useState(0);
  const [trocaPano,       setTrocaPano]       = useState(false);
  const [relogioAtual,    setRelogioAtual]    = useState('');
  const [descontoPartidas,setDescontoPartidas]= useState('');
  const [descontoDinheiro,setDescontoDinheiro]= useState('');
  const [valorRecebido,   setValorRecebido]   = useState('');
  const [observacao,      setObservacao]      = useState('');
  const [calculo,         setCalculo]         = useState<any>(null);
  const [validacao,       setValidacao]       = useState<any>(null);
  const [isSubmitting,    setIsSubmitting]    = useState(false); // guarda local contra double-submit

  // ── carregar locação ──────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (locacaoId) selecionarLocacao(locacaoId);
  }, [locacaoId, selecionarLocacao]));

  useEffect(() => {
    if (locacaoSelecionada) {
      setRelogioAnterior(
        parseInt(
          locacaoSelecionada.ultimaLeituraRelogio?.toString() ||
          locacaoSelecionada.numeroRelogio || '0', 10
        )
      );
    }
  }, [locacaoSelecionada]);

  // ── cálculo em tempo real ─────────────────────────────────────────────────
  const isPeriodo = locacaoSelecionada?.formaPagamento === 'Periodo';

  useEffect(() => {
    if (!locacaoSelecionada) { setCalculo(null); setValidacao(null); return; }
    if (isPeriodo) {
      // Periodo: calcular baseado em valor fixo
      const vFixo = locacaoSelecionada.valorFixo || 0;
      const descD = parseFloat(descontoDinheiro.replace(',', '.')) || 0;
      setCalculo({ totalClientePaga: Math.max(0, vFixo - descD), fichasRodadas: 0, totalBruto: vFixo, subtotalAposDescontoDinheiro: Math.max(0, vFixo - descD), descontoPartidasValor: 0, descontoDinheiroValor: descD, valorPercentual: Math.max(0, vFixo - descD), bonificacaoValor: 0 });
      setValidacao({ valida: true, erros: [], avisos: [] });
      return;
    }
    if (!relogioAtual) { setCalculo(null); setValidacao(null); return; }
    const atual = parseInt(relogioAtual.replace(/\D/g, ''), 10);
    if (isNaN(atual)) { setCalculo(null); return; }
    const input = {
      relogioAnterior,
      relogioAtual: atual,
      valorFicha:        locacaoSelecionada.precoFicha || 0,
      percentualEmpresa: locacaoSelecionada.percentualEmpresa || 50,
      descontoPartidasQtd: parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0,
      descontoDinheiro:    parseFloat(descontoDinheiro.replace(',', '.')) || 0,
      formaPagamento:      locacaoSelecionada.formaPagamento,
    };
    setCalculo(cobrancaService.calcularCobranca(input));
    setValidacao(cobrancaService.validarCobranca(input));
  }, [relogioAtual, relogioAnterior, descontoPartidas, descontoDinheiro, locacaoSelecionada]);

  const valorRecebidoNum = parseFloat(valorRecebido.replace(',', '.')) || 0;
  const saldoDevedor     = calculo ? Math.max(0, calculo.totalClientePaga - valorRecebidoNum) : 0;
  const troco            = calculo ? Math.max(0, valorRecebidoNum - calculo.totalClientePaga) : 0;

  // ── avancar para resumo ───────────────────────────────────────────────────
  const handleAvancar = useCallback(() => {
    if (!locacaoSelecionada) { Alert.alert('Erro', 'Locação não encontrada'); return; }
    if (!isPeriodo && !relogioAtual.trim()) { Alert.alert('Campo obrigatório', 'Informe o relógio atual'); return; }
    if (!calculo || !validacao?.valida) {
      Alert.alert('Dados inválidos', validacao?.erros?.join('\n') || 'Verifique os dados');
      return;
    }
    setPasso(2);
  }, [calculo, validacao, locacaoSelecionada]);

  // ── confirmar cobrança ────────────────────────────────────────────────────
  const handleConfirmar = useCallback(async () => {
    if (!calculo || !locacaoSelecionada || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const relogioAtualNum = parseInt(relogioAtual.replace(/\D/g, ''), 10);

      // Buscar saldo devedor pendente desta locação para acumulá-lo corretamente
      const { cobrancaRepository } = await import('../repositories/CobrancaRepository');
      const saldoAnterior = await cobrancaRepository.getSaldoPendenteByLocacao(
        String(locacaoSelecionada.id)
      );

      const cobranca = await registrarCobranca({
        locacaoId:             String(locacaoSelecionada.id),
        clienteId:             String(locacaoSelecionada.clienteId),
        clienteNome:           locacaoSelecionada.clienteNome || '',
        produtoIdentificador:  locacaoSelecionada.produtoIdentificador || '',
        dataInicio:            locacaoSelecionada.dataUltimaCobranca || locacaoSelecionada.dataLocacao || new Date().toISOString(),
        dataFim:               new Date().toISOString(),
        relogioAnterior,
        relogioAtual:          relogioAtualNum,
        fichasRodadas:         calculo.fichasRodadas,
        valorFicha:            locacaoSelecionada.precoFicha || 3,
        totalBruto:            calculo.totalBruto,
        descontoPartidasQtd:   parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0,
        descontoPartidasValor: calculo.descontoPartidasValor,
        descontoDinheiro:      calculo.descontoDinheiroValor,
        percentualEmpresa:     locacaoSelecionada.percentualEmpresa || 50,
        subtotalAposDescontos: calculo.subtotalAposDescontoDinheiro,
        valorPercentual:       calculo.valorPercentual,
        totalClientePaga:      calculo.totalClientePaga,
        valorRecebido:         valorRecebidoNum,
        saldoAnterior,                               // Saldo devedor pendente acumulado
        formaPagamento:        locacaoSelecionada.formaPagamento, // Para cálculo correto
        observacao,
      });

      if (cobranca) {
        await atualizarLocacao({
          id:                   String(locacaoSelecionada.id),
          ultimaLeituraRelogio: relogioAtualNum,
          dataUltimaCobranca:   new Date().toISOString(),
        });

        Alert.alert(
          'Cobrança Registrada! ✓',
          [
            `Fichas: ${calculo.fichasRodadas}`,
            `Total: ${formatarMoeda(calculo.totalClientePaga)}`,
            `Empresa recebe: ${formatarMoeda(calculo.valorPercentual)}`,
            valorRecebidoNum > 0 ? `Recebido: ${formatarMoeda(valorRecebidoNum)}` : null,
            saldoDevedor > 0 ? `Saldo devedor: ${formatarMoeda(saldoDevedor)}` : null,
            troco > 0 ? `Troco: ${formatarMoeda(troco)}` : null,
          ].filter(Boolean).join('\n'),
          [
            {
              text: 'Ver Detalhe',
              onPress: () => {
                navigation.goBack();
                (navigation as any).navigate?.('CobrancaDetail', { cobrancaId: String(cobranca.id) });
              },
            },
            { text: 'OK', onPress: () => navigation.goBack() },
          ]
        );
      } else {
        Alert.alert('Erro', 'Não foi possível registrar a cobrança');
      }
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao registrar cobrança');
    } finally {
      setIsSubmitting(false);
    }
  }, [calculo, locacaoSelecionada, relogioAtual, relogioAnterior, descontoPartidas, isSubmitting,
      valorRecebidoNum, observacao, saldoDevedor, troco, registrarCobranca, atualizarLocacao, navigation]);

  // ── loading ───────────────────────────────────────────────────────────────
  if (!locacaoSelecionada && locacaoId) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator size="large" color="#2563EB" />
          <Text style={s.loadingText}>Carregando...</Text></View>
      </SafeAreaView>
    );
  }

  const loc = locacaoSelecionada;
  const formaPagamento = loc?.formaPagamento || 'PercentualReceber';
  const labelPercentual = formaPagamento === 'PercentualReceber' ? '% Receber (empresa)' :
                          formaPagamento === 'PercentualPagar'   ? '% Pagar (empresa)'  : 'Valor Fixo';

  // ══════════════════════════════════════════════════════════════════════════
  // PASSO 2 — RESUMO / CONFIRMAÇÃO
  // ══════════════════════════════════════════════════════════════════════════
  if (passo === 2 && calculo && loc) {
    return (
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

            {/* header */}
            <View style={s.headerCard}>
              <Text style={s.clienteNome}>{loc.clienteNome}</Text>
              <Text style={s.produtoInfo}>
                {loc.produtoTipo} N° {loc.produtoIdentificador} · {labelPercentual}
              </Text>
            </View>

            {/* relógio */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Leitura do Relógio</Text>
              <View style={s.sectionCard}>
                <View style={s.relogioResumoRow}>
                  <View style={s.relogioBox}>
                    <Text style={s.relogioBoxLabel}>Anterior</Text>
                    <Text style={s.relogioBoxValue}>{formatarNumero(relogioAnterior)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#94A3B8" />
                  <View style={[s.relogioBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1.5 }]}>
                    <Text style={s.relogioBoxLabel}>Atual</Text>
                    <Text style={[s.relogioBoxValue, { color: '#2563EB' }]}>
                      {formatarNumero(parseInt(relogioAtual.replace(/\D/g, ''), 10) || 0)}
                    </Text>
                  </View>
                  <View style={[s.relogioBox, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={s.relogioBoxLabel}>Fichas</Text>
                    <Text style={[s.relogioBoxValue, { color: '#16A34A' }]}>{calculo.fichasRodadas}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* cálculo */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Resumo de Valores</Text>
              <View style={s.sectionCard}>
                <TRow label="Total Bruto"
                      value={`${calculo.fichasRodadas} fichas × ${formatarMoeda(loc.precoFicha || 0)} = ${formatarMoeda(calculo.totalBruto)}`} />

                {calculo.descontoPartidasValor > 0 && (
                  <TRow label={`– Desc. Partidas (${descontoPartidas} × ${formatarMoeda(loc.precoFicha || 0)})`}
                        value={`– ${formatarMoeda(calculo.descontoPartidasValor)}`}
                        color="#DC2626" />
                )}

                {calculo.descontoDinheiroValor > 0 && (
                  <TRow label="– Desc. Dinheiro"
                        value={`– ${formatarMoeda(calculo.descontoDinheiroValor)}`}
                        color="#DC2626" />
                )}

                <View style={s.divider} />

                <TRow label={`${labelPercentual} (${loc.percentualEmpresa}%)`}
                      value={formatarMoeda(calculo.valorPercentual)}
                      color="#2563EB" />

                <View style={s.divider} />

                <TRow label="Total a Pagar" value={formatarMoeda(calculo.totalClientePaga)} bold />
              </View>
            </View>

            {/* pagamento */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Pagamento</Text>
              <View style={s.sectionCard}>
                <TRow label="Valor Recebido" value={valorRecebidoNum > 0 ? formatarMoeda(valorRecebidoNum) : '—'} />
                {troco > 0 && (
                  <TRow label="Troco" value={formatarMoeda(troco)} color="#16A34A" />
                )}
                {saldoDevedor > 0 && (
                  <TRow label="Saldo Devedor" value={formatarMoeda(saldoDevedor)} color="#DC2626" bold />
                )}
                {saldoDevedor === 0 && troco === 0 && valorRecebidoNum > 0 && (
                  <View style={s.pagoExato}>
                    <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                    <Text style={s.pagoExatoText}>Pagamento exato</Text>
                  </View>
                )}
              </View>
            </View>

            {/* observação */}
            {observacao ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Observação</Text>
                <View style={s.sectionCard}>
                  <Text style={{ fontSize: 14, color: '#475569' }}>{observacao}</Text>
                </View>
              </View>
            ) : null}

            <View style={{ height: 110 }} />
          </ScrollView>

          {/* botões */}
          <View style={s.bottomBar}>
            <View style={s.bottomRow}>
              <TouchableOpacity
                style={[s.btnVoltar]}
                onPress={() => setPasso(1)}
                disabled={carregando || isSubmitting}
              >
                <Ionicons name="arrow-back" size={20} color="#64748B" />
                <Text style={s.btnVoltarText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btnConfirmar, carregando && s.btnDisabled]}
                onPress={handleConfirmar}
                disabled={carregando || isSubmitting}
              >
                {carregando
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={s.btnConfirmarText}>
                        Confirmar · {formatarMoeda(calculo.totalClientePaga)}
                      </Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASSO 1 — PREENCHIMENTO
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* header locação */}
          <View style={s.headerCard}>
            <Text style={s.clienteNome}>{loc?.clienteNome || '—'}</Text>
            <Text style={s.produtoInfo}>
              {loc?.produtoTipo} N° {loc?.produtoIdentificador}
              {loc?.produtoTipo ? ` · ${labelPercentual}` : ''}
            </Text>
            <Text style={s.pagamentoInfo}>
              {loc?.percentualEmpresa}% · R$ {(loc?.precoFicha || 0).toFixed(2)}/ficha
            </Text>
          </View>

          {/* relógio */}
          <View style={s.section}><Text style={s.sectionTitle}>Leitura do Relógio</Text>
            <View style={s.sectionCard}>
              <View style={s.relogioRow}>
                <View style={s.relogioField}>
                  <Text style={s.relogioLabel}>Anterior</Text>
                  <View style={s.relogioDisplay}>
                    <Text style={s.relogioValue}>{formatarNumero(relogioAnterior)}</Text>
                  </View>
                </View>
                <View style={{ paddingTop: 20 }}><Ionicons name="arrow-forward" size={20} color="#94A3B8" /></View>
                <View style={s.relogioField}>
                  <Text style={s.relogioLabel}>Atual *</Text>
                  <TextInput
                    style={[s.relogioInput, validacao && !validacao.valida && s.inputError]}
                    placeholder="0" placeholderTextColor="#CBD5E1"
                    value={relogioAtual}
                    onChangeText={v => setRelogioAtual(masks.relogio(v))}
                    keyboardType="numeric" maxLength={10}
                  />
                </View>
              </View>
              {calculo && (
                <View style={s.fichasRow}>
                  <Text style={s.fichasLabel}>Fichas rodadas</Text>
                  <Text style={s.fichasValue}>{formatarNumero(calculo.fichasRodadas)}</Text>
                </View>
              )}
              {validacao?.erros?.map((e: string, i: number) => (
                <View key={i} style={s.erroRow}>
                  <Ionicons name="close-circle" size={16} color="#DC2626" />
                  <Text style={s.erroText}>{e}</Text>
                </View>
              ))}
              {validacao?.avisos?.map((a: string, i: number) => (
                <View key={i} style={s.avisoRow}>
                  <Ionicons name="information-circle" size={16} color="#EA580C" />
                  <Text style={s.avisoText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* descontos */}
          <View style={s.section}><Text style={s.sectionTitle}>Descontos</Text>
            <View style={s.sectionCard}>
              <View style={s.descontosRow}>
                <View style={s.descontoField}>
                  <Text style={s.inputLabel}>Partidas grátis (qtd)</Text>
                  <TextInput style={s.descontoInput} placeholder="0" placeholderTextColor="#CBD5E1"
                    value={descontoPartidas} onChangeText={v => setDescontoPartidas(masks.number(v))}
                    keyboardType="numeric" />
                  {calculo && calculo.descontoPartidasValor > 0 && (
                    <Text style={s.descontoValorText}>= {formatarMoeda(calculo.descontoPartidasValor)}</Text>
                  )}
                </View>
                <View style={s.descontoField}>
                  <Text style={s.inputLabel}>Desconto em R$</Text>
                  <TextInput style={s.descontoInput} placeholder="0,00" placeholderTextColor="#CBD5E1"
                    value={descontoDinheiro} onChangeText={setDescontoDinheiro} keyboardType="numeric" />
                </View>
              </View>
            </View>
          </View>

          {/* resumo rápido */}
          {calculo && (
            <View style={s.section}><Text style={s.sectionTitle}>Resumo</Text>
              <View style={s.sectionCard}>
                <View style={s.resumoLinha}>
                  <Text style={s.resumoLabel}>Total Bruto</Text>
                  <Text style={s.resumoValor}>{formatarMoeda(calculo.totalBruto)}</Text>
                </View>
                {calculo.descontoPartidasValor > 0 && (
                  <View style={s.resumoLinha}>
                    <Text style={s.resumoLabel}>– Desc. Partidas</Text>
                    <Text style={[s.resumoValor, { color: '#DC2626' }]}>– {formatarMoeda(calculo.descontoPartidasValor)}</Text>
                  </View>
                )}
                {calculo.descontoDinheiroValor > 0 && (
                  <View style={s.resumoLinha}>
                    <Text style={s.resumoLabel}>– Desc. Dinheiro</Text>
                    <Text style={[s.resumoValor, { color: '#DC2626' }]}>– {formatarMoeda(calculo.descontoDinheiroValor)}</Text>
                  </View>
                )}
                <View style={s.resumoLinha}>
                  <Text style={s.resumoLabel}>{labelPercentual} ({loc?.percentualEmpresa || 50}%)</Text>
                  <Text style={s.resumoValor}>{formatarMoeda(calculo.valorPercentual)}</Text>
                </View>
                <View style={s.divider} />
                <View style={[s.resumoLinha, s.resumoTotal]}>
                  <Text style={s.resumoTotalLabel}>Total a Pagar</Text>
                  <Text style={s.resumoTotalValor}>{formatarMoeda(calculo.totalClientePaga)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* valor recebido */}
          <View style={s.section}><Text style={s.sectionTitle}>Pagamento</Text>
            <View style={s.sectionCard}>
              <Text style={s.inputLabel}>Valor Recebido</Text>
              <TextInput style={s.valorInput} placeholder="0,00" placeholderTextColor="#CBD5E1"
                value={valorRecebido} onChangeText={setValorRecebido} keyboardType="numeric" />
              {calculo && valorRecebido !== '' && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  {troco > 0 && (
                    <View style={s.trocoRow}>
                      <Ionicons name="return-down-back" size={18} color="#16A34A" />
                      <Text style={s.trocoText}>Troco: {formatarMoeda(troco)}</Text>
                    </View>
                  )}
                  {saldoDevedor > 0 && (
                    <View style={s.saldoRow}>
                      <Ionicons name="alert-circle" size={18} color="#DC2626" />
                      <Text style={s.saldoText}>Saldo devedor: {formatarMoeda(saldoDevedor)}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* manutenção */}
          <View style={s.section}><Text style={s.sectionTitle}>Manutenção</Text>
            <View style={s.sectionCard}>
              <TouchableOpacity
                style={s.checkRow}
                onPress={() => setTrocaPano(v => !v)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, trocaPano && s.checkboxOn]}>
                  {trocaPano && <Ionicons name="checkmark" size={13} color="#FFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.checkLabel}>Troca de pano / manutenção</Text>
                  <Text style={s.checkDesc}>Registra no histórico de manutenções do produto</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* observação */}
          <View style={s.section}><Text style={s.sectionTitle}>Observação</Text>
            <View style={s.sectionCard}>
              <TextInput style={s.observacaoInput} placeholder="Observação (opcional)..."
                placeholderTextColor="#CBD5E1" value={observacao} onChangeText={setObservacao}
                multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* botão avancar */}
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.btnAvancar, (!calculo || !validacao?.valida) && s.btnDisabled]}
            onPress={handleAvancar}
            disabled={!calculo || !validacao?.valida}
            activeOpacity={0.85}
          >
            <Text style={s.btnAvancarText}>
              {calculo ? `Ver Resumo · ${formatarMoeda(calculo.totalClientePaga)}` : 'Preencha os dados'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── estilos ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F8FAFC' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText:    { color: '#64748B', fontSize: 15 },
  scroll:         { flex: 1 },
  scrollContent:  { padding: 16, paddingBottom: 110 },
  headerCard:     { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 20 },
  clienteNome:    { fontSize: 18, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  produtoInfo:    { fontSize: 13, color: '#94A3B8', marginBottom: 2 },
  pagamentoInfo:  { fontSize: 12, color: '#64748B' },
  section:        { marginBottom: 16 },
  sectionTitle:   { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  sectionCard:    { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 1 },
  // relógio passo 1
  relogioRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  relogioField:  { flex: 1 },
  relogioLabel:  { fontSize: 11, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  relogioDisplay:{ backgroundColor: '#F1F5F9', borderRadius: 10, padding: 12, alignItems: 'center' },
  relogioValue:  { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  relogioInput:  { fontSize: 22, fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, textAlign: 'center', borderWidth: 2, borderColor: '#BFDBFE' },
  inputError:    { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626' },
  fichasRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12 },
  fichasLabel:   { fontSize: 13, color: '#64748B', fontWeight: '500' },
  fichasValue:   { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  erroRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8 },
  erroText:      { flex: 1, fontSize: 12, color: '#DC2626' },
  avisoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 8 },
  avisoText:     { flex: 1, fontSize: 12, color: '#EA580C' },
  // descontos
  descontosRow:     { flexDirection: 'row', gap: 12 },
  descontoField:    { flex: 1 },
  inputLabel:       { fontSize: 11, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  descontoInput:    { fontSize: 18, fontWeight: '700', color: '#1E293B', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', paddingBottom: 8 },
  descontoValorText:{ fontSize: 11, color: '#64748B', marginTop: 4 },
  // resumo rápido
  resumoLinha:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  resumoLabel:      { fontSize: 14, color: '#64748B' },
  resumoValor:      { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  divider:          { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  resumoTotal:      { paddingTop: 8 },
  resumoTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  resumoTotalValor: { fontSize: 22, fontWeight: '800', color: '#2563EB' },
  // pagamento
  valorInput:    { fontSize: 28, fontWeight: '800', color: '#1E293B', borderBottomWidth: 2, borderBottomColor: '#2563EB', paddingBottom: 8 },
  trocoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F0FDF4', borderRadius: 10 },
  trocoText:     { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  saldoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 10 },
  saldoText:     { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  observacaoInput:{ fontSize: 15, color: '#1E293B', minHeight: 72 },
  // relógio resumo passo 2
  relogioResumoRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  relogioBox:      { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  relogioBoxLabel: { fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  relogioBoxValue: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  // tabela resumo passo 2
  tRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tLabel:{ fontSize: 13, color: '#64748B', flex: 1 },
  tValue:{ fontSize: 14, fontWeight: '600', color: '#1E293B', textAlign: 'right' },
  pagoExato:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#F0FDF4', borderRadius: 10, marginTop: 8 },
  pagoExatoText:{ fontSize: 14, fontWeight: '600', color: '#16A34A' },
  // bottom bar
  bottomBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  bottomRow:  { flexDirection: 'row', gap: 12 },
  btnAvancar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', padding: 16, borderRadius: 14, gap: 10 },
  btnAvancarText:{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  btnVoltar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', padding: 16, borderRadius: 14, gap: 8, minWidth: 110 },
  btnVoltarText:{ fontSize: 15, fontWeight: '600', color: '#64748B' },
  btnConfirmar:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A34A', padding: 16, borderRadius: 14, gap: 10 },
  btnConfirmarText:{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { backgroundColor: '#BFDBFE' },
  checkRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxOn:   { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkLabel:   { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  checkDesc:    { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});
