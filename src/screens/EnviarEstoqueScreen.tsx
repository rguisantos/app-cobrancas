/**
 * EnviarEstoqueScreen.tsx
 * Envia produto para estoque (finaliza locação)
 * ✅ Estabelecimentos carregados do banco (configurável pelo admin)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView }  from 'react-native-safe-area-context';

import { useLocacao }  from '../contexts/LocacaoContext';
import { useProduto }  from '../contexts/ProdutoContext';
import atributosRepository, { AtributoItem } from '../repositories/AtributosRepository';
import { locacaoRepository } from '../repositories/LocacaoRepository';


type RouteType = RouteProp<{ EnviarEstoque: { locacaoId: string; produtoId: string } }, 'EnviarEstoque'>;

export default function EnviarEstoqueScreen() {
  const route      = useRoute<RouteType>();
  const navigation = useNavigation();

  const { finalizarLocacao } = useLocacao();
  const { atualizarProduto } = useProduto();

  const { locacaoId, produtoId } = route.params;

  const [estabelecimentos, setEstabelecimentos] = useState<AtributoItem[]>([]);
  const [locacaoInfo,      setLocacaoInfo]      = useState<{ clienteNome: string; produtoIdentificador: string; produtoTipo: string } | null>(null);
  const [estabelecimento,  setEstabelecimento]  = useState('');
  const [motivo,           setMotivo]           = useState('');
  const [observacao,       setObservacao]       = useState('');
  const [salvando,         setSalvando]         = useState(false);
  const [errors,           setErrors]           = useState<Record<string, string>>({});

  // Carrega estabelecimentos do banco e info da locação
  useEffect(() => {
    atributosRepository.getEstabelecimentos().then(setEstabelecimentos).catch(() => setEstabelecimentos([]));
    locacaoRepository.getById(locacaoId).then(loc => {
      if (loc) setLocacaoInfo({
        clienteNome:          loc.clienteNome,
        produtoIdentificador: loc.produtoIdentificador,
        produtoTipo:          loc.produtoTipo,
      });
    }).catch(() => {});
  }, [locacaoId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!estabelecimento) e.estabelecimento = 'Selecione o destino';
    if (!motivo.trim())   e.motivo = 'Informe o motivo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleConfirmar = useCallback(() => {
    if (!validate()) return;

    const nomeEstab = estabelecimentos.find(e => e.id === estabelecimento)?.nome ?? '';

    Alert.alert(
      'Confirmar Envio para Estoque',
      `Enviar ${locacaoInfo?.produtoTipo ?? 'Produto'} N° ${locacaoInfo?.produtoIdentificador ?? produtoId} para ${nomeEstab}?\n\nA locação de ${locacaoInfo?.clienteNome ?? ''} será finalizada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            setSalvando(true);
            try {
              // 1. Finalizar locação
              const ok = await finalizarLocacao(locacaoId, `Envio para ${nomeEstab}: ${motivo}`);
              if (!ok) throw new Error('Não foi possível finalizar a locação');

              // 2. Atualizar produto (estabelecimento e observação)
              await atualizarProduto({
                id: produtoId,
                estabelecimento: nomeEstab,
                observacao: observacao || `Enviado para ${nomeEstab}: ${motivo}`,
                statusProduto: 'Ativo',
              });

              Alert.alert(
                'Produto Enviado!',
                `${locacaoInfo?.produtoTipo ?? 'Produto'} enviado para ${nomeEstab} com sucesso.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao enviar para estoque');
            } finally {
              setSalvando(false);
            }
          },
        },
      ]
    );
  }, [validate, estabelecimento, estabelecimentos, locacaoInfo, produtoId, motivo, observacao,
      finalizarLocacao, atualizarProduto, locacaoId, navigation]);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Produto info */}
          <View style={s.prodCard}>
            <View style={s.prodIcon}><Ionicons name="cube" size={28} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.prodNome}>
                {locacaoInfo?.produtoTipo ?? '…'} N° {locacaoInfo?.produtoIdentificador ?? produtoId}
              </Text>
              <Text style={s.prodCliente}>Cliente: {locacaoInfo?.clienteNome ?? '…'}</Text>
            </View>
          </View>

          {/* Destino */}
          <Text style={s.secTitle}>Destino *</Text>
          <View style={s.card}>
            {estabelecimentos.length === 0 ? (
              <View style={s.semEstab}>
                <Ionicons name="warning-outline" size={20} color="#EA580C" />
                <Text style={s.semEstabText}>Nenhum estabelecimento cadastrado. Configure em Mais → Atributos de Produto → Estoque.</Text>
              </View>
            ) : (
              estabelecimentos.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.radioItem, estabelecimento === item.id && s.radioItemSel]}
                  onPress={() => { setEstabelecimento(item.id); setErrors(p => { const n = {...p}; delete n.estabelecimento; return n; }); }}
                >
                  <View style={[s.radio, estabelecimento === item.id && s.radioSel]}>
                    {estabelecimento === item.id && <View style={s.radioDot} />}
                  </View>
                  <Text style={[s.radioText, estabelecimento === item.id && { fontWeight: '700', color: '#2563EB' }]}>
                    {item.nome}
                  </Text>
                </TouchableOpacity>
              ))
            )}
            {errors.estabelecimento && <Text style={s.errText}>{errors.estabelecimento}</Text>}
          </View>

          {/* Motivo */}
          <Text style={s.secTitle}>Motivo *</Text>
          <View style={s.card}>
            <TextInput
              style={[s.input, s.inputMulti, errors.motivo && s.inputErr]}
              placeholder="Ex: Manutenção, cliente cancelou, produto danificado..."
              placeholderTextColor="#94A3B8"
              value={motivo}
              onChangeText={v => { setMotivo(v); setErrors(p => { const n = {...p}; delete n.motivo; return n; }); }}
              multiline numberOfLines={3}
            />
            {errors.motivo && <Text style={s.errText}>{errors.motivo}</Text>}
          </View>

          {/* Observação */}
          <Text style={s.secTitle}>Observação (opcional)</Text>
          <View style={s.card}>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Informações adicionais..."
              placeholderTextColor="#94A3B8"
              value={observacao}
              onChangeText={setObservacao}
              multiline numberOfLines={3}
            />
          </View>

          {/* Aviso */}
          <View style={s.aviso}>
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <Text style={s.avisoText}>
              Esta ação finaliza a locação atual e libera o produto para nova locação.
            </Text>
          </View>

          <View style={{ height: 90 }} />
        </ScrollView>

        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.btnConfirm, (salvando || !estabelecimento || !motivo.trim()) && s.btnDisabled]}
            onPress={handleConfirmar}
            disabled={salvando || !estabelecimento || !motivo.trim()}
          >
            {salvando ? <ActivityIndicator color="#FFF" /> : (
              <><Ionicons name="checkmark-circle" size={22} color="#FFF" />
              <Text style={s.btnText}>Confirmar Envio</Text></>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8FAFC' },
  scroll:      { padding: 16, paddingBottom: 20 },
  prodCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#2563EB', borderRadius: 16, padding: 16, marginBottom: 20 },
  prodIcon:    { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  prodNome:    { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  prodCliente: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  secTitle:    { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  card:        { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 1 },
  semEstab:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  semEstabText:{ flex: 1, fontSize: 13, color: '#EA580C', lineHeight: 18 },
  radioItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  radioItemSel:{ borderBottomColor: '#BFDBFE' },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center' },
  radioSel:    { borderColor: '#2563EB' },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB' },
  radioText:   { flex: 1, fontSize: 15, color: '#1E293B' },
  input:       { fontSize: 15, color: '#1E293B' },
  inputMulti:  { minHeight: 70, textAlignVertical: 'top' },
  inputErr:    { borderBottomWidth: 1, borderBottomColor: '#DC2626' },
  errText:     { fontSize: 12, color: '#DC2626', marginTop: 6 },
  aviso:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 12 },
  avisoText:   { flex: 1, fontSize: 13, color: '#991B1B', lineHeight: 18 },
  bottomBar:   { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  btnConfirm:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#DC2626', padding: 16, borderRadius: 14 },
  btnDisabled: { backgroundColor: '#FCA5A5' },
  btnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
