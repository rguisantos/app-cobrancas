/**
 * RotasCobrancaScreen.tsx
 * Passo 1 do fluxo de cobrança — selecionar a rota
 */

import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { Ionicons }       from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useRota }             from '../contexts/RotaContext';
import { useAuth }             from '../contexts/AuthContext';
import { useCobrancaNavigate } from '../navigation/CobrancasStack';
import { Rota }                from '../types';

export default function RotasCobrancaScreen() {
  const { rotas, carregarRotas, carregando } = useRota();
  const { user, canAccessRota }              = useAuth();
  const navigate                             = useCobrancaNavigate();

  useFocusEffect(useCallback(() => { carregarRotas(); }, [carregarRotas]));

  const rotasPermitidas = rotas.filter(r =>
    user?.tipoPermissao === 'Administrador' || canAccessRota(r.id),
  );

  if (carregando && rotasPermitidas.length === 0) {
    return <View style={s.center}><ActivityIndicator size="large" color="#1976D2" /></View>;
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <FlatList
        data={rotasPermitidas}
        keyExtractor={item => String(item.id)}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          <View style={s.empty}><Text style={s.emptyText}>Nenhuma rota disponível</Text></View>
        }
        renderItem={({ item }: { item: Rota }) => (
          <TouchableOpacity
            style={s.item}
            onPress={() => navigate.toClientesRota(item.id, item.descricao)}
            activeOpacity={0.6}
          >
            <Text style={s.itemText}>{item.descricao}</Text>
            <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEEEEE' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 18,
  },
  itemText: { fontSize: 16, color: '#212121' },
  sep:      { height: 1, backgroundColor: '#E0E0E0' },
  empty:    { flex: 1, padding: 40, alignItems: 'center' },
  emptyText:{ fontSize: 15, color: '#9E9E9E' },
});
