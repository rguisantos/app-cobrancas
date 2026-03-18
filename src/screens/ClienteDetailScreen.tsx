/**
 * ClienteDetailScreen.tsx
 * Tela de detalhes do cliente
 * 
 * Funcionalidades:
 * - Exibir dados completos do cliente
 * - Ações rápidas (ligar, WhatsApp, mapa, locações)
 * - Lista de contatos adicionais
 * - Informações de endereço
 * - Status do cliente
 * - Botões de editar e excluir (com permissão)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useCliente } from '../contexts/ClienteContext';
import { useLocacao } from '../contexts/LocacaoContext';

// Types
import { Cliente, Contato } from '../types';
import { ClientesStackNavigationProp } from '../navigation/ClientesStack';
import { ClientesStackParamList } from '../navigation/ClientesStack';

// Components
import { useClienteNavigate } from '../navigation/ClientesStack';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type ClienteDetailRouteProp = RouteProp<ClientesStackParamList, 'ClienteDetail'>;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function ClienteDetailScreen() {
  const route = useRoute<ClienteDetailRouteProp>();
  const navigation = useNavigation<ClientesStackNavigationProp>();
  const navigateCliente = useClienteNavigate();
  const { clienteSelecionado, carregarCliente, carregando, excluirCliente } = useCliente();
  const { carregarLocacoesPorCliente, locacoesAtivas } = useLocacao();
  const { user, hasPermission, canAccessRota } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      carregarCliente(route.params.clienteId);
      carregarLocacoesPorCliente(route.params.clienteId);
    }, [route.params.clienteId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarCliente(route.params.clienteId);
    await carregarLocacoesPorCliente(route.params.clienteId);
    setRefreshing(false);
  }, [route.params.clienteId]);

  // ==========================================================================
  // AÇÕES RÁPIDAS
  // ==========================================================================

  const handleLigar = useCallback((telefone: string) => {
    Linking.openURL(`tel:${telefone}`);
  }, []);

  const handleWhatsApp = useCallback((telefone: string) => {
    const numero = telefone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/55${numero}`);
  }, []);

  const handleMapa = useCallback((cliente: Cliente) => {
    const endereco = `${cliente.logradouro},${cliente.numero},${cliente.bairro},${cliente.cidade}-${cliente.estado}`;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`);
  }, []);

  const handleEditar = useCallback(() => {
    navigateCliente.toForm('editar', route.params.clienteId);
  }, [navigateCliente, route.params.clienteId]);

  const handleExcluir = useCallback(() => {    Alert.alert(
      'Excluir Cliente',
      `Tem certeza que deseja excluir ${clienteSelecionado?.nomeExibicao}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const sucesso = await excluirCliente(route.params.clienteId);
            if (sucesso) {
              navigation.goBack();
              Alert.alert('Sucesso', 'Cliente excluído');
            } else {
              Alert.alert('Erro', 'Não foi possível excluir o cliente');
          
  }
          },
        },
      ]
    );
  }, [clienteSelecionado, excluirCliente, route.params.clienteId, navigation]);

  // ==========================================================================
  // RENDERIZAÇÃO DE CONTATOS
  // ==========================================================================

  const renderContato = useCallback((contato: Contato, isPrincipal: boolean = false) => (
    <View key={contato.id || contato.nome} style={styles.contatoItem}>
      <View style={styles.contatoInfo}>
        {isPrincipal && (
          <View style={styles.badgePrincipal}>
            <Text style={styles.badgePrincipalText}>Principal</Text>
          </View>
        )}
        <Text style={styles.contatoNome}>{contato.nome}</Text>
        <Text style={styles.contatoTelefone}>{contato.telefone}</Text>
      </View>
      <View style={styles.contatoActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLigar(contato.telefone)}
        >
          <Ionicons name="call-outline" size={20} color="#2563EB" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleWhatsApp(contato.telefone)}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
        </TouchableOpacity>      </View>
    </View>
  ), [handleLigar, handleWhatsApp]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (carregando && !clienteSelecionado) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando cliente...</Text>
      </View>
    );

  }

  if (!clienteSelecionado) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-outline" size={64} color="#CBD5E1" />
        <Text style={styles.errorText}>Cliente não encontrado</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );

  }

  // Verificar permissão de acesso à rota
  if (user?.tipoPermissao !== 'Administrador' && !canAccessRota(clienteSelecionado.rotaId)) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
        <Text style={styles.errorText}>Você não tem acesso a este cliente</Text>
        <Text style={styles.errorSubtext}>Este cliente pertence a uma rota não permitida</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );

  }

  const canEdit = user?.tipoPermissao === 'Administrador' || hasPermission('todosCadastros', 'mobile');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
      
  }
      >
        {/* ========================================================================== */}
        {/* HEADER - PERFIL DO CLIENTE */}
        {/* ========================================================================== */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {clienteSelecionado.nomeExibicao.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.nome}>{clienteSelecionado.nomeExibicao}</Text>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: clienteSelecionado.status === 'Ativo' ? '#16A34A' : '#64748B' },
              ]}
            />
            <Text style={styles.statusText}>{clienteSelecionado.status}</Text>
          </View>
          {clienteSelecionado.tipoPessoa && (
            <Text style={styles.tipoPessoa}>
              {clienteSelecionado.tipoPessoa === 'Fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </Text>
          )}
        </View>

        {/* ========================================================================== */}
        {/* AÇÕES RÁPIDAS */}
        {/* ========================================================================== */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => handleLigar(clienteSelecionado.telefonePrincipal)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="call" size={24} color="#2563EB" />
            </View>
            <Text style={styles.actionText}>Ligar</Text>
          </TouchableOpacity>

          <TouchableOpacity            style={styles.actionCard}
            onPress={() => handleWhatsApp(clienteSelecionado.telefonePrincipal)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="logo-whatsapp" size={24} color="#16A34A" />
            </View>
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => handleMapa(clienteSelecionado)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="location" size={24} color="#EA580C" />
            </View>
            <Text style={styles.actionText}>Mapa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigateCliente.toLocacoes(clienteSelecionado.id)}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="cube" size={24} color="#9333EA" />
            </View>
            <Text style={styles.actionText}>Locações</Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================================== */}
        {/* CONTATOS */}
        {/* ========================================================================== */}
        {clienteSelecionado.contatos && clienteSelecionado.contatos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contatos</Text>
            <View style={styles.sectionCard}>
              {/* Telefone Principal */}
              <View style={styles.contatoItem}>
                <View style={styles.contatoInfo}>
                  <Text style={styles.contatoLabel}>Telefone Principal</Text>
                  <Text style={styles.contatoTelefone}>{clienteSelecionado.telefonePrincipal}</Text>
                </View>
                <View style={styles.contatoActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleLigar(clienteSelecionado.telefonePrincipal)}
                  >
                    <Ionicons name="call-outline" size={20} color="#2563EB" />
                  </TouchableOpacity>                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleWhatsApp(clienteSelecionado.telefonePrincipal)}
                  >
                    <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Contatos Adicionais */}
              {clienteSelecionado.contatos.map((contato) =>
                renderContato(contato, false)
              )}
            </View>
          </View>
        )}

        {/* ========================================================================== */}
        {/* INFORMAÇÕES GERAIS */}
        {/* ========================================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações Gerais</Text>
          <View style={styles.sectionCard}>
            {clienteSelecionado.cpfCnpj && (
              <View style={styles.infoRow}>
                <Ionicons name="finger-print" size={20} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>
                    {clienteSelecionado.tipoPessoa === 'Fisica' ? 'CPF' : 'CNPJ'}
                  </Text>
                  <Text style={styles.infoValue}>{clienteSelecionado.cpfCnpj}</Text>
                </View>
              </View>
            )}

            {clienteSelecionado.rgIe && (
              <View style={styles.infoRow}>
                <Ionicons name="document-outline" size={20} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>
                    {clienteSelecionado.tipoPessoa === 'Fisica' ? 'RG' : 'Inscrição Estadual'}
                  </Text>
                  <Text style={styles.infoValue}>{clienteSelecionado.rgIe}</Text>
                </View>
              </View>
            )}

            {clienteSelecionado.email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color="#64748B" />                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>E-mail</Text>
                  <Text style={styles.infoValue}>{clienteSelecionado.email}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ========================================================================== */}
        {/* ENDEREÇO */}
        {/* ========================================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Endereço</Text>
          <View style={styles.sectionCard}>
            {clienteSelecionado.rotaNome && (
              <View style={styles.infoRow}>
                <Ionicons name="map-outline" size={20} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Rota</Text>
                  <Text style={styles.infoValue}>{clienteSelecionado.rotaNome}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#64748B" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Logradouro</Text>
                <Text style={styles.infoValue}>
                  {clienteSelecionado.logradouro}, {clienteSelecionado.numero}
                </Text>
                {clienteSelecionado.complemento && (
                  <Text style={styles.infoValue}>{clienteSelecionado.complemento}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={20} color="#64748B" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Bairro</Text>
                <Text style={styles.infoValue}>{clienteSelecionado.bairro}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={20} color="#64748B" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Cidade/Estado</Text>                <Text style={styles.infoValue}>
                  {clienteSelecionado.cidade} - {clienteSelecionado.estado}
                </Text>
              </View>
            </View>

            {clienteSelecionado.cep && (
              <View style={styles.infoRow}>
                <Ionicons name="map-outline" size={20} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>CEP</Text>
                  <Text style={styles.infoValue}>{clienteSelecionado.cep}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ========================================================================== */}
        {/* LOCAÇÕES ATIVAS (Resumo) */}
        {/* ========================================================================== */}
        {locacoesAtivas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Locações Ativas ({locacoesAtivas.length})
            </Text>
            <View style={styles.sectionCard}>
              {locacoesAtivas.slice(0, 3).map((locacao) => (
                <TouchableOpacity
                  key={locacao.id}
                  style={styles.locacaoItem}
                  onPress={() => navigateCliente.navigation.navigate('LocacaoDetail', { locacaoId: String(locacao.id) })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locacaoProduto}>
                      {locacao.produtoTipo} N° {locacao.produtoIdentificador}
                    </Text>
                    <Text style={styles.locacaoData}>
                      Desde: {new Date(locacao.dataLocacao).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => navigateCliente.toLocacoes(String(clienteSelecionado.id))}
              >
                <Text style={styles.seeAllText}>
                  {locacoesAtivas.length > 3 ? `Ver todas (${locacoesAtivas.length})` : 'Gerenciar locações'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Espaço extra no final */}
        <View style={styles.footer} />
      </ScrollView>

      {/* ========================================================================== */}
      {/* BOTÕES DE AÇÃO (Editar/Excluir) */}
      {/* ========================================================================== */}
      {canEdit && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.bottomButton, styles.editButton]}
            onPress={handleEditar}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.bottomButtonText}>Editar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomButton, styles.deleteButton]}
            onPress={handleExcluir}
          >
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            <Text style={styles.bottomButtonText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 16,
  },
  errorContainer: {    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  backText: {
    marginTop: 16,
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Espaço para bottom actions
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },  nome: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  tipoPessoa: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },

  // Actions Section
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },

  // Sections
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

  // Contatos
  contatoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  contatoInfo: {
    flex: 1,
  },
  badgePrincipal: {
    backgroundColor: '#DBEAFE',    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgePrincipalText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  contatoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  contatoNome: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  contatoTelefone: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  contatoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoContent: {
    flex: 1,  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
  },

  // Locações
  locacaoItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  locacaoProduto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  locacaoData: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Footer
  footer: {
    height: 20,
  },

  // Bottom Actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  editButton: {
    backgroundColor: '#2563EB',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
  },
  bottomButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});