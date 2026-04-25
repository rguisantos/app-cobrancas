// packages/shared/src/constants.ts
// ============================================================================
// CONSTANTES COMPARTILHADAS - Web e Mobile
// ============================================================================

import type { EntityType, ConflictResolutionStrategy, SyncStatus } from './types'

// ============================================================================
// 🔄 ENTIDADES E SINCRONIZAÇÃO
// ============================================================================

/** Lista de todos os tipos de entidade suportados pelo sistema de sincronização */
export const ENTITY_TYPES: EntityType[] = [
  'cliente',
  'produto',
  'locacao',
  'cobranca',
  'rota',
  'usuario',
]

/** Estratégias de resolução de conflitos disponíveis */
export const SYNC_CONFLICT_STRATEGIES: ConflictResolutionStrategy[] = [
  'local',
  'remote',
  'newest',
  'manual',
]

/** Status possíveis de sincronização */
export const SYNC_STATUSES: SyncStatus[] = [
  'pending',
  'syncing',
  'synced',
  'conflict',
  'error',
]

/** Mapeamento de tipo de entidade para tabela no banco (pluralização) */
export const ENTITY_TABLE_MAP: Record<EntityType, string> = {
  cliente: 'clientes',
  produto: 'produtos',
  locacao: 'locacoes',
  cobranca: 'cobrancas',
  rota: 'rotas',
  usuario: 'usuarios',
}

/** Ordem de processamento por dependência (para sync push) */
export const SYNC_PROCESSING_ORDER: EntityType[] = [
  'rota',      // Sem dependências
  'cliente',   // Sem dependências (exceto rota)
  'produto',   // Sem dependências
  'locacao',   // Depende de cliente e produto
  'cobranca',  // Depende de locacao, cliente e produto
  'usuario',   // Sem dependências
]

// ============================================================================
// ⏱️ LIMITES E CONFIGURAÇÕES DE SINCRONIZAÇÃO
// ============================================================================

/** Número máximo de registros por entidade no pull (paginação) */
export const SYNC_PULL_LIMIT = 500

/** Limite de dias sem sincronizar para considerar device estale */
export const SYNC_STALE_THRESHOLD_DAYS = 30

/** Intervalo padrão de auto-sync em minutos */
export const DEFAULT_AUTO_SYNC_INTERVAL = 5

/** Número máximo de registros por sincronização */
export const DEFAULT_MAX_RECORDS_PER_SYNC = 500

// ============================================================================
// 🎨 CORES DE STATUS DE SINCRONIZAÇÃO
// ============================================================================

/** Cores para cada status de sincronização */
export const SYNC_STATUS_COLORS: Record<SyncStatus, string> = {
  pending: '#FFA500',
  syncing: '#2563EB',
  synced: '#22C55E',
  conflict: '#EF4444',
  error: '#EF4444',
}
