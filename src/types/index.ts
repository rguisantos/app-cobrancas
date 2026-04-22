// src/types/index.ts
// ============================================================================
// SISTEMA DE GESTÃO DE LOCAÇÃO - TIPOS TYPESCRIPT
// ============================================================================
// Este arquivo re-exporta os tipos do @cobrancas/shared (pacote local)
// e adiciona extensões específicas do mobile.
// ============================================================================

// Re-exportar tudo do pacote compartilhado
export * from '../../shared'

// ─────────────────────────────────────────────────────────────────────────────
// EXTENSÕES ESPECÍFICAS DO MOBILE
// ─────────────────────────────────────────────────────────────────────────────

import type { SyncConflict as _SyncConflict } from '../../shared'

// O SyncResponse do mobile inclui campos de paginação e versões atualizadas
// que o shared não tem (são específicos da API mobile).
export interface UpdatedVersion {
  entityId: string;
  entityType: string;
  newVersion: number;
}

export interface SyncResponse {
  success: boolean;
  lastSyncAt: string;
  hasMore?: boolean;
  isStale?: boolean;
  changes?: {
    clientes?: any[];
    produtos?: any[];
    locacoes?: any[];
    cobrancas?: any[];
    rotas?: any[];
    usuarios?: any[];
  };
  conflicts?: _SyncConflict[];
  errors?: string[];
  updatedVersions?: UpdatedVersion[];
  clientes?: any[];
  produtos?: any[];
  locacoes?: any[];
  cobrancas?: any[];
  rotas?: any[];
  tiposProduto?: any[];
  descricoesProduto?: any[];
  tamanhosProduto?: any[];
}
