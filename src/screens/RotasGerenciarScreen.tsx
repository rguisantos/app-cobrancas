/**
 * RotasGerenciarScreen.tsx
 * Gerenciar rotas de cobrança — criar, editar, excluir
 * Refatorado: melhor UX, validação de unicidade, confirmação de exclusão com info
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useRota }  from '../contexts/RotaContext';
import { useAuth }  from '../contexts/AuthContext';
import { Rota }     from '../types';

export default function RotasGerenciarScreen() {
  const { rotas, carregarRotas, salvarRota, excluirRota, carregando } = useRota();
  const { user, isAdmin } = useAuth();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando,    setEditando]    = useState<Rota | null>(null);
  const [descricao,   setDescricao]   = useState('');
  const [status,      setStatus]      = useState<'Ativo' | 'Inativo'>('Ativo');
  const [salvando,    setSalvando]    = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [erroForm,    setErroForm]    = useState<string | null>(null);

  const podeGerenciar = isAdmin() || user?.tipoPermissao === 'Administrador';

  useFocusEffect(useCallback(() => { carregarRotas(); }, [carregarRotas]));

  const onRefresh = async () => {
    setRefreshing(true);
    await carregarRotas();
    setRefreshing(false);
  };

  const abrirForm = (rota?: Rota) => {
    setEditando(rota ?? null);
    setDescricao(rota?.descricao ?? '');
    setStatus(rota?.status ?? 'Ativo');
    setErroForm(null);
    setMostrarForm(true);
  };

  const fecharForm = () => {
    setMostrarForm(false);
    setEditando(null);
    setDescricao('');
    setStatus('Ativo');
    setErroForm(null);
  };

  const handleSalvar = async () => {
    if (!descricao.trim()) {
      setErroForm('Digite a descrição da rota');
      return;
    }
    if (descricao.trim().length > 100) {
      setErroForm('Descrição deve ter no máximo 100 caracteres');
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      const resultado = await salvarRota({
        id: editando?.id,
        descricao: descricao.trim(),
        status,
      });
      if (resultado) {
        Alert.alert('Sucesso', editando ? 'Rota atualizada' : 'Rota criada');
        fecharForm();
      } else {
        // O erro já foi setado no context
        setErroForm('Não foi possível salvar. Verifique se já não existe uma rota com este nome.');
      }
    } catch (error: any) {
      const msg = error?.message || 'Ocorreu um erro ao salvar';
      setErroForm(msg);
    }
    finally { setSalvando(false); }
  };

  const handleExcluir = (rota: Rota) => {
    Alert.alert(
      'Excluir Rota',
      `Excluir "${rota.descricao}"?\n\nOs clientes associados a esta rota ficarão sem rota vinculada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            const ok = await excluirRota(rota.id);
            if (!ok) Alert.alert('Erro', 'Não foi possível excluir a rota');
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Rota }) => (
    <View style={s.card}>
      <View style={s.cardLeft}>
        <View style={[s.iconBox, item.status === 'Inativo' && s.iconBoxInactive]}>
          <Ionicons name="map" size={20} color={item.status === 'Ativo' ? '#2563EB' : '#94A3B8'} />
        </View>
        <View style={s.cardText}>
          <Text style={s.cardDescricao}>{item.descricao}</Text>
          <Text style={[s.cardStatus, { color: item.status === 'Ativo' ? '#16A34A' : '#94A3B8' }]}>
            {item.status}
          </Text>
        </View>
      </View>
      {podeGerenciar && (
        <View style={s.cardActions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => abrirForm(item)}>
            <Ionicons name="pencil" size={18} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => handleExcluir(item)}>
            <Ionicons name="trash" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Gerenciar Rotas</Text>
        <Text style={s.headerSubtitle}>{rotas.length} rota{rotas.length !== 1 ? 's' : ''}</Text>
        {podeGerenciar && !mostrarForm && (
          <TouchableOpacity style={s.addBtn} onPress={() => abrirForm()}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Formulário inline */}
      {mostrarForm && (
        <View style={s.form}>
          <Text style={s.formTitle}>{editando ? 'Editar Rota' : 'Nova Rota'}</Text>
          <TextInput
            style={[s.input, erroForm && s.inputError]}
            placeholder="Ex: Linha Aquidauana"
            placeholderTextColor="#94A3B8"
            value={descricao}
            onChangeText={(text) => { setDescricao(text); setErroForm(null); }}
            autoFocus
            returnKeyType="done"
            maxLength={100}
            onSubmitEditing={handleSalvar}
          />
          <Text style={s.charCount}>{descricao.length}/100</Text>

          {/* Status selector */}
          <View style={s.statusRow}>
            <TouchableOpacity
              style={[s.statusOption, status === 'Ativo' && s.statusOptionActive]}
              onPress={() => setStatus('Ativo')}
            >
              <Text style={[s.statusOptionText, status === 'Ativo' && s.statusOptionTextActive]}>Ativo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.statusOption, status === 'Inativo' && s.statusOptionInactive]}
              onPress={() => setStatus('Inativo')}
            >
              <Text style={[s.statusOptionText, status === 'Inativo' && s.statusOptionTextInactive]}>Inativo</Text>
            </TouchableOpacity>
          </View>

          {erroForm && <Text style={s.erroText}>{erroForm}</Text>}

          <View style={s.formActions}>
            <TouchableOpacity style={s.btnCancel} onPress={fecharForm}>
              <Text style={s.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSave, salvando && s.btnDisabled]}
              onPress={handleSalvar} disabled={salvando}
            >
              {salvando
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={s.btnSaveText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={rotas}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[s.list, rotas.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} />
        }
        ListEmptyComponent={() => (
          carregando ? (
            <View style={s.center}><ActivityIndicator color="#2563EB" /><Text style={s.emptyText}>Carregando...</Text></View>
          ) : (
            <View style={s.center}>
              <Ionicons name="map-outline" size={48} color="#CBD5E1" />
              <Text style={s.emptyText}>Nenhuma rota cadastrada</Text>
              {podeGerenciar && (
                <TouchableOpacity style={s.emptyBtn} onPress={() => abrirForm()}>
                  <Text style={s.emptyBtnText}>Criar primeira rota</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F8FAFC' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle:  { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  headerSubtitle: { fontSize: 13, color: '#64748B', position: 'absolute', left: 16, top: 44 },
  addBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  form:         { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  formTitle:    { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  input:        { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, color: '#1E293B', marginBottom: 4 },
  inputError:   { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  charCount:    { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginBottom: 12 },
  statusRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFFFFF' },
  statusOptionActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  statusOptionInactive: { borderColor: '#94A3B8', backgroundColor: '#F8FAFC' },
  statusOptionText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  statusOptionTextActive: { color: '#16A34A' },
  statusOptionTextInactive: { color: '#94A3B8' },
  erroText:     { fontSize: 13, color: '#EF4444', marginBottom: 8, fontWeight: '500' },
  formActions:  { flexDirection: 'row', gap: 12 },
  btnCancel:    { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  btnCancelText:{ fontSize: 15, fontWeight: '600', color: '#64748B' },
  btnSave:      { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnSaveText:  { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  list:         { padding: 16 },
  listEmpty:    { flexGrow: 1 },
  card:         { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  cardLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox:      { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  iconBoxInactive: { backgroundColor: '#F1F5F9' },
  cardText:     { marginLeft: 12, flex: 1 },
  cardDescricao:{ fontSize: 15, fontWeight: '600', color: '#1E293B' },
  cardStatus:   { fontSize: 12, fontWeight: '500', marginTop: 2 },
  cardActions:  { flexDirection: 'row', gap: 8 },
  actionBtn:    { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  actionBtnDanger: { backgroundColor: '#FEF2F2' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText:    { fontSize: 16, color: '#64748B', marginTop: 8 },
  emptyBtn:     { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#2563EB', borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
