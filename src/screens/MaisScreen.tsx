/**
 * MaisScreen.tsx
 * Menu principal de configurações e acesso rápido
 */

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Linking,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth }     from '../contexts/AuthContext';
import { useSync }     from '../contexts/SyncContext';
import { useBranding } from '../components/BrandingProvider';
import { useDashboard } from '../contexts/DashboardContext';
import { AppTabsNavigationProp } from '../navigation/AppNavigator';
import { ENV }         from '../config/env';

// ─── cores por tipo de permissão ─────────────────────────────────────────────
const PERMISSAO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  Administrador:    { label: 'Administrador',     bg: '#FEF3C7', text: '#D97706' },
  Secretario:       { label: 'Secretário',         bg: '#DBEAFE', text: '#2563EB' },
  AcessoControlado: { label: 'Acesso Controlado',  bg: '#F0FDF4', text: '#16A34A' },
};

// ─── item do menu ─────────────────────────────────────────────────────────────
interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  badge?: number;
  danger?: boolean;
  onPress?: () => void;
}

function MenuItem({ icon, iconBg, iconColor, title, subtitle, badge, danger, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={s.menuItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[s.menuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={s.menuText}>
        <Text style={[s.menuTitle, danger && { color: '#DC2626' }]}>{title}</Text>
        {subtitle ? <Text style={s.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge != null && badge > 0 && (
        <View style={s.badge}><Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View>
      )}
      {onPress && <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />}
    </TouchableOpacity>
  );
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return <View style={s.group}>{children}</View>;
}

function Sep() { return <View style={s.sep} />; }

// ─── componente principal ────────────────────────────────────────────────────
export default function MaisScreen() {
  const navigation = useNavigation<AppTabsNavigationProp>();
  const { user, logout, isAdmin }    = useAuth();
  const { status, lastSyncAt, mudancasPendentes, sincronizar, isSyncing } = useSync();
  const { appName, primaryColor, supportEmail, companyName } = useBranding();
  const { refresh: refreshDashboard } = useDashboard();

  // Atualiza métricas ao focar nesta tab
  useFocusEffect(useCallback(() => { refreshDashboard(); }, [refreshDashboard]));

  const navModal = (screen: string) => {
    const parent = navigation.getParent();
    if (parent) (parent as any).navigate(screen);
  };

  const handleLogout = () => {
    Alert.alert('Sair do Aplicativo', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => logout() },
    ]);
  };

  const handleSync = async () => { await sincronizar(true); };

  const permCfg = PERMISSAO_CONFIG[user?.tipoPermissao ?? ''] ?? PERMISSAO_CONFIG.AcessoControlado;
  const lastSyncFormatted = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Nunca';

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Título */}
        <Text style={s.pageTitle}>Mais</Text>

        {/* Card do usuário */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user?.nome?.charAt(0).toUpperCase() ?? 'U'}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.nome ?? 'Usuário'}</Text>
            <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
            <View style={[s.permTag, { backgroundColor: permCfg.bg }]}>
              <Text style={[s.permTagText, { color: permCfg.text }]}>{permCfg.label}</Text>
            </View>
          </View>
        </View>

        {/* ── Gerenciamento (só admin) ─────────────────────── */}
        {(isAdmin() || user?.tipoPermissao === 'Administrador') && (<>
          <Text style={s.groupLabel}>GERENCIAMENTO</Text>
          <MenuGroup>
            <MenuItem icon="people"  iconBg="#F3E8FF" iconColor="#8B5CF6" title="Usuários"
              subtitle="Criar e gerenciar usuários" onPress={() => navModal('UsuariosGerenciar')} />
            <Sep />
            <MenuItem icon="map"     iconBg="#DBEAFE" iconColor="#2563EB" title="Rotas"
              subtitle="Rotas de cobrança" onPress={() => navModal('RotasGerenciar')} />
            <Sep />
            <MenuItem icon="cube"    iconBg="#DCFCE7" iconColor="#16A34A" title="Atributos de Produto"
              subtitle="Tipos, descrições e tamanhos" onPress={() => navModal('AtributosProdutoGerenciar')} />
            <Sep />
            <MenuItem icon="construct" iconBg="#FEF3C7" iconColor="#D97706" title="Manutenções"
              subtitle="Gerenciar manutenções" onPress={() => navModal('ManutencoesList')} />
            <Sep />
            <MenuItem icon="trophy" iconBg="#F3E8FF" iconColor="#8B5CF6" title="Metas"
              subtitle="Metas e objetivos" onPress={() => navModal('MetasList')} />
            <Sep />
            <MenuItem icon="business" iconBg="#ECFDF5" iconColor="#059669" title="Estabelecimentos"
              subtitle="Gerenciar estabelecimentos" onPress={() => navModal('EstabelecimentosList')} />

            {/* Relatórios */}
            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 }} />
            <MenuItem icon="construct" iconBg="#F0FDF4" iconColor="#16A34A"
              title="Relatório de Manutenções"
              subtitle="Histórico de trocas de pano" onPress={() => navModal('RelatorioManutencao')} />
            <MenuItem
              icon="stats-chart"
              iconBg="#EFF6FF"
              iconColor="#2563EB"
              title="Relatório de Cobranças"
              subtitle="Resumo, período e rotas unificado"
              onPress={() => navModal('RelatorioCobrancas')}
            />
            <MenuItem icon="warning"          iconBg="#FEF2F2" iconColor="#DC2626"
              title="Saldo Devedor"
              subtitle="Clientes com pagamento em aberto" onPress={() => navModal('RelatorioSaldoDevedor')} />
            <Sep />
            <MenuItem icon="alert-circle"     iconBg="#FEF2F2" iconColor="#DC2626"
              title="Inadimplência"
              subtitle="Cobranças vencidas por cliente e rota" onPress={() => navModal('RelatorioInadimplencia')} />
            <Sep />
            <MenuItem icon="cube-outline"     iconBg="#DCFCE7" iconColor="#16A34A"
              title="Estoque"
              subtitle="Produtos disponíveis para locação" onPress={() => navModal('RelatorioEstoque')} />
            <Sep />
            <MenuItem icon="cash-outline"     iconBg="#F0FDF4" iconColor="#16A34A"
              title="Recebimentos"
              subtitle="Cobranças pagas por período" onPress={() => navModal('RelatorioRecebimentos')} />
          </MenuGroup>
        </>)}

        {/* ── Busca Global (todos os usuários) ─────────── */}
        <Text style={s.groupLabel}>BUSCA</Text>
        <MenuGroup>
          <MenuItem icon="search" iconBg="#EFF6FF" iconColor="#2563EB"
            title="Busca Global"
            subtitle="Pesquisar clientes, produtos, cobranças..."
            onPress={() => navModal('BuscaGlobal')} />
        </MenuGroup>

        {/* ── Funcionalidades ─────────────────────────────── */}
        <Text style={s.groupLabel}>FUNCIONALIDADES</Text>
        <MenuGroup>
          <MenuItem icon="notifications" iconBg="#DBEAFE" iconColor="#2563EB" title="Notificações"
            subtitle="Central de notificações" badge={0}
            onPress={() => navModal('Notificacoes')} />
          <Sep />
          <MenuItem icon="calendar" iconBg="#FEF3C7" iconColor="#D97706" title="Agenda"
            subtitle="Agenda e compromissos" onPress={() => navModal('Agenda')} />
        </MenuGroup>

        {/* ── Sincronização ───────────────────────────────── */}
        <Text style={s.groupLabel}>SINCRONIZAÇÃO</Text>
        <MenuGroup>
          <MenuItem
            icon={isSyncing ? 'sync' : status === 'synced' ? 'checkmark-circle' : 'cloud-download'}
            iconBg={status === 'synced' ? '#DCFCE7' : '#DBEAFE'}
            iconColor={status === 'synced' ? '#16A34A' : '#2563EB'}
            title={isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            subtitle={`Última: ${lastSyncFormatted}`}
            badge={mudancasPendentes > 0 ? mudancasPendentes : undefined}
            onPress={isSyncing ? undefined : handleSync}
          />
          <Sep />
          <MenuItem icon="information-circle" iconBg="#FEF3C7" iconColor="#D97706"
            title="Status da Sincronização" subtitle="Ver detalhes e conflitos"
            onPress={() => navModal('SyncStatus')} />
        </MenuGroup>

        {/* ── Configurações ───────────────────────────────── */}
        <Text style={s.groupLabel}>CONFIGURAÇÕES</Text>
        <MenuGroup>
          <MenuItem icon="settings" iconBg="#F1F5F9" iconColor="#64748B"
            title="Configurações" subtitle="Preferências do aplicativo"
            onPress={() => navModal('Settings')} />
        </MenuGroup>

        {/* ── Suporte ─────────────────────────────────────── */}
        <Text style={s.groupLabel}>SUPORTE</Text>
        <MenuGroup>
          <MenuItem icon="help-circle" iconBg="#EFF6FF" iconColor="#2563EB"
            title="Central de Ajuda" subtitle="Dúvidas e suporte técnico"
            onPress={() => supportEmail && Linking.openURL(`mailto:${supportEmail}`)} />
          <Sep />
          <MenuItem icon="chatbubble-ellipses" iconBg="#F0FDF4" iconColor="#16A34A"
            title="Enviar Feedback" subtitle="Sugestões e melhorias"
            onPress={() => supportEmail && Linking.openURL(`mailto:${supportEmail}?subject=Feedback`)} />
        </MenuGroup>

        {/* ── Sobre ───────────────────────────────────────── */}
        <Text style={s.groupLabel}>SOBRE</Text>
        <MenuGroup>
          <MenuItem icon="information-circle" iconBg="#F8FAFC" iconColor="#94A3B8"
            title={appName} subtitle={`Versão ${ENV.APP_VERSION}`}
            onPress={() => Alert.alert(appName, `Versão: ${ENV.APP_VERSION}\n\n${companyName}\n\n© ${new Date().getFullYear()}`)} />
        </MenuGroup>

        {/* ── Sessão ──────────────────────────────────────── */}
        <Text style={s.groupLabel}>SESSÃO</Text>
        <MenuGroup>
          <MenuItem icon="log-out" iconBg="#FEF2F2" iconColor="#DC2626"
            title="Sair do Aplicativo" subtitle="Encerrar sessão atual"
            danger onPress={handleLogout} />
        </MenuGroup>

        {/* Footer */}
        <Text style={s.footer}>{companyName} © {new Date().getFullYear()} · v{ENV.APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F1F5F9' },
  scroll:       { padding: 16, paddingBottom: 32 },
  pageTitle:    { fontSize: 28, fontWeight: '800', color: '#1E293B', marginBottom: 16 },

  // Profile card
  profileCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 24, gap: 14, elevation: 2 },
  avatar:       { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  profileInfo:  { flex: 1 },
  profileName:  { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  profileEmail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  permTag:      { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
  permTagText:  { fontSize: 11, fontWeight: '700' },

  // Groups
  groupLabel:   { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 8, marginLeft: 4, marginTop: 4 },
  group:        { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 1 },
  sep:          { height: 1, backgroundColor: '#F1F5F9', marginLeft: 62 },

  // Menu item
  menuItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuIcon:     { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuText:     { flex: 1 },
  menuTitle:    { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  menuSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  badge:        { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText:    { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  footer:       { textAlign: 'center', fontSize: 11, color: '#CBD5E1', marginTop: 8 },
});
