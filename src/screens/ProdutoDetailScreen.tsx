/**
 * ProdutoDetailScreen.tsx
 * Tela de detalhes do produto
 * 
 * Funcionalidades:
 * - Exibir dados completos do produto
 * - Situação atual (locado/disponível/manutenção)
 * - Ações rápidas (editar, alterar relógio, locar, enviar estoque)
 * - Histórico de locações
 * - Informações de manutenção
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Contexts
import { useAuth } from '../contexts/AuthContext';
import { useProduto } from '../contexts/ProdutoContext';
import { useLocacao } from '../contexts/LocacaoContext';

// Types
import { Produto, StatusProduto } from '../types';
import { ProdutosStackNavigationProp } from '../navigation/ProdutosStack';
import { ProdutosStackParamList } from '../navigation/ProdutosStack';

// Components
import { useProdutoNavigate } from '../navigation/ProdutosStack';

// ============================================================================
// TIPOS DE ROTA
// ============================================================================

type ProdutoDetailRouteProp = RouteProp<ProdutosStackParamList, 'ProdutoDetail'>;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function ProdutoDetailScreen() {
  const route = useRoute<ProdutoDetailRouteProp>();
  const navigation = useNavigation<ProdutosStackNavigationProp>();
  const navigateProduto = useProdutoNavigate();
  const { produtoSelecionado, carregarProduto, carregando, excluirProduto } = useProduto();
  const { locacoesAtivas, carregarLocacoesPorProduto } = useLocacao();
  const { user, hasPermission } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  useEffect(() => {
    carregarProduto(route.params.produtoId);
    carregarLocacoesPorProduto(route.params.produtoId);
  }, [route.params.produtoId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarProduto(route.params.produtoId);
    await carregarLocacoesPorProduto(route.params.produtoId);
    setRefreshing(false);
  }, [route.params.produtoId]);

  // ==========================================================================
  // AÇÕES RÁPIDAS
  // ==========================================================================

  const handleEditar = useCallback(() => {
    navigateProduto.toForm('editar', route.params.produtoId);
  }, [navigateProduto, route.params.produtoId]);

  const handleAlterarRelogio = useCallback(() => {
    navigateProduto.toAlterarRelogio(route.params.produtoId);
  }, [navigateProduto, route.params.produtoId]);

  const handleNovaLocacao = useCallback(() => {
    navigateProduto.toNovaLocacao(route.params.produtoId);
  }, [navigateProduto, route.params.produtoId]);

  const handleEnviarEstoque = useCallback(() => {
    if (produtoSelecionado?.locacaoAtiva) {
      navigateProduto.toEnviarEstoque(produtoSelecionado.locacaoAtiva.locacaoId, route.params.produtoId);
    }
  }, [navigateProduto, produtoSelecionado, route.params.produtoId]);

  const handleExcluir = useCallback(() => {
    Alert.alert(      'Excluir Produto',
      `Tem certeza que deseja excluir ${produtoSelecionado?.tipoNome} N° ${produtoSelecionado?.identificador}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const sucesso = await excluirProduto(route.params.produtoId);
            if (sucesso) {
              navigation.goBack();
              Alert.alert('Sucesso', 'Produto excluído');
            } else {
              Alert.alert('Erro', 'Não foi possível excluir o produto');
            }
          },
        },
      ]
    );
  }, [produtoSelecionado, excluirProduto, route.params.produtoId, navigation]);

  // ==========================================================================
  // RENDERIZAÇÃO DE LOCAÇÕES
  // ==========================================================================

  const renderLocacaoAtiva = useCallback(() => {
    if (!produtoSelecionado?.locacaoAtiva) return null;

    const locacao = produtoSelecionado.locacaoAtiva;

    return (
      <View style={styles.locacaoCard}>
        <View style={styles.locacaoHeader}>
          <Ionicons name="cube" size={20} color="#2563EB" />
          <Text style={styles.locacaoTitle}>Produto Locado</Text>
        </View>

        <View style={styles.locacaoInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue}>{locacao.clienteNome}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Desde</Text>
            <Text style={styles.infoValue}>
              {new Date(locacao.dataInicio).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.locacaoButton}
          onPress={() => {
            // Navegar para detalhes da locação ou cliente
          }}
        >
          <Text style={styles.locacaoButtonText}>Ver detalhes</Text>
          <Ionicons name="chevron-forward" size={16} color="#2563EB" />
        </TouchableOpacity>
      </View>
    );
  }, [produtoSelecionado]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (carregando && !produtoSelecionado) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando produto...</Text>
      </View>
    );
  }

  if (!produtoSelecionado) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cube-outline" size={64} color="#CBD5E1" />
        <Text style={styles.errorText}>Produto não encontrado</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canEdit = user?.tipoPermissao === 'Administrador' || hasPermission('todosCadastros', 'mobile');
  const canAlterarRelogio = user?.tipoPermissao === 'Administrador' || hasPermission('alteracaoRelogio', 'mobile');
  const canLocar = user?.tipoPermissao === 'Administrador' || hasPermission('locacaoRelocacaoEstoque', 'mobile');

  // Configuração do status
  const statusConfig = {
    Ativo: { color: '#16A34A', bg: '#F0FDF4', label: 'Ativo' },
    Inativo: { color: '#64748B', bg: '#F1F5F9', label: 'Inativo' },
    Manutenção: { color: '#EA580C', bg: '#FFFBEB', label: 'Em Manutenção' },
  };
  const status = statusConfig[produtoSelecionado.statusProduto as keyof typeof statusConfig] || statusConfig.Ativo;
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      >
        {/* ========================================================================== */}
        {/* HEADER - IDENTIFICAÇÃO DO PRODUTO */}
        {/* ========================================================================== */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="cube" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.nome}>
            {produtoSelecionado.tipoNome} N° {produtoSelecionado.identificador}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* ========================================================================== */}
        {/* LOCAÇÃO ATIVA (se houver) */}
        {/* ========================================================================== */}
        {renderLocacaoAtiva()}

        {/* ========================================================================== */}
        {/* AÇÕES RÁPIDAS */}
        {/* ========================================================================== */}
        <View style={styles.actionsSection}>
          {canEdit && (
            <TouchableOpacity style={styles.actionCard} onPress={handleEditar}>
              <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="create" size={24} color="#2563EB" />
              </View>
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>
          )}

          {canAlterarRelogio && (
            <TouchableOpacity style={styles.actionCard} onPress={handleAlterarRelogio}>              <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="timer" size={24} color="#EA580C" />
              </View>
              <Text style={styles.actionText}>Relógio</Text>
            </TouchableOpacity>
          )}

          {canLocar && !produtoSelecionado.locacaoAtiva && produtoSelecionado.statusProduto === 'Ativo' && (
            <TouchableOpacity style={styles.actionCard} onPress={handleNovaLocacao}>
              <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="add-circle" size={24} color="#16A34A" />
              </View>
              <Text style={styles.actionText}>Locar</Text>
            </TouchableOpacity>
          )}

          {canLocar && produtoSelecionado.locacaoAtiva && (
            <TouchableOpacity style={styles.actionCard} onPress={handleEnviarEstoque}>
              <View style={[styles.actionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="arrow-undo" size={24} color="#DB2777" />
              </View>
              <Text style={styles.actionText}>Estoque</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================================== */}
        {/* CARACTERÍSTICAS */}
        {/* ========================================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Características</Text>
          <View style={styles.sectionCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Descrição</Text>
              <Text style={styles.infoValue}>{produtoSelecionado.descricaoNome || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tamanho</Text>
              <Text style={styles.infoValue}>{produtoSelecionado.tamanhoNome || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Conservação</Text>
              <Text style={styles.infoValue}>{produtoSelecionado.conservacao || '-'}</Text>
            </View>
            {produtoSelecionado.codigoCH && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Código CH</Text>
                <Text style={styles.infoValue}>{produtoSelecionado.codigoCH}</Text>
              </View>
            )}            {produtoSelecionado.codigoABLF && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Código ABLF</Text>
                <Text style={styles.infoValue}>{produtoSelecionado.codigoABLF}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ========================================================================== */}
        {/* CONTADOR/RELÓGIO */}
        {/* ========================================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contador</Text>
          <View style={styles.sectionCard}>
            <View style={styles.relogioContainer}>
              <Ionicons name="timer-outline" size={32} color="#2563EB" />
              <View style={styles.relogioInfo}>
                <Text style={styles.relogioLabel}>Número do Relógio</Text>
                <Text style={styles.relogioValue}>{produtoSelecionado.numeroRelogio}</Text>
              </View>
            </View>
            {canAlterarRelogio && (
              <TouchableOpacity style={styles.alterarRelogioButton} onPress={handleAlterarRelogio}>
                <Text style={styles.alterarRelogioText}>Alterar número</Text>
                <Ionicons name="chevron-forward" size={16} color="#2563EB" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ========================================================================== */}
        {/* MANUTENÇÃO */}
        {/* ========================================================================== */}
        {(produtoSelecionado.dataUltimaManutencao || produtoSelecionado.observacao) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Manutenção</Text>
            <View style={styles.sectionCard}>
              {produtoSelecionado.dataUltimaManutencao && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Última Manutenção</Text>
                  <Text style={styles.infoValue}>
                    {new Date(produtoSelecionado.dataUltimaManutencao).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              )}
              {produtoSelecionado.dataFabricacao && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Data de Fabricação</Text>
                  <Text style={styles.infoValue}>                    {new Date(produtoSelecionado.dataFabricacao).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              )}
              {produtoSelecionado.relatorioUltimaManutencao && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Relatório</Text>
                  <Text style={styles.infoValue}>{produtoSelecionado.relatorioUltimaManutencao}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ========================================================================== */}
        {/* OBSERVAÇÕES */}
        {/* ========================================================================== */}
        {produtoSelecionado.observacao && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.observacaoText}>{produtoSelecionado.observacao}</Text>
            </View>
          </View>
        )}

        {/* ========================================================================== */}
        {/* HISTÓRICO DE LOCAÇÕES (Resumo) */}
        {/* ========================================================================== */}
        {locacoesAtivas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Locações Recentes ({locacoesAtivas.length})
            </Text>
            <View style={styles.sectionCard}>
              {locacoesAtivas.slice(0, 3).map((locacao, index) => (
                <View key={locacao.id || index} style={styles.locacaoHistoricoItem}>
                  <Text style={styles.locacaoHistoricoCliente}>{locacao.clienteNome}</Text>
                  <Text style={styles.locacaoHistoricoData}>
                    {new Date(locacao.dataLocacao).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              ))}
              {locacoesAtivas.length > 3 && (
                <TouchableOpacity style={styles.seeAllButton}>
                  <Text style={styles.seeAllText}>Ver histórico completo</Text>
                  <Ionicons name="chevron-forward" size={16} color="#2563EB" />
                </TouchableOpacity>
              )}
            </View>          </View>
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
    color: '#64748B',    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
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
    paddingBottom: 100,
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
  nome: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',    alignItems: 'center',
    gap: 8,
    marginTop: 12,
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
  },

  // Locação Card
  locacaoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  locacaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  locacaoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  locacaoInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  locacaoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  locacaoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
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
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },  actionText: {
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

  // Relógio
  relogioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  relogioInfo: {
    flex: 1,
  },
  relogioLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  relogioValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  alterarRelogioButton: {
    flexDirection: 'row',
    alignItems: 'center',    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  alterarRelogioText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },

  // Observações
  observacaoText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },

  // Histórico de Locações
  locacaoHistoricoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  locacaoHistoricoCliente: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  locacaoHistoricoData: {
    fontSize: 12,
    color: '#64748B',
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
    left: 0,
    right: 0,
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