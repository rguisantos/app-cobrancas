/**
 * LocacaoFormScreen.tsx
 * Formulário de locação — modos: criar | editar | relocar
 *
 * Modo CRIAR:
 *   - Produto selecionável (disponíveis em estoque)
 *   - Cliente fixo (vem da tela anterior)
 *   - Preencher regras de negócio
 *
 * Modo RELOCAR:
 *   - Produto fixo (somente leitura, carregado da locação existente)
 *   - Busca e seleção de NOVO cliente
 *   - Preencher novas regras de negócio
 *   - Chama realizarRelocacao() que finaliza a locação antiga e cria nova
 *
 * Modo EDITAR:
 *   - Produto fixo, cliente fixo
 *   - Edita regras de negócio da locação existente
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocacao }  from '../contexts/LocacaoContext';
import { useProduto }  from '../contexts/ProdutoContext';
import { useCliente }  from '../contexts/ClienteContext';
import { produtoRepository } from '../repositories/ProdutoRepository';

import { Locacao, FormaPagamentoLocacao } from '../types';
import { locacaoRepository }    from '../repositories/LocacaoRepository';
import { ClientesStackParamList } from '../navigation/ClientesStack';
import { masks }       from '../utils/masks';

type LocacaoFormRouteProp = RouteProp<ClientesStackParamList, 'LocacaoForm'>;

// ─── constantes ─────────────────────────────────────────────────────────────
const PERIODICIDADES = ['Mensal', 'Semanal', 'Quinzenal', 'Diária'];

const FORMA_OPTS = [
  { value: 'PercentualReceber', label: '% Receber', icon: 'trending-up'   },
  { value: 'PercentualPagar',  label: '% Pagar',   icon: 'trending-down'  },
  { value: 'Periodo',          label: 'Período',   icon: 'calendar'       },
] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  return msg ? <Text style={s.fieldError}>{msg}</Text> : null;
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {text}{required && <Text style={{ color: '#DC2626' }}> *</Text>}
    </Text>
  );
}

// ─── componente principal ────────────────────────────────────────────────────
export default function LocacaoFormScreen() {
  const route      = useRoute<LocacaoFormRouteProp>();
  const navigation = useNavigation();

  const { criarLocacao, atualizarLocacao, realizarRelocacao, carregando } = useLocacao();
  const { produtos, carregarProdutos }                                    = useProduto();
  const { clienteSelecionado, buscarCliente }                             = useCliente();

  const { clienteId, produtoId, modo, locacaoId } = route.params;

  // ── estado do formulário ──────────────────────────────────────────────────
  const [form, setForm] = useState<any>({
    // identificação
    clienteId:            clienteId || '',
    clienteNome:          clienteSelecionado?.nomeExibicao || '',
    produtoId:            produtoId || '',
    produtoIdentificador: '',
    produtoTipo:          '',
    // regras de negócio
    formaPagamento:       'PercentualReceber' as FormaPagamentoLocacao,
    numeroRelogio:        '',
    precoFicha:           '',
    percentualEmpresa:    '50',
    periodicidade:        '',
    valorFixo:            '',
    dataPrimeiraCobranca: '',
    motivoRelocacao:      '',
    observacao:           '',
    trocaPano:            false,
  });

  const [errors,           setErrors]           = useState<Record<string, string>>({});
  const [salvando,         setSalvando]         = useState(false);
  const [carregandoInit,   setCarregandoInit]   = useState(modo !== 'criar');

  // modais
  const [showProdutoPicker,  setShowProdutoPicker]  = useState(false);
  const [showClientePicker,  setShowClientePicker]  = useState(false);
  const [buscaCliente,       setBuscaCliente]       = useState('');
  const [resultadosCliente,  setResultadosCliente]  = useState<any[]>([]);
  const [buscandoCliente,    setBuscandoCliente]    = useState(false);

  const buscaDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── carregamento inicial ──────────────────────────────────────────────────
  // Para modo criar: carrega produtos disponíveis
  // Para modo relocar/editar: carrega locação existente e relógio do produto
  useEffect(() => {
    if (modo === 'criar') {
      carregarProdutos({ comLocacaoAtiva: false });
    } else if ((modo === 'relocar' || modo === 'editar') && locacaoId) {
      setCarregandoInit(true);
      locacaoRepository.getById(locacaoId).then(async locacao => {
        if (!locacao) return;
        
        // Buscar o relógio do PRODUTO (não da locação) - é o valor atual do relógio
        let relogioProduto = locacao.numeroRelogio || '';
        if (locacao.produtoId) {
          try {
            const produto = await produtoRepository.getById(String(locacao.produtoId));
            if (produto?.numeroRelogio) {
              relogioProduto = produto.numeroRelogio;
            }
          } catch (e) {
            console.warn('[LocacaoForm] Erro ao buscar produto:', e);
          }
        }
        
        setForm((prev: any) => ({
          ...prev,
          // produto vem da locação (somente leitura em ambos os modos)
          produtoId:            String(locacao.produtoId),
          produtoIdentificador: locacao.produtoIdentificador,
          produtoTipo:          locacao.produtoTipo,
          // em editar, cliente também é somente leitura
          clienteId:            modo === 'editar' ? String(locacao.clienteId) : '',
          clienteNome:          modo === 'editar' ? (locacao.clienteNome || '') : '',
          // regras de negócio da locação atual como pré-preenchimento
          formaPagamento:       locacao.formaPagamento || 'PercentualReceber',
          numeroRelogio:        relogioProduto, // Relógio do PRODUTO (editável)
          precoFicha:           locacao.precoFicha ? String(locacao.precoFicha) : '',
          percentualEmpresa:    locacao.percentualEmpresa ? String(locacao.percentualEmpresa) : '50',
          periodicidade:        locacao.periodicidade || '',
          valorFixo:            locacao.valorFixo ? String(locacao.valorFixo) : '',
          observacao:           locacao.observacao || '',
        }));
      }).catch(() => Alert.alert('Erro', 'Não foi possível carregar a locação'))
        .finally(() => setCarregandoInit(false));
    }
  }, []);

  // atualiza clienteNome quando clienteSelecionado muda (modo criar)
  useEffect(() => {
    if (clienteSelecionado && modo === 'criar') {
      setForm((prev: any) => ({
        ...prev,
        clienteId:   String(clienteSelecionado.id),
        clienteNome: clienteSelecionado.nomeExibicao,
      }));
    }
  }, [clienteSelecionado, modo]);

  // ── busca de cliente (modo relocar) ───────────────────────────────────────
  const handleBuscaCliente = useCallback((termo: string) => {
    setBuscaCliente(termo);
    if (buscaDebounce.current) clearTimeout(buscaDebounce.current);
    if (!termo.trim()) { setResultadosCliente([]); return; }
    buscaDebounce.current = setTimeout(async () => {
      setBuscandoCliente(true);
      try {
        const res = await buscarCliente(termo);
        setResultadosCliente(res);
      } finally {
        setBuscandoCliente(false);
      }
    }, 400);
  }, [buscarCliente]);

  const handleSelecionarCliente = useCallback((cliente: any) => {
    setForm((prev: any) => ({
      ...prev,
      clienteId:   String(cliente.id),
      clienteNome: cliente.nomeExibicao,
    }));
    setShowClientePicker(false);
    setBuscaCliente('');
    setResultadosCliente([]);
    clearError('clienteId');
  }, []);

  // ── seleção de produto ────────────────────────────────────────────────────
  const handleSelecionarProduto = useCallback((produto: any) => {
    setForm((prev: any) => ({
      ...prev,
      produtoId:            String(produto.id),
      produtoIdentificador: produto.identificador,
      produtoTipo:          produto.tipoNome,
      // Pre-fill relógio from produto (editable by user)
      numeroRelogio:        produto.numeroRelogio ? String(produto.numeroRelogio) : prev.numeroRelogio,
    }));
    setShowProdutoPicker(false);
    clearError('produtoId');
    clearError('numeroRelogio');
  }, []);

  // ── helpers de input ──────────────────────────────────────────────────────
  const setField = (field: string, value: string) => {
    setForm((prev: any) => {
      const next: any = { ...prev, [field]: value };
      // percentual cliente = 100 - empresa
      if (field === 'percentualEmpresa') {
        // keep in sync visually (calculated on submit)
      }
      return next;
    });
    clearError(field);
  };

  const clearError = (field: string) =>
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });

  const percentualCliente = Math.max(0, 100 - (parseFloat(form.percentualEmpresa) || 0));

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    // Validate with current form state (inline to avoid stale closure)
    const e: Record<string, string> = {};
    if (!form.produtoId)     e.produtoId    = 'Produto é obrigatório';
    if (!form.clienteId)     e.clienteId    = 'Cliente é obrigatório';
    if (!form.numeroRelogio) e.numeroRelogio = 'Relógio é obrigatório';
    if (form.formaPagamento !== 'Periodo') {
      if (!form.precoFicha || parseFloat(form.precoFicha) <= 0)
        e.precoFicha = 'Preço da ficha deve ser maior que zero';
      const pct = parseFloat(form.percentualEmpresa);
      if (isNaN(pct) || pct < 0 || pct > 100)
        e.percentualEmpresa = 'Percentual entre 0 e 100';
    } else {
      if (!form.valorFixo || parseFloat(form.valorFixo) <= 0)
        e.valorFixo = 'Valor fixo deve ser maior que zero';
      if (!form.periodicidade)
        e.periodicidade = 'Periodicidade é obrigatória';
    }
    if (modo === 'relocar' && !form.motivoRelocacao.trim())
      e.motivoRelocacao = 'Informe o motivo da relocação';
    if (Object.keys(e).length > 0) {
      setErrors(e);
      Alert.alert('Atenção', 'Corrija os campos obrigatórios');
      return;
    }

    setSalvando(true);
    try {
      if (modo === 'criar') {
        const locacao = await criarLocacao({
          clienteId:            form.clienteId,
          clienteNome:          form.clienteNome,
          produtoId:            form.produtoId,
          produtoIdentificador: form.produtoIdentificador,
          produtoTipo:          form.produtoTipo,
          dataLocacao:          new Date().toISOString(),
          formaPagamento:       form.formaPagamento,
          numeroRelogio:        form.numeroRelogio,
          precoFicha:           parseFloat(form.precoFicha) || 0,
          percentualEmpresa:    parseFloat(form.percentualEmpresa) || 50,
          percentualCliente,
          periodicidade:        form.periodicidade as any || undefined,
          valorFixo:            form.valorFixo ? parseFloat(form.valorFixo) : undefined,
          dataPrimeiraCobranca: form.dataPrimeiraCobranca || undefined,
          observacao:           form.observacao || undefined,
          status:               'Ativa',
          trocaPano:            form.trocaPano || false,
          dataUltimaManutencao: form.trocaPano ? new Date().toISOString() : undefined,
        } as any);

        if (locacao) {
          Alert.alert('Sucesso', 'Locação criada com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível criar a locação');
        }

      } else if (modo === 'editar') {
        const ok = await atualizarLocacao({
          id:                locacaoId!,
          formaPagamento:    form.formaPagamento,
          numeroRelogio:     form.numeroRelogio,
          precoFicha:        parseFloat(form.precoFicha) || 0,
          percentualEmpresa: parseFloat(form.percentualEmpresa) || 50,
          percentualCliente,
          periodicidade:     form.periodicidade as any || undefined,
          valorFixo:         form.valorFixo ? parseFloat(form.valorFixo) : undefined,
          observacao:        form.observacao || undefined,
        } as any);

        if (ok) {
          Alert.alert('Sucesso', 'Locação atualizada com sucesso', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Erro', 'Não foi possível atualizar a locação');
        }

      } else if (modo === 'relocar') {
        const ok = await realizarRelocacao({
          produtoId:            form.produtoId,
          produtoIdentificador: form.produtoIdentificador,
          novoClienteId:        form.clienteId,
          novoClienteNome:      form.clienteNome,
          dataRelocacao:        new Date().toISOString(),
          formaPagamento:       form.formaPagamento,
          numeroRelogio:        form.numeroRelogio,
          precoFicha:           parseFloat(form.precoFicha) || 0,
          percentualEmpresa:    parseFloat(form.percentualEmpresa) || 50,
          percentualCliente,
          periodicidade:        form.periodicidade || undefined,
          valorFixo:            form.valorFixo ? parseFloat(form.valorFixo) : undefined,
          dataPrimeiraCobranca: form.dataPrimeiraCobranca || undefined,
          motivoRelocacao:      form.motivoRelocacao,
          observacao:           form.observacao || undefined,
        });
        // trocaPano handled separately via produtoRepository in realizarRelocacao

        if (ok) {
          Alert.alert(
            'Relocação Realizada!',
            `Produto ${form.produtoIdentificador} relocado para ${form.clienteNome}`,
            [{ text: 'OK', onPress: () => { navigation.goBack(); navigation.goBack(); } }]
          );
        } else {
          Alert.alert('Erro', 'Não foi possível realizar a relocação');
        }
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }, [form, modo, locacaoId, percentualCliente, criarLocacao, atualizarLocacao, realizarRelocacao, navigation, setErrors]);

  // ── loading inicial ───────────────────────────────────────────────────────
  if (carregandoInit) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Carregando...</Text>
      </View>
    );
  }

  const isRelocar = modo === 'relocar';
  const tituloBtn = isRelocar ? 'Confirmar Relocação' : modo === 'criar' ? 'Criar Locação' : 'Salvar Alterações';

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ── PRODUTO ─────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Produto</Text>
            <View style={s.card}>
              {/* Em relocar/editar o produto é somente leitura */}
              {isRelocar || modo === 'editar' ? (
                <View style={s.infoBox}>
                  <View style={s.infoBoxIcon}>
                    <Ionicons name="cube" size={22} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={s.infoBoxPrimary}>
                      {form.produtoTipo} N° {form.produtoIdentificador}
                    </Text>
                    <Text style={s.infoBoxSub}>Produto fixo — não pode ser alterado</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Label text="Produto" required />
                  <TouchableOpacity
                    style={[s.selector, errors.produtoId && s.selectorError]}
                    onPress={() => setShowProdutoPicker(true)}
                  >
                    <Text style={form.produtoId ? s.selectorValue : s.selectorPlaceholder}>
                      {form.produtoId
                        ? `${form.produtoTipo} N° ${form.produtoIdentificador}`
                        : 'Selecionar produto disponível'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                  <FieldError msg={errors.produtoId} />
                </>
              )}
            </View>
          </View>

          {/* ── CLIENTE ─────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {isRelocar ? 'Novo Cliente' : 'Cliente'}
            </Text>
            <View style={s.card}>
              {!isRelocar ? (
                <View style={s.infoBox}>
                  <View style={s.infoBoxIcon}>
                    <Ionicons name="person" size={22} color="#16A34A" />
                  </View>
                  <View>
                    <Text style={s.infoBoxPrimary}>{form.clienteNome || '—'}</Text>
                    <Text style={s.infoBoxSub}>Cliente fixo</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Label text="Selecionar novo cliente" required />
                  <TouchableOpacity
                    style={[s.selector, errors.clienteId && s.selectorError]}
                    onPress={() => setShowClientePicker(true)}
                  >
                    <Text style={form.clienteId ? s.selectorValue : s.selectorPlaceholder}>
                      {form.clienteId ? form.clienteNome : 'Buscar cliente...'}
                    </Text>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                  <FieldError msg={errors.clienteId} />
                </>
              )}
            </View>
          </View>

          {/* ── FORMA DE PAGAMENTO ──────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Forma de Pagamento</Text>
            <View style={s.card}>
              {/* Seletor visual */}
              <View style={s.formaBtns}>
                {FORMA_OPTS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.formaBtn, form.formaPagamento === opt.value && s.formaBtnActive]}
                    onPress={() => setField('formaPagamento', opt.value)}
                  >
                    <Ionicons
                      name={opt.icon as any} size={18}
                      color={form.formaPagamento === opt.value ? '#FFF' : '#64748B'}
                    />
                    <Text style={[s.formaBtnText, form.formaPagamento === opt.value && s.formaBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Relógio sempre visível */}
              <Label text="Número do Relógio" required />
              <TextInput
                style={[s.input, errors.numeroRelogio && s.inputError]}
                placeholder="00000"
                placeholderTextColor="#CBD5E1"
                value={form.numeroRelogio}
                onChangeText={v => setField('numeroRelogio', masks.relogio(v))}
                keyboardType="numeric"
              />
              <FieldError msg={errors.numeroRelogio} />

              {form.formaPagamento !== 'Periodo' ? (<>
                <Label text="Preço da Ficha (R$)" required />
                <TextInput
                  style={[s.input, errors.precoFicha && s.inputError]}
                  placeholder="3,00"
                  placeholderTextColor="#CBD5E1"
                  value={form.precoFicha}
                  onChangeText={v => setField('precoFicha', v)}
                  keyboardType="numeric"
                />
                <FieldError msg={errors.precoFicha} />

                <Label text="% Empresa" required />
                <TextInput
                  style={[s.input, errors.percentualEmpresa && s.inputError]}
                  placeholder="50"
                  placeholderTextColor="#CBD5E1"
                  value={form.percentualEmpresa}
                  onChangeText={v => setField('percentualEmpresa', v)}
                  keyboardType="numeric"
                />
                <FieldError msg={errors.percentualEmpresa} />

                <View style={s.percentualClienteRow}>
                  <Text style={s.percentualClienteLabel}>% Cliente (automático)</Text>
                  <Text style={s.percentualClienteValue}>{percentualCliente}%</Text>
                </View>
              </>) : (<>
                <Label text="Periodicidade" required />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}>
                  {PERIODICIDADES.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[s.chip, form.periodicidade === p && s.chipActive]}
                      onPress={() => setField('periodicidade', p)}
                    >
                      <Text style={[s.chipText, form.periodicidade === p && s.chipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <FieldError msg={errors.periodicidade} />

                <Label text="Valor Fixo (R$)" required />
                <TextInput
                  style={[s.input, errors.valorFixo && s.inputError]}
                  placeholder="150,00"
                  placeholderTextColor="#CBD5E1"
                  value={form.valorFixo}
                  onChangeText={v => setField('valorFixo', v)}
                  keyboardType="numeric"
                />
                <FieldError msg={errors.valorFixo} />

                <Label text="Data Primeira Cobrança" />
                <TextInput
                  style={s.input}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#CBD5E1"
                  value={form.dataPrimeiraCobranca}
                  onChangeText={v => setField('dataPrimeiraCobranca', masks.date(v))}
                  keyboardType="numeric"
                />
              </>)}
            </View>
          </View>

          {/* ── MOTIVO (só modo relocar) ─────────────────────────────── */}
          {isRelocar && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Relocação</Text>
              <View style={s.card}>
                <Label text="Motivo da relocação" required />
                <TextInput
                  style={[s.input, errors.motivoRelocacao && s.inputError]}
                  placeholder="Ex: Solicitação do cliente, problema técnico..."
                  placeholderTextColor="#CBD5E1"
                  value={form.motivoRelocacao}
                  onChangeText={v => setField('motivoRelocacao', v)}
                />
                <FieldError msg={errors.motivoRelocacao} />
              </View>
            </View>
          )}

          {/* ── MANUTENÇÃO / TROCA DE PANO ──────────────────────────── */}
          {(modo === 'criar' || modo === 'editar' || modo === 'relocar') && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Manutenção</Text>
              <View style={s.card}>
                <TouchableOpacity
                  style={s.checkboxRow}
                  onPress={() => setForm((p: any) => ({ ...p, trocaPano: !p.trocaPano }))}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, form.trocaPano && s.checkboxChecked]}>
                    {form.trocaPano && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.checkboxLabel}>Troca de pano realizada</Text>
                    <Text style={s.checkboxDesc}>Registra a data atual como última manutenção do produto</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── OBSERVAÇÃO ──────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Observação</Text>
            <View style={s.card}>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Observação opcional..."
                placeholderTextColor="#CBD5E1"
                value={form.observacao}
                onChangeText={v => setField('observacao', v)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── BOTÃO CONFIRMAR ──────────────────────────────────────── */}
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.btnConfirm, (salvando || carregando) && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={salvando || carregando}
            activeOpacity={0.85}
          >
            {salvando || carregando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons
                  name={isRelocar ? 'swap-horizontal' : 'checkmark-circle'}
                  size={22} color="#FFF"
                />
                <Text style={s.btnConfirmText}>{tituloBtn}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── MODAL: SELECIONAR PRODUTO ────────────────────────────────── */}
      <Modal visible={showProdutoPicker} animationType="slide" transparent onRequestClose={() => setShowProdutoPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Produto Disponível</Text>
              <TouchableOpacity onPress={() => setShowProdutoPicker(false)}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={produtos}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={() => (
                <View style={s.modalEmpty}>
                  <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
                  <Text style={s.modalEmptyText}>Nenhum produto disponível</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.modalItem} onPress={() => handleSelecionarProduto(item)}>
                  <View style={s.modalItemIcon}>
                    <Ionicons name="cube" size={20} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalItemPrimary}>{item.tipoNome} N° {item.identificador}</Text>
                    <Text style={s.modalItemSub}>{item.descricaoNome}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── MODAL: BUSCAR CLIENTE ───────────────────────────────────── */}
      <Modal visible={showClientePicker} animationType="slide" transparent onRequestClose={() => setShowClientePicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Buscar Cliente</Text>
              <TouchableOpacity onPress={() => { setShowClientePicker(false); setBuscaCliente(''); setResultadosCliente([]); }}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>
            {/* Campo de busca */}
            <View style={s.searchBox}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={s.searchInput}
                placeholder="Nome do cliente..."
                placeholderTextColor="#94A3B8"
                value={buscaCliente}
                onChangeText={handleBuscaCliente}
                autoFocus
              />
              {buscandoCliente && <ActivityIndicator size="small" color="#2563EB" />}
            </View>
            <FlatList
              data={resultadosCliente}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={() => (
                <View style={s.modalEmpty}>
                  <Ionicons name="person-outline" size={48} color="#CBD5E1" />
                  <Text style={s.modalEmptyText}>
                    {buscaCliente.length > 0 ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
                  </Text>
                </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.modalItem} onPress={() => handleSelecionarCliente(item)}>
                  <View style={[s.modalItemIcon, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name="person" size={20} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalItemPrimary}>{item.nomeExibicao}</Text>
                    <Text style={s.modalItemSub}>{item.cidade} - {item.estado}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── estilos ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8FAFC' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 15 },
  scroll:      { padding: 16 },

  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  card:         { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, elevation: 1 },

  // info box (somente leitura)
  infoBox:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoBoxIcon:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  infoBoxPrimary:{ fontSize: 15, fontWeight: '700', color: '#1E293B' },
  infoBoxSub:    { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // label
  label:  { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 12 },

  // selector
  selector:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14 },
  selectorError:   { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  selectorValue:   { fontSize: 15, color: '#1E293B', flex: 1 },
  selectorPlaceholder: { fontSize: 15, color: '#94A3B8', flex: 1 },

  // input
  input:         { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1E293B' },
  inputError:    { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  inputMultiline:{ minHeight: 80, textAlignVertical: 'top' },
  fieldError:    { fontSize: 12, color: '#DC2626', marginTop: 4 },

  // forma pagamento
  formaBtns:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
  formaBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  formaBtnActive:    { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  formaBtnText:      { fontSize: 12, fontWeight: '600', color: '#64748B' },
  formaBtnTextActive:{ color: '#FFFFFF' },

  // percentual cliente
  percentualClienteRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: 12, backgroundColor: '#F1F5F9', borderRadius: 10 },
  percentualClienteLabel:{ fontSize: 13, color: '#64748B' },
  percentualClienteValue:{ fontSize: 15, fontWeight: '700', color: '#1E293B' },

  // chips periodicidade
  chips:     { gap: 8, paddingBottom: 4 },
  chip:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive:{ backgroundColor: '#2563EB' },
  chipText:  { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFFFFF' },

  // bottom bar
  bottomBar:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  btnConfirm:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563EB', padding: 16, borderRadius: 14 },
  btnDisabled:  { backgroundColor: '#BFDBFE' },
  btnConfirmText:{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  checkboxRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox:      { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxChecked:{ backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkboxLabel: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  checkboxDesc:  { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  modalEmpty:   { alignItems: 'center', paddingVertical: 40, gap: 8 },
  modalEmptyText:{ fontSize: 15, color: '#94A3B8' },
  modalItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalItemIcon:{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  modalItemPrimary:{ fontSize: 15, fontWeight: '600', color: '#1E293B' },
  modalItemSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:  { flex: 1, fontSize: 15, color: '#1E293B' },
});
