/**
 * MapaClientesScreen.tsx
 * Visualização de clientes por localização
 * - Lista de clientes com coordenadas agrupados por rota
 * - Filtro por rota
 * - Distância a partir da localização atual (se disponível)
 * - Navegação para detalhes do cliente
 *
 * NOTA: react-native-maps não está disponível no projeto,
 * por isso usamos uma lista com informações de localização.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';

import { apiService } from '../../services/ApiService';
import { clienteRepository } from '../../repositories/ClienteRepository';
import { rotaRepository } from '../../repositories/RotaRepository';

// ============================================================================
// TIPOS
// ============================================================================

interface ClienteMapa {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  rotaId: string;
  rotaNome: string;
  latitude?: number;
  longitude?: number;
  distancia?: number;
  status: string;
}

interface RotaOpcao {
  id: string;
  nome: string;
  cor: string;
}

// ============================================================================
// CONFIGURAÇÃO DE CORES POR ROTA
// ============================================================================

const ROTA_CORES = [
  '#2563EB', '#16A34A', '#D97706', '#DC2626', '#9333EA',
  '#0891B2', '#EA580C', '#059669', '#7C3AED', '#DB2777',
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function MapaClientesScreen() {
  const navigation = useNavigation<any>();

  const [clientes, setClientes] = useState<ClienteMapa[]>([]);
  const [rotas, setRotas] = useState<RotaOpcao[]>([]);
  const [rotaFiltro, setRotaFiltro] = useState<string>('todas');
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [localizacaoAtual, setLocalizacaoAtual] = useState<{ lat: number; lon: number } | null>(null);
  const [erroLocalizacao, setErroLocalizacao] = useState<string | null>(null);

  // ==========================================================================
  // CARREGAMENTO DE DADOS
  // ==========================================================================

  const carregarDados = useCallback(async () => {
    try {
      // Carregar rotas
      const rotasData = await rotaRepository.getAll();
      const rotasOpcoes: RotaOpcao[] = rotasData.map((r: any, i: number) => ({
        id: r.id,
        nome: r.descricao || `Rota ${i + 1}`,
        cor: ROTA_CORES[i % ROTA_CORES.length],
      }));
      setRotas(rotasOpcoes);

      // Tentar API primeiro
      const response = await apiService.getMapaData();
      if (response.success && response.data) {
        const data = response.data as any;
        const items = Array.isArray(data) ? data : data.clientes || data.data || [];
        const clientesMapa: ClienteMapa[] = items.map((c: any) => ({
          id: c.id || c.clienteId,
          nome: c.nome || c.nomeExibicao || '',
          endereco: [c.logradouro, c.numero, c.bairro].filter(Boolean).join(', '),
          cidade: c.cidade || '',
          rotaId: c.rotaId || '',
          rotaNome: c.rotaNome || 'Sem rota',
          latitude: c.latitude,
          longitude: c.longitude,
          status: c.status || 'Ativo',
        }));
        setClientes(clientesMapa);
        setOffline(false);
      } else {
        // Fallback local
        await carregarLocal(rotasOpcoes);
        setOffline(true);
      }
    } catch {
      await carregarLocal(rotas);
      setOffline(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarLocal = useCallback(async (rotasOpcoes: RotaOpcao[]) => {
    try {
      const clientesData = await clienteRepository.getAll({ status: 'Ativo' });
      const rotaMap = new Map(rotasOpcoes.map(r => [r.id, r.nome]));

      const clientesMapa: ClienteMapa[] = clientesData.map((c: any) => ({
        id: c.id,
        nome: c.nomeExibicao || c.nomeCompleto || '',
        endereco: [c.logradouro, c.numero, c.bairro].filter(Boolean).join(', '),
        cidade: c.cidade || '',
        rotaId: c.rotaId || '',
        rotaNome: c.rotaNome || rotaMap.get(c.rotaId) || 'Sem rota',
        latitude: c.latitude,
        longitude: c.longitude,
        status: c.status || 'Ativo',
      }));

      setClientes(clientesMapa);
    } catch (e) {
      console.error('[MapaClientes] Erro ao carregar dados locais:', e);
    }
  }, []);

  // Obter localização atual
  const obterLocalizacao = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErroLocalizacao('Permissão de localização negada');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocalizacaoAtual({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      });
    } catch {
      setErroLocalizacao('Não foi possível obter a localização');
    }
  }, []);

  useEffect(() => {
    carregarDados();
    obterLocalizacao();
  }, [carregarDados, obterLocalizacao]);

  // Calcular distâncias
  useEffect(() => {
    if (localizacaoAtual && clientes.length > 0) {
      setClientes(prev =>
        prev.map(c => ({
          ...c,
          distancia: c.latitude && c.longitude
            ? calcularDistancia(localizacaoAtual.lat, localizacaoAtual.lon, c.latitude, c.longitude)
            : undefined,
        }))
      );
    }
  }, [localizacaoAtual]);

  // ==========================================================================
  // FILTROS E ORDENAÇÃO
  // ==========================================================================

  const clientesFiltrados = useMemo(() => {
    let filtrados = rotaFiltro === 'todas'
      ? clientes
      : clientes.filter(c => c.rotaId === rotaFiltro);

    // Ordenar por distância (mais próximos primeiro)
    filtrados.sort((a, b) => {
      if (a.distancia !== undefined && b.distancia !== undefined) {
        return a.distancia - b.distancia;
      }
      if (a.distancia !== undefined) return -1;
      if (b.distancia !== undefined) return 1;
      return a.nome.localeCompare(b.nome);
    });

    return filtrados;
  }, [clientes, rotaFiltro]);

  // Estatísticas
  const stats = useMemo(() => {
    const comCoords = clientes.filter(c => c.latitude && c.longitude).length;
    const semCoords = clientes.length - comCoords;
    return { total: clientes.length, comCoords, semCoords };
  }, [clientes]);

  // ==========================================================================
  // REFRESH
  // ==========================================================================

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [carregarDados]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const getRotaCor = (rotaId: string): string => {
    const rota = rotas.find(r => r.id === rotaId);
    if (rota) return rota.cor;
    const idx = rotas.findIndex(r => r.id === rotaId);
    return ROTA_CORES[Math.max(0, idx) % ROTA_CORES.length];
  };

  const renderCliente = ({ item }: { item: ClienteMapa }) => {
    const cor = getRotaCor(item.rotaId);
    return (
      <TouchableOpacity
        style={ms.clienteCard}
        onPress={() => {
          const parent = navigation.getParent();
          if (parent) (parent as any).navigate('ClienteDetail', { clienteId: item.id });
        }}
        activeOpacity={0.7}
      >
        <View style={ms.clienteLeft}>
          <View style={[ms.rotaIndicator, { backgroundColor: cor }]} />
          <View style={ms.clienteInfo}>
            <Text style={ms.clienteNome} numberOfLines={1}>{item.nome}</Text>
            <Text style={ms.clienteEndereco} numberOfLines={1}>{item.endereco}</Text>
            <View style={ms.clienteTags}>
              <View style={[ms.rotaTag, { backgroundColor: cor + '18' }]}>
                <Text style={[ms.rotaTagText, { color: cor }]}>{item.rotaNome}</Text>
              </View>
              {item.distancia !== undefined && (
                <View style={ms.distTag}>
                  <Ionicons name="location" size={10} color="#64748B" />
                  <Text style={ms.distTagText}>{item.distancia < 1 ? `${Math.round(item.distancia * 1000)}m` : `${item.distancia.toFixed(1)}km`}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={ms.clienteRight}>
          {item.latitude && item.longitude ? (
            <View style={ms.coordsBadge}>
              <Ionicons name="pin" size={14} color="#16A34A" />
            </View>
          ) : (
            <View style={[ms.coordsBadge, ms.coordsBadgeOff]}>
              <Ionicons name="pin-outline" size={14} color="#CBD5E1" />
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </View>
      </TouchableOpacity>
    );
  };

  if (carregando) {
    return (
      <View style={ms.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={ms.loadingText}>Carregando mapa de clientes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={ms.container} edges={['bottom']}>
      {/* Offline banner */}
      {offline && (
        <View style={ms.offlineBanner}>
          <Ionicons name="cloud-offline" size={14} color="#D97706" />
          <Text style={ms.offlineText}>Modo offline — dados locais</Text>
        </View>
      )}

      {/* Estatísticas */}
      <View style={ms.statsBar}>
        <View style={ms.statItem}>
          <Ionicons name="people" size={16} color="#2563EB" />
          <Text style={ms.statValue}>{stats.total}</Text>
          <Text style={ms.statLabel}>Total</Text>
        </View>
        <View style={ms.statDivisor} />
        <View style={ms.statItem}>
          <Ionicons name="pin" size={16} color="#16A34A" />
          <Text style={ms.statValue}>{stats.comCoords}</Text>
          <Text style={ms.statLabel}>Com localização</Text>
        </View>
        <View style={ms.statDivisor} />
        <View style={ms.statItem}>
          <Ionicons name="pin-outline" size={16} color="#CBD5E1" />
          <Text style={ms.statValue}>{stats.semCoords}</Text>
          <Text style={ms.statLabel}>Sem localização</Text>
        </View>
      </View>

      {/* Filtros por rota */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.filtrosScroll} contentContainerStyle={ms.filtrosContent}>
        <TouchableOpacity
          style={[ms.filtroBtn, rotaFiltro === 'todas' && ms.filtroBtnAtivo]}
          onPress={() => setRotaFiltro('todas')}
        >
          <Ionicons name="grid" size={14} color={rotaFiltro === 'todas' ? '#FFFFFF' : '#64748B'} />
          <Text style={[ms.filtroText, rotaFiltro === 'todas' && ms.filtroTextAtivo]}>Todas</Text>
        </TouchableOpacity>
        {rotas.map(rota => (
          <TouchableOpacity
            key={rota.id}
            style={[ms.filtroBtn, rotaFiltro === rota.id && { backgroundColor: rota.cor }]}
            onPress={() => setRotaFiltro(rota.id)}
          >
            <View style={[ms.filtroDot, { backgroundColor: rota.cor }]} />
            <Text style={[ms.filtroText, rotaFiltro === rota.id && ms.filtroTextAtivo]}>{rota.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista de clientes */}
      <FlatList
        data={clientesFiltrados}
        keyExtractor={item => item.id}
        renderItem={renderCliente}
        contentContainerStyle={ms.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563EB']} tintColor="#2563EB" />
        }
        ListEmptyComponent={
          <View style={ms.emptyState}>
            <Ionicons name="map-outline" size={56} color="#CBD5E1" />
            <Text style={ms.emptyTitle}>Nenhum cliente encontrado</Text>
            <Text style={ms.emptySub}>
              {rotaFiltro !== 'todas'
                ? 'Tente selecionar outra rota ou "Todas"'
                : 'Nenhum cliente cadastrado com endereço'}
            </Text>
          </View>
        }
      />

      {/* Aviso de localização */}
      {erroLocalizacao && (
        <View style={ms.locationBanner}>
          <Ionicons name="location-outline" size={14} color="#D97706" />
          <Text style={ms.locationText}>{erroLocalizacao}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Calcula distância entre dois pontos em km (fórmula de Haversine)
 */
function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// ESTILOS
// ============================================================================

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText: { color: '#64748B', fontSize: 15, marginTop: 8 },

  // Offline
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFFBEB', paddingVertical: 8, paddingHorizontal: 16,
  },
  offlineText: { fontSize: 12, color: '#D97706', fontWeight: '600' },

  // Stats
  statsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 16,
    marginHorizontal: 16, marginTop: 12, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  statLabel: { fontSize: 11, color: '#94A3B8' },
  statDivisor: { width: 1, height: 32, backgroundColor: '#E2E8F0' },

  // Filtros
  filtrosScroll: { maxHeight: 48, marginHorizontal: 16, marginTop: 10 },
  filtrosContent: { gap: 8, paddingVertical: 4 },
  filtroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  filtroBtnAtivo: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filtroText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filtroTextAtivo: { color: '#FFFFFF' },
  filtroDot: { width: 8, height: 8, borderRadius: 4 },

  // List
  list: { padding: 16, paddingTop: 8, paddingBottom: 40 },

  // Cliente card
  clienteCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  clienteLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  rotaIndicator: { width: 4, height: 48, borderRadius: 2 },
  clienteInfo: { flex: 1, gap: 3 },
  clienteNome: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  clienteEndereco: { fontSize: 12, color: '#94A3B8' },
  clienteTags: { flexDirection: 'row', gap: 6, marginTop: 2 },
  rotaTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  rotaTagText: { fontSize: 10, fontWeight: '700' },
  distTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#F1F5F9', borderRadius: 10 },
  distTagText: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  clienteRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coordsBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' },
  coordsBadgeOff: { backgroundColor: '#F8FAFC' },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#64748B' },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 280 },

  // Location banner
  locationBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFFBEB', paddingVertical: 8, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: '#FEF3C7',
  },
  locationText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
});
