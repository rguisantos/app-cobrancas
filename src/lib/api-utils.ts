import { NextResponse } from 'next/server'
import { db } from './db'
import type { Prisma } from '@prisma/client'

// API Response helpers
export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// Transform entity for mobile compatibility (strings for IDs, etc.)
export function transformForMobile<T extends Record<string, unknown>>(entity: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(entity)) {
    if (value instanceof Date) {
      result[key] = value.toISOString()
    } else if (typeof value === 'number') {
      result[key] = value.toString()
    } else if (typeof value === 'boolean') {
      result[key] = value ? 1 : 0
    } else if (value === null) {
      result[key] = null
    } else {
      result[key] = value
    }
  }
  
  return result
}

// Transform from mobile format to Prisma format
export function transformFromMobile<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(data)) {
    // Handle boolean fields (0/1 from mobile)
    if (key.startsWith('permissoes') || key === 'bloqueado' || key === 'trocaPano' || key === 'synced') {
      if (value === 1 || value === '1' || value === true) {
        result[key] = true
      } else if (value === 0 || value === '0' || value === false) {
        result[key] = false
      } else {
        result[key] = value
      }
    }
    // Handle numeric fields
    else if (['version', 'precoFicha', 'percentualEmpresa', 'percentualCliente', 'valorFixo', 
              'ultimaLeituraRelogio', 'relogioAnterior', 'relogioAtual', 'fichasRodadas',
              'valorFicha', 'totalBruto', 'descontoPartidasQtd', 'descontoPartidasValor',
              'descontoDinheiro', 'subtotalAposDescontos', 'valorPercentual', 
              'totalClientePaga', 'valorRecebido', 'saldoDevedorGerado'].includes(key)) {
      if (value !== null && value !== undefined && value !== '') {
        result[key] = typeof value === 'string' ? parseFloat(value) : value
      }
    }
    // Handle date fields
    else if (['dataLocacao', 'dataFim', 'dataPrimeiraCobranca', 'dataUltimaCobranca', 
              'dataUltimaManutencao', 'dataFabricacao', 'dataUltimaManutencao', 
              'dataAvaliacao', 'dataInicio', 'dataFim', 'dataPagamento', 'dataVencimento',
              'data', 'createdAt', 'updatedAt', 'deletedAt', 'dataUltimoAcesso',
              'ultimaSincronizacao', 'dataCadastro', 'timestamp', 'syncedAt'].includes(key)) {
      if (value) {
        result[key] = new Date(value as string)
      }
    }
    else {
      result[key] = value
    }
  }
  
  return result
}

// Log changes for sync
export async function logChange(
  entityId: string,
  entityType: string,
  operation: 'create' | 'update' | 'delete',
  changes: Record<string, unknown>,
  deviceId: string
) {
  await db.changeLog.create({
    data: {
      entityId,
      entityType,
      operation,
      changes: JSON.stringify(changes),
      deviceId,
      synced: false,
    },
  })
}

// Get client IP from request
export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }
  return 'unknown'
}

// Generate 6-digit numeric password
export function generateNumericPassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Parse query params
export function parseQueryParams(request: Request) {
  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams.entries())
  return params
}

// Soft delete helper
export function softDelete<T extends { deletedAt: Date | null }>(entity: T): T | null {
  if (entity.deletedAt) {
    return null
  }
  return entity
}

// Filter out soft-deleted entities
export function filterActive<T extends { deletedAt: Date | null }>(entities: T[]): T[] {
  return entities.filter(e => !e.deletedAt)
}

// Pagination helper
export function getPagination(params: { page?: string; limit?: string }) {
  const page = parseInt(params.page || '1')
  const limit = parseInt(params.limit || '50')
  const skip = (page - 1) * limit
  
  return { page, limit, skip }
}

// Include relations helper for common entities
export const includeRelations = {
  cliente: {
    rota: true,
  },
  produto: {
    tipo: true,
    descricao: true,
    tamanho: true,
  },
  locacao: {
    cliente: true,
    produto: {
      include: {
        tipo: true,
        descricao: true,
        tamanho: true,
      },
    },
  },
  cobranca: {
    locacao: {
      include: {
        produto: true,
      },
    },
    cliente: true,
    registradoPor: true,
  },
}
