/**
 * CobrancaConfirmScreen.tsx
 * Tela de confirmação de cobrança - FLUXO PRINCIPAL
 * 
 * Funcionalidades:
 * - Leitura do relógio atual
 * - Cálculo automático de valores
 * - Desconto em partidas e dinheiro
 * - Aplicação de percentual
 * - Confirmação de pagamento
 * - Registro de saldo devedor
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useLocacao } from '../contexts/LocacaoContext';
import { useCobranca } from '../contexts/CobrancaContext';
import { useAuth } from '../contexts/AuthContext';

// Types
import { Locacao, HistoricoCobranca } from '../types';
import { CobrancasStackParamList } from '../navigation/CobrancasStack';

// Services
import { cobrancaService } from '../services/CobrancaService';

// Utils
import { formatarMoeda, formatarNumero } from '../utils/currency';
import { masks } from '../utils/masks';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================
type CobrancaConfirmRouteProp = RouteProp<CobrancasStackParamList, 'CobrancaConfirm'>;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CobrancaConfirmScreen() {
  const route = useRoute<CobrancaConfirmRouteProp>();
  const navigation = useNavigation();
  const { locacaoSelecionada, carregarLocacoesPorCliente } = useLocacao();
  const { registrarCobranca, carregando } = useCobranca();
  const { user } = useAuth();

  const { locacaoId, cobrancaId, modo } = route.params;

  // Estado de cálculo
  const [relogioAnterior, setRelogioAnterior] = useState<number>(0);
  const [relogioAtual, setRelogioAtual] = useState<string>('');
  const [descontoPartidas, setDescontoPartidas] = useState<string>('');
  const [descontoDinheiro, setDescontoDinheiro] = useState<string>('');
  const [valorRecebido, setValorRecebido] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');

  // Estado de cálculo (resultado)
  const [calculo, setCalculo] = useState<any>(null);
  const [validacao, setValidacao] = useState<any>(null);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useEffect(() => {
    // Carregar dados da locação
    // Em produção, buscaria do repositório
    // Aqui simulamos com dados mock
    carregarLocacaoMock();
  }, [locacaoId]);

  const carregarLocacaoMock = useCallback(() => {
    // Mock de dados - em produção viria do repositório
    const locacaoMock: Partial<Locacao> = {
      id: locacaoId,
      numeroRelogio: '64000',
      precoFicha: 3.00,
      percentualEmpresa: 50,
      clienteNome: 'Cliente Exemplo',
      produtoIdentificador: '170',
      produtoTipo: 'Bilhar',
    };
    setRelogioAnterior(parseInt(locacaoMock.numeroRelogio || '0', 10));
  }, [locacaoId]);

  // ==========================================================================
  // CÁLCULOS
  // ==========================================================================

  useEffect(() => {
    if (!relogioAtual) {
      setCalculo(null);
      return;
    }

    const relogioAtualNum = parseInt(relogioAtual.replace(/\D/g, ''), 10);
    
    if (isNaN(relogioAtualNum) || relogioAtualNum < relogioAnterior) {
      setValidacao({
        valida: false,
        erros: ['Relógio atual não pode ser menor que o anterior'],
        avisos: [],
      });
      setCalculo(null);
      return;
    }

    const descontoPartidasNum = parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0;
    const descontoDinheiroStr = descontoDinheiro.replace(',', '.');
    const descontoDinheiroNum = parseFloat(descontoDinheiroStr) || 0;

    // Usar o serviço de cálculo
    const input = {
      relogioAnterior,
      relogioAtual: relogioAtualNum,
      valorFicha: 3.00, // Em produção viria da locação
      percentualEmpresa: 50, // Em produção viria da locação
      descontoPartidasQtd: descontoPartidasNum,
      descontoDinheiro: descontoDinheiroNum,
      formaPagamento: 'PercentualReceber' as const,
    };

    const resultado = cobrancaService.calcularCobranca(input);
    const validacaoResultado = cobrancaService.validarCobranca(input);

    setCalculo(resultado);
    setValidacao(validacaoResultado);
  }, [relogioAtual, relogioAnterior, descontoPartidas, descontoDinheiro]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleConfirmar = useCallback(async () => {
    if (!calculo || !validacao?.valida) {
      Alert.alert('Erro', 'Por favor, verifique os dados da cobrança');
      return;
    }

    const valorRecebidoNum = parseFloat(valorRecebido.replace(',', '.')) || 0;

    if (valorRecebidoNum < 0) {
      Alert.alert('Erro', 'Valor recebido não pode ser negativo');
      return;
    }

    try {
      // Preparar dados para salvar
      const dadosCobranca = {
        locacaoId,
        clienteId: 'cliente_mock', // Em produção viria da locação
        clienteNome: 'Cliente Exemplo',
        produtoIdentificador: '170',
        dataInicio: new Date().toISOString(),
        dataFim: new Date().toISOString(),
        relogioAnterior,
        relogioAtual: parseInt(relogioAtual.replace(/\D/g, ''), 10),
        fichasRodadas: calculo.fichasRodadas,
        valorFicha: 3.00,
        totalBruto: calculo.totalBruto,
        descontoPartidasQtd: parseInt(descontoPartidas.replace(/\D/g, ''), 10) || 0,
        descontoPartidasValor: calculo.descontoPartidasValor,
        descontoDinheiro: calculo.descontoDinheiroValor,
        percentualEmpresa: 50,
        subtotalAposDescontos: calculo.subtotalAposDescontoDinheiro,
        valorPercentual: calculo.valorPercentual,
        totalClientePaga: calculo.totalClientePaga,
        valorRecebido: valorRecebidoNum,
        observacao,
      };

      const cobranca = await registrarCobranca(dadosCobranca);

      if (cobranca) {
        Alert.alert(
          'Sucesso',
          `Cobrança registrada!\nTotal: ${formatarMoeda(calculo.totalClientePaga)}\nRecebido: ${formatarMoeda(valorRecebidoNum)}`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },          ]
        );
      } else {
        Alert.alert('Erro', 'Não foi possível registrar a cobrança');
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao registrar cobrança');
    }
  }, [calculo, validacao, valorRecebido, locacaoId, relogioAnterior, relogioAtual, descontoPartidas, observacao, registrarCobranca, navigation]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================================================== */}
          {/* HEADER */}
          {/* ========================================================================== */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Confirmar Cobrança</Text>
              <Text style={styles.headerSubtitle}>
                {modo === 'nova' ? 'Nova cobrança' : modo === 'parcial' ? 'Pagamento parcial' : 'Editar cobrança'}
              </Text>
            </View>
            <View style={styles.headerStatus}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={[styles.statusBadge, styles.statusPendente]}>
                <Text style={styles.statusText}>Pendente</Text>
              </View>
            </View>
          </View>

          {/* ========================================================================== */}
          {/* LEITURA DO RELÓGIO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leitura do Relógio</Text>
            <View style={styles.sectionCard}>
              <View style={styles.relogioRow}>                <View style={styles.relogioField}>
                  <Text style={styles.relogioLabel}>Relógio Anterior</Text>
                  <Text style={styles.relogioValue}>{formatarNumero(relogioAnterior)}</Text>
                </View>
                <View style={styles.relogioField}>
                  <Text style={styles.relogioLabel}>Relógio Atual *</Text>
                  <TextInput
                    style={[styles.relogioInput, !validacao?.valida && styles.inputError]}
                    placeholder="00000"
                    placeholderTextColor="#94A3B8"
                    value={relogioAtual}
                    onChangeText={(value) => setRelogioAtual(masks.relogio(value))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {calculo && (
                <View style={styles.calculoRow}>
                  <Text style={styles.calculoLabel}>Fichas Rodadas</Text>
                  <Text style={styles.calculoValue}>{formatarNumero(calculo.fichasRodadas)}</Text>
                </View>
              )}

              {validacao?.erros?.map((erro: string, index: number) => (
                <View key={index} style={styles.errorRow}>
                  <Ionicons name="warning" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{erro}</Text>
                </View>
              ))}

              {validacao?.avisos?.map((aviso: string, index: number) => (
                <View key={index} style={styles.warningRow}>
                  <Ionicons name="information-circle" size={16} color="#EA580C" />
                  <Text style={styles.warningText}>{aviso}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ========================================================================== */}
          {/* DESCONTOS */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descontos</Text>
            <View style={styles.sectionCard}>
              <View style={styles.inputRow}>
                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Desconto em Partidas</Text>
                  <TextInput                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    value={descontoPartidas}
                    onChangeText={(value) => setDescontoPartidas(masks.number(value))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Desconto em Dinheiro</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="R$ 0,00"
                    placeholderTextColor="#94A3B8"
                    value={descontoDinheiro}
                    onChangeText={(value) => setDescontoDinheiro(value)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {calculo && calculo.descontoPartidasValor > 0 && (
                <View style={styles.calculoRow}>
                  <Text style={styles.calculoLabel}>Valor Desconto Partidas</Text>
                  <Text style={styles.calculoValue}>{formatarMoeda(calculo.descontoPartidasValor)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ========================================================================== */}
          {/* RESUMO DE VALORES */}
          {/* ========================================================================== */}
          {calculo && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resumo de Valores</Text>
              <View style={styles.sectionCard}>
                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Total Bruto</Text>
                  <Text style={styles.resumoValue}>{formatarMoeda(calculo.totalBruto)}</Text>
                </View>

                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Subtotal (após descontos)</Text>
                  <Text style={styles.resumoValue}>{formatarMoeda(calculo.subtotalAposDescontoDinheiro)}</Text>
                </View>

                <View style={styles.resumoRow}>
                  <Text style={styles.resumoLabel}>Percentual Empresa (50%)</Text>
                  <Text style={styles.resumoValue}>{formatarMoeda(calculo.valorPercentual)}</Text>                </View>

                <View style={[styles.resumoRow, styles.resumoTotal]}>
                  <Text style={styles.resumoTotalLabel}>Total a Pagar</Text>
                  <Text style={styles.resumoTotalValue}>{formatarMoeda(calculo.totalClientePaga)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ========================================================================== */}
          {/* PAGAMENTO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pagamento</Text>
            <View style={styles.sectionCard}>
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Valor Recebido *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="R$ 0,00"
                  placeholderTextColor="#94A3B8"
                  value={valorRecebido}
                  onChangeText={(value) => setValorRecebido(value)}
                  keyboardType="numeric"
                />
              </View>

              {calculo && valorRecebido && (
                <>
                  <View style={styles.calculoRow}>
                    <Text style={styles.calculoLabel}>Troco</Text>
                    <Text style={[styles.calculoValue, { color: '#16A34A' }]}>
                      {formatarMoeda(Math.max(0, parseFloat(valorRecebido.replace(',', '.')) || 0 - calculo.totalClientePaga))}
                    </Text>
                  </View>

                  {calculo.totalClientePaga > (parseFloat(valorRecebido.replace(',', '.')) || 0) && (
                    <View style={styles.saldoDevedorRow}>
                      <Ionicons name="alert-circle" size={20} color="#DC2626" />
                      <Text style={styles.saldoDevedorText}>
                        Saldo devedor: {formatarMoeda(calculo.totalClientePaga - (parseFloat(valorRecebido.replace(',', '.')) || 0))}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
          {/* ========================================================================== */}
          {/* OBSERVAÇÃO */}
          {/* ========================================================================== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observação (opcional)</Text>
            <View style={styles.sectionCard}>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Adicione uma observação..."
                placeholderTextColor="#94A3B8"
                value={observacao}
                onChangeText={setObservacao}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Espaço extra */}
          <View style={styles.footer} />
        </ScrollView>

        {/* ========================================================================== */}
        {/* BOTÃO CONFIRMAR */}
        {/* ========================================================================== */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!calculo || !validacao?.valida || carregando) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirmar}
            disabled={!calculo || !validacao?.valida || carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Confirmar Cobrança</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  headerStatus: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,    borderRadius: 12,
  },
  statusPendente: {
    backgroundColor: '#FFFBEB',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EA580C',
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Relógio
  relogioRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  relogioField: {
    flex: 1,
  },
  relogioLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  relogioValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',  },
  relogioInput: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },

  // Cálculos
  calculoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calculoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  calculoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    color: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  inputMultiline: {    minHeight: 80,
    textAlignVertical: 'top',
    borderBottomWidth: 0,
  },
  inputError: {
    borderBottomColor: '#DC2626',
  },

  // Erros e Avisos
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#EA580C',
  },

  // Resumo
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  resumoLabel: {
    fontSize: 13,
    color: '#64748B',  },
  resumoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  resumoTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
    marginTop: 8,
  },
  resumoTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  resumoTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
  },

  // Saldo Devedor
  saldoDevedorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },
  saldoDevedorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },

  // Footer
  footer: {
    height: 20,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});