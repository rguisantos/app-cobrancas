// packages/shared/src/utils.ts
// ============================================================================
// UTILITÁRIOS COMPARTILHADOS - Web e Mobile
// ============================================================================

import type { Produto, SyncStatus } from './types'
import { SYNC_STATUS_COLORS } from './constants'

/**
 * Retorna o nome de exibição do produto (ex: "Bilhar N° 515")
 */
export function getProdutoNome(produto: Pick<Produto, 'tipoNome' | 'identificador'>): string {
  return `${produto.tipoNome} N° ${produto.identificador}`
}

/**
 * Formata um valor numérico como moeda brasileira (BRL)
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

/**
 * Retorna saudação baseada na hora do dia
 */
export function getSaudacao(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Retorna a cor associada a um status de sincronização
 */
export function getSyncStatusColor(status: SyncStatus): string {
  return SYNC_STATUS_COLORS[status]
}
