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

// The shared SyncResponse is now the canonical type with proper typing.
// UpdatedVersion is also properly typed in shared/types.ts.
// No more duplicate declarations needed.

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE-SPECIFIC EXTENSIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface ManutencaoFilters {
  produtoId?: string;
  tipo?: 'trocaPano' | 'manutencao';
  dataInicio?: string;
  dataFim?: string;
}
