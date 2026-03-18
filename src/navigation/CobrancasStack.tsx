/**
 * CobrancasStack.tsx
 * Fluxo completo de cobranças:
 *   CobrancasList → RotasCobranca → ClientesRota → CobrancaCliente → ConfirmacaoPagamento
 */

import React, { useCallback } from 'react';
import { Alert, TouchableOpacity, useColorScheme } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons }      from '@expo/vector-icons';
import { useAuth }       from '../contexts/AuthContext';
import { StatusPagamento } from '../types';

import CobrancasListScreen        from '../screens/CobrancasListScreen';
import RotasCobrancaScreen        from '../screens/RotasCobrancaScreen';
import ClientesRotaScreen         from '../screens/ClientesRotaScreen';
import CobrancaClienteScreen      from '../screens/CobrancaClienteScreen';
import ConfirmacaoPagamentoScreen from '../screens/ConfirmacaoPagamentoScreen';
import CobrancaDetailScreen       from '../screens/CobrancaDetailScreen';
import HistoricoCobrancaScreen    from '../screens/HistoricoCobrancaScreen';
import QuitacaoSaldoScreen        from '../screens/QuitacaoSaldoScreen';
import ClienteDetailScreen        from '../screens/ClienteDetailScreen';

// ============================================================================
// TIPOS
// ============================================================================

/** Pacote de dados passado de CobrancaCliente → ConfirmacaoPagamento */
export interface DadosCobrancaParam {
  locacaoId:             string;
  clienteId:             string;
  clienteNome:           string;
  produtoIdentificador:  string;
  produtoTipo:           string;
  formaPagamento:        string;
  percentualEmpresa:     number;
  precoFicha:            number;
  relogioAnterior:       number;
  relogioAtual:          number;
  fichasRodadas:         number;
  valorFicha:            number;
  totalBruto:            number;
  descontoPartidasQtd:   number;
  descontoPartidasValor: number;
  descontoDinheiro:      number;
  subtotalAposDescontos: number;
  valorPercentual:       number;
  totalClientePaga:      number;
  valorRecebido:         number;
  dataInicio:            string;
  observacao:            string;
  saldoAnterior:         number; // saldo devedor pendente da locação
}

export type CobrancasStackParamList = {
  CobrancasList:          { filtroRota?: string | number; filtroStatus?: StatusPagamento; filtroCliente?: string };
  RotasCobranca:          undefined;
  ClientesRota:           { rotaId: string | number; rotaNome: string };
  CobrancaCliente:        { clienteId: string; clienteNome: string; rotaId: string | number };
  ConfirmacaoPagamento:   { dados: DadosCobrancaParam };
  CobrancaDetail:         { cobrancaId: string; locacaoId?: string };
  CobrancaConfirm:        { locacaoId: string; cobrancaId?: string; modo: 'nova' | 'editar' | 'parcial' };
  HistoricoCobranca:      { clienteId: string; produtoId?: string };
  ClienteDetail:          { clienteId: string };
  QuitacaoSaldo: {
    locacaoId: string;
    clienteId: string;
    clienteNome: string;
    produtoIdentificador: string;
  };
};

const Stack = createNativeStackNavigator<CobrancasStackParamList>();

// ============================================================================
// STACK
// ============================================================================

