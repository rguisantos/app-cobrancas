import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useCobranca } from '../hooks/useCobranca';

const RotasCobrancaScreen: React.FC = () => {
  const { cobrancasPendentes, fetchCobracas } = useCobranca();

  useEffect(() => {
    fetchCobracas();
  }, [fetchCobracas]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cobranças Pendentes</Text>
      <FlatList
        data={cobrancasPendentes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>{item.descricao} - R$ {item.valor.toFixed(2)}</Text>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
});

export default RotasCobrancaScreen;
