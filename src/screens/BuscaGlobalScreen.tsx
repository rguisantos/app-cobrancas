/**
 * BuscaGlobalScreen.tsx
 * Busca global — pesquisa em todas as entidades do sistema
 * Clientes, Produtos, Cobranças e Locações
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { clienteRepository } from '../repositories/ClienteRepository';
import { produtoRepository } from '../repositories/ProdutoRepository';
import { cobrancaRepository } from '../repositories/CobrancaRepository';
import { locacaoRepository } from '../repositories/LocacaoRepository';

// ============================================================================
// TIPOS
// ============================================================================

type TipoEntidade = 'cliente' | 'produto' | 'cobranca' | 'locacao';

interface ResultadoBusca {
  id: string;
  tipo: TipoEntidade;
  titulo: string;
  subtitulo: string;
  icone: keyof typeof Ionicons.glyphMap;
  iconeBg: string;
  iconeColor: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  navegarPara: string;
  navegarParams: any;
}

// ============================================================================
// CONFIGURAÇÃO DE ENTIDADES
// ============================================================================

const ENTIDADE_CONFIG: Record<TipoEntidade, {
  label: string;
  icone: keyof typeof Ionicons.glyphMap;
  iconeBg: string;
  iconeColor: string;
  badgeBg: string;
  badgeColor: string;
}> = {
  cliente: {
    label: 'Cliente',
    icone: 'person',
    iconeBg: '#DBEAFE',
    iconeColor: '#2563EB',
    badgeBg: '#DBEAFE',
    badgeColor: '#2563EB',
  },
  produto: {
    label: 'Produto',
    icone: 'cube',
    iconeBg: '#DCFCE7',
    iconeColor: '#16A34A',
    badgeBg: '#DCFCE7',
    badgeColor: '#16A34A',
  },
  cobranca: {
    label: 'Cobrança',
    icone: 'cash',
    iconeBg: '#FEF3C7',
    iconeColor: '#D97706',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
  },
  locacao: {
    label: 'Locação',
    icone: 'key',
    iconeBg: '#F3E8FF',
    iconeColor: '#8B5CF6',
    badgeBg: '#F3E8FF',
    badgeColor: '#8B5CF6',
  },
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function BuscaGlobalScreen() {
  const navigation = useNavigation<any>();

  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==========================================================================
  // BUSCA COM DEBOUNCE
  // ==========================================================================

  const executarBusca = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResultados([]);
      setBuscou(false);
      return;
    }

    setBuscando(true);
    setBuscou(true);

    try {
      const lower = q.toLowerCase().trim();
      const resultadosBusca: ResultadoBusca[] = [];

      // Buscar em paralelo em todas as entidades
      const [clientes, produtos, cobrancas, locacoes] = await Promise.all([
        clienteRepository.search(q),
        produtoRepository.search(q),
        cobrancaRepository.getAll({ termoBusca: q }),
        locacaoRepository.getAll({ termoBusca: q }),
      ]);

      // Mapear clientes
      for (const c of clientes.slice(0, 20)) {
        const cfg = ENTIDADE_CONFIG.cliente;
        resultadosBusca.push({
          id: c.id,
          tipo: 'cliente',
          titulo: c.nomeExibicao || '',
          subtitulo: [c.cpfCnpj || c.cidade, c.rotaNome].filter(Boolean).join(' • ') || 'Cliente',
          icone: cfg.icone,
          iconeBg: cfg.iconeBg,
          iconeColor: cfg.iconeColor,
          badge: cfg.label,
          badgeBg: cfg.badgeBg,
          badgeColor: cfg.badgeColor,
          navegarPara: 'ClienteDetail',
          navegarParams: { clienteId: c.id },
        });
      }

      // Mapear produtos
      for (const p of produtos.slice(0, 20)) {
        const cfg = ENTIDADE_CONFIG.produto;
        resultadosBusca.push({
          id: p.id,
          tipo: 'produto',
          titulo: `${p.tipoNome || 'Produto'} N° ${p.identificador}`,
          subtitulo: [p.descricaoNome, p.tamanhoNome].filter(Boolean).join(' • ') || 'Produto',
          icone: cfg.icone,
          iconeBg: cfg.iconeBg,
          iconeColor: cfg.iconeColor,
          badge: cfg.label,
          badgeBg: cfg.badgeBg,
          badgeColor: cfg.badgeColor,
          navegarPara: 'ProdutoDetail',
          navegarParams: { produtoId: p.id },
        });
      }

      // Mapear cobranças
      for (const c of cobrancas.slice(0, 20)) {
        const cfg = ENTIDADE_CONFIG.cobranca;
        const statusLabel = c.status || 'Pendente';
        resultadosBusca.push({
          id: c.id,
          tipo: 'cobranca',
          titulo: c.clienteNome || 'Cobrança',
          subtitulo: `${c.produtoIdentificador || ''} • ${statusLabel}`,
          icone: cfg.icone,
          iconeBg: cfg.iconeBg,
          iconeColor: cfg.iconeColor,
          badge: cfg.label,
          badgeBg: cfg.badgeBg,
          badgeColor: cfg.badgeColor,
          navegarPara: 'CobrancaDetail',
          navegarParams: { cobrancaId: c.id },
        });
      }

      // Mapear locações
      for (const l of locacoes.slice(0, 20)) {
        const cfg = ENTIDADE_CONFIG.locacao;
        const statusLabel = l.status || 'Ativa';
        resultadosBusca.push({
          id: l.id,
          tipo: 'locacao',
          titulo: l.clienteNome || 'Locação',
          subtitulo: `${l.produtoIdentificador || ''} • ${statusLabel}`,
          icone: cfg.icone,
          iconeBg: cfg.iconeBg,
          iconeColor: cfg.iconeColor,
          badge: cfg.label,
          badgeBg: cfg.badgeBg,
          badgeColor: cfg.badgeColor,
          navegarPara: 'LocacaoDetail',
          navegarParams: { locacaoId: l.id },
        });
      }

      setResultados(resultadosBusca);
    } catch (e) {
      console.error('[BuscaGlobal] Erro na busca:', e);
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleBusca = useCallback((texto: string) => {
    setTermo(texto);

    // Limpar debounce anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce de 300ms
    debounceRef.current = setTimeout(() => {
      executarBusca(texto);
    }, 300);
  }, [executarBusca]);

  // Limpar debounce ao desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ==========================================================================
  // AGRUPAR RESULTADOS POR TIPO
  // ==========================================================================

  const resultadosAgrupados = useMemo(() => {
    const grupos: Record<TipoEntidade, ResultadoBusca[]> = {
      cliente: [],
      produto: [],
      cobranca: [],
      locacao: [],
    };

    for (const r of resultados) {
      grupos[r.tipo].push(r);
    }

    // Retornar apenas grupos com resultados, na ordem desejada
    const ordem: TipoEntidade[] = ['cliente', 'produto', 'cobranca', 'locacao'];
    return ordem
      .filter(tipo => grupos[tipo].length > 0)
      .map(tipo => ({
        tipo,
        label: ENTIDADE_CONFIG[tipo].label,
        count: grupos[tipo].length,
        data: grupos[tipo],
      }));
  }, [resultados]);

  // Contagem total por tipo
  const contagens = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of resultados) {
      c[r.tipo] = (c[r.tipo] || 0) + 1;
    }
    return c;
  }, [resultados]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const handleNavegar = (item: ResultadoBusca) => {
    Keyboard.dismiss();
    navigation.navigate(item.navegarPara, item.navegarParams);
  };

  const renderGrupoHeader = (tipo: TipoEntidade, count: number) => {
    const cfg = ENTIDADE_CONFIG[tipo];
    return (
      <View style={st.grupoHeader} key={`header_${tipo}`}>
        <View style={[st.grupoIcon, { backgroundColor: cfg.iconeBg }]}>
          <Ionicons name={cfg.icone} size={14} color={cfg.iconeColor} />
        </View>
        <Text style={st.grupoLabel}>{cfg.label}s</Text>
        <View style={[st.grupoBadge, { backgroundColor: cfg.badgeBg }]}>
          <Text style={[st.grupoBadgeText, { color: cfg.badgeColor }]}>{count}</Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ResultadoBusca }) => (
    <TouchableOpacity
      style={st.resultCard}
      onPress={() => handleNavegar(item)}
      activeOpacity={0.7}
    >
      <View style={[st.resultIcon, { backgroundColor: item.iconeBg }]}>
        <Ionicons name={item.icone} size={18} color={item.iconeColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.resultTitulo} numberOfLines={1}>{item.titulo}</Text>
        <Text style={st.resultSubtitulo} numberOfLines={1}>{item.subtitulo}</Text>
      </View>
      <View style={[st.resultBadge, { backgroundColor: item.badgeBg }]}>
        <Text style={[st.resultBadgeText, { color: item.badgeColor }]}>{item.badge}</Text>
      </View>
    </TouchableOpacity>
  );

  // FlatList data: grupos com headers intercalados
  const flatData = useMemo(() => {
    const items: (ResultadoBusca | { _header: TipoEntidade; _count: number })[] = [];
    for (const grupo of resultadosAgrupados) {
      items.push({ _header: grupo.tipo, _count: grupo.count });
      for (const r of grupo.data) {
        items.push(r);
      }
    }
    return items;
  }, [resultadosAgrupados]);

  return (
    <SafeAreaView style={st.container} edges={['bottom']}>
      {/* Barra de busca */}
      <View style={st.searchContainer}>
        <View style={st.searchBox}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            style={st.searchInput}
            placeholder="Buscar clientes, produtos, cobranças..."
            placeholderTextColor="#94A3B8"
            value={termo}
            onChangeText={handleBusca}
            autoFocus
            returnKeyType="search"
          />
          {buscando && <ActivityIndicator size="small" color="#2563EB" />}
          {termo.length > 0 && !buscando && (
            <TouchableOpacity onPress={() => { setTermo(''); setResultados([]); setBuscou(false); }}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Resumo dos resultados */}
      {resultados.length > 0 && (
        <View style={st.resumoBar}>
          <Text style={st.resumoText}>
            {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
          </Text>
          <View style={st.resumoBadges}>
            {Object.entries(contagens).map(([tipo, count]) => {
              const cfg = ENTIDADE_CONFIG[tipo as TipoEntidade];
              return (
                <View key={tipo} style={[st.resumoBadge, { backgroundColor: cfg.badgeBg }]}>
                  <Text style={[st.resumoBadgeText, { color: cfg.badgeColor }]}>
                    {count} {cfg.label}{count > 1 ? 's' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Resultados */}
      {buscando && resultados.length === 0 ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={st.buscandoText}>Buscando...</Text>
        </View>
      ) : flatData.length > 0 ? (
        <FlatList
          data={flatData as any[]}
          keyExtractor={(item, index) =>
            (item as any)._header ? `header_${(item as any)._header}` : (item as ResultadoBusca).id
          }
          renderItem={({ item }) => {
            if ((item as any)._header) {
              return renderGrupoHeader((item as any)._header, (item as any)._count);
            }
            return renderItem({ item: item as ResultadoBusca });
          }}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : buscou && termo.trim().length >= 2 ? (
        <View style={st.center}>
          <Ionicons name="search-outline" size={56} color="#CBD5E1" />
          <Text style={st.emptyTitle}>Nenhum resultado</Text>
          <Text style={st.emptySub}>
            Nenhum registro encontrado para &quot;{termo}&quot;
          </Text>
        </View>
      ) : (
        <View style={st.center}>
          <Ionicons name="search" size={56} color="#CBD5E1" />
          <Text style={st.emptyTitle}>Busca Global</Text>
          <Text style={st.emptySub}>
            Digite ao menos 2 caracteres para buscar em clientes, produtos, cobranças e locações
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const st = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8FAFC' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 32 },

  // Busca
  searchContainer: { backgroundColor: '#FFF', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  searchBox:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
                backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput:{ flex: 1, fontSize: 16, color: '#1E293B' },

  // Resumo
  resumoBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  resumoText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  resumoBadges: { flexDirection: 'row', gap: 6 },
  resumoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  resumoBadgeText: { fontSize: 11, fontWeight: '700' },

  // Lista
  list:       { paddingBottom: 24 },

  // Grupo header
  grupoHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  grupoIcon:  { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  grupoLabel: { fontSize: 13, fontWeight: '700', color: '#1E293B', flex: 1 },
  grupoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  grupoBadgeText: { fontSize: 11, fontWeight: '700' },

  // Resultado card
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  resultIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  resultTitulo: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  resultSubtitulo: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  resultBadgeText: { fontSize: 10, fontWeight: '700' },

  // Buscando
  buscandoText: { fontSize: 14, color: '#64748B', marginTop: 8 },

  // Empty states
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#334155', textAlign: 'center' },
  emptySub:   { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 280 },
});
