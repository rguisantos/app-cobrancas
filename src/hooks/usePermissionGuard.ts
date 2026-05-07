/**
 * usePermissionGuard.ts
 * Hook para verificação de permissões client-side
 *
 * Garante que ações sensíveis sejam verificadas no client ANTES de
 * fazer chamadas à API, alinhado com o permission filtering do backend.
 *
 * Uso:
 * const { canDo, checkPermission } = usePermissionGuard()
 * if (!canDo('clientes', 'create')) return
 */

import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { PermissoesMobile } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type MobilePermissionKey = keyof PermissoesMobile;
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';
export type PermissionEntity = 'clientes' | 'produtos' | 'alteracaoRelogio'
  | 'locacaoRelocacaoEstoque' | 'cobrancasFaturas' | 'manutencoes'
  | 'relatorios' | 'sincronizacao';

// Mapeamento de entidades para chaves de permissão mobile
const ENTITY_PERMISSION_MAP: Record<PermissionEntity, MobilePermissionKey> = {
  clientes: 'clientes',
  produtos: 'produtos',
  alteracaoRelogio: 'alteracaoRelogio',
  locacaoRelocacaoEstoque: 'locacaoRelocacaoEstoque',
  cobrancasFaturas: 'cobrancasFaturas',
  manutencoes: 'manutencoes',
  relatorios: 'relatorios',
  sincronizacao: 'sincronizacao',
};

// ============================================================================
// HOOK
// ============================================================================

export function usePermissionGuard() {
  const { user } = useAuth();

  /**
   * Verifica se o usuário tem permissão para acessar uma entidade
   */
  const hasPermission = useCallback(
    (entity: PermissionEntity): boolean => {
      if (!user) return false;

      // Administradores têm acesso total
      if (user.tipoPermissao === 'Administrador') return true;

      // Secretários têm acesso a quase tudo
      if (user.tipoPermissao === 'Secretario') return true;

      // AcessoControlado — verificar permissões granulares
      const permissionKey = ENTITY_PERMISSION_MAP[entity];
      if (!permissionKey) return false;

      return user.permissoes?.mobile?.[permissionKey] ?? false;
    },
    [user]
  );

  /**
   * Verifica permissão e executa ação, ou mostra alerta
   * Retorna true se a ação foi executada, false caso contrário
   */
  const canDo = useCallback(
    (entity: PermissionEntity, action: PermissionAction = 'view'): boolean => {
      if (!user) return false;
      return hasPermission(entity);
    },
    [hasPermission, user]
  );

  /**
   * Verifica se o usuário pode acessar uma rota específica
   * (Para usuários com AcessoControlado que têm rotas limitadas)
   */
  const canAccessRotaById = useCallback(
    (rotaId: string): boolean => {
      if (!user) return false;
      if (user.tipoPermissao === 'Administrador') return true;
      if (user.tipoPermissao === 'Secretario') return true;

      // AcessoControlado — verificar rotas permitidas
      const rotasPermitidas = user.rotasPermitidas || [];
      return rotasPermitidas.includes(rotaId);
    },
    [user]
  );

  return {
    hasPermission,
    canDo,
    canAccessRotaById,
    user,
    isAdmin: user?.tipoPermissao === 'Administrador',
    isSecretario: user?.tipoPermissao === 'Secretario',
    isAcessoControlado: user?.tipoPermissao === 'AcessoControlado',
  };
}