export default function CobrancasStack() {
  const { user, hasPermission } = useAuth();
  const colorScheme             = useColorScheme();

  const headerTheme = {
    headerStyle:      { backgroundColor: colorScheme === 'dark' ? '#1565C0' : '#1976D2' },
    headerTintColor:  '#FFFFFF',
    headerTitleStyle: { fontWeight: '600' as const, color: '#FFFFFF' as const },
    contentStyle:     { backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F0F0F0' },
  };

  const canCobrar = () =>
    !!user && (user.tipoPermissao === 'Administrador' || hasPermission('cobrancasFaturas', 'mobile'));

  return (
    <Stack.Navigator
      initialRouteName="CobrancasList"
      screenOptions={{ ...headerTheme, animation: 'slide_from_right', gestureEnabled: true }}
    >
      <Stack.Screen name="CobrancasList"        component={CobrancasListScreen}        options={{ headerShown: false }} />
      <Stack.Screen name="RotasCobranca"         component={RotasCobrancaScreen}        options={{ title: 'Rotas' }} />
      <Stack.Screen name="ClientesRota"          component={ClientesRotaScreen}         options={({ route }) => ({ title: route.params.rotaNome })} />
      <Stack.Screen name="CobrancaCliente"       component={CobrancaClienteScreen}      options={({ route }) => ({ title: route.params.clienteNome })} />
      <Stack.Screen name="ConfirmacaoPagamento"  component={ConfirmacaoPagamentoScreen} options={{ title: 'Confirmação Pagamento' }} />

      <Stack.Screen
        name="CobrancaDetail"
        component={CobrancaDetailScreen}
        options={({ route, navigation }) => ({
          title: 'Detalhes da Cobrança',
          headerRight: () =>
            canCobrar() && route.params.locacaoId ? (
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() => navigation.navigate('CobrancaConfirm', {
                  locacaoId: route.params.locacaoId!,
                  cobrancaId: route.params.cobrancaId,
                  modo: 'parcial',
                })}
              >
                <Ionicons name="create-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null,
        })}
      />

      <Stack.Screen name="HistoricoCobranca" component={HistoricoCobrancaScreen} options={{ title: 'Histórico de Cobranças' }} />
      <Stack.Screen
        name="QuitacaoSaldo"
        component={QuitacaoSaldoScreen}
        options={{ title: 'Quitação de Saldo' }}
      />
      <Stack.Screen name="ClienteDetail"     component={ClienteDetailScreen}     options={{ title: 'Detalhes do Cliente' }} />
    </Stack.Navigator>
  );
}

// ============================================================================
// HOOK DE NAVEGAÇÃO
// ============================================================================

export function useCobrancaNavigate() {
  const navigation = useNavigation<NativeStackNavigationProp<CobrancasStackParamList>>();
  const { user, hasPermission, canAccessRota } = useAuth();

  const toList = useCallback(() => navigation.navigate('CobrancasList', {}), [navigation]);

  const toRotas = useCallback(() => navigation.navigate('RotasCobranca'), [navigation]);

  const toClientesRota = useCallback((rotaId: string | number, rotaNome: string) => {
    if (user?.tipoPermissao !== 'Administrador' && !canAccessRota(rotaId)) {
      Alert.alert('Acesso negado', 'Você não tem permissão para esta rota');
      return;
    }
    navigation.navigate('ClientesRota', { rotaId, rotaNome });
  }, [navigation, user, canAccessRota]);

  const toCobrancaCliente = useCallback((clienteId: string, clienteNome: string, rotaId: string | number) => {
    navigation.navigate('CobrancaCliente', { clienteId, clienteNome, rotaId });
  }, [navigation]);

  const toConfirmacao = useCallback((dados: DadosCobrancaParam) => {
    navigation.navigate('ConfirmacaoPagamento', { dados });
  }, [navigation]);

  const toDetail = useCallback((cobrancaId: string, locacaoId?: string) => {
    navigation.navigate('CobrancaDetail', { cobrancaId, locacaoId });
  }, [navigation]);

  const toHistorico = useCallback((clienteId: string, produtoId?: string) => {
    if (!hasPermission('cobrancasFaturas', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para ver histórico');
      return;
    }
    navigation.navigate('HistoricoCobranca', { clienteId, produtoId });
  }, [navigation, hasPermission, user]);

  const toCliente = useCallback((clienteId: string) => {
    navigation.navigate('ClienteDetail', { clienteId });
  }, [navigation]);

  // alias legado usado em CobrancasListScreen
  const toConfirm = useCallback((locacaoId: string, modo: 'nova' | 'editar' | 'parcial' = 'nova', cobrancaId?: string) => {
    if (!hasPermission('cobrancasFaturas', 'mobile') && user?.tipoPermissao !== 'Administrador') {
      Alert.alert('Aviso', 'Você não tem permissão para realizar cobranças');
      return;
    }
    navigation.navigate('CobrancaConfirm', { locacaoId, cobrancaId, modo });
  }, [navigation, hasPermission, user]);

  return { toList, toRotas, toClientesRota, toCobrancaCliente, toConfirmacao, toDetail, toHistorico, toCliente, toConfirm, navigation };
}

// ============================================================================
// FILTROS
// ============================================================================

export const COBRANCA_FILTROS = {
  STATUS: [
    { label: 'Todas',     value: undefined },
    { label: 'Pendentes', value: 'Pendente' as StatusPagamento },
    { label: 'Pagas',     value: 'Pago'     as StatusPagamento },
    { label: 'Parciais',  value: 'Parcial'  as StatusPagamento },
    { label: 'Atrasadas', value: 'Atrasado' as StatusPagamento },
  ],
};

export type CobrancasStackNavigationProp = NativeStackNavigationProp<CobrancasStackParamList>;
