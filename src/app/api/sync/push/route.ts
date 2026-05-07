import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, transformFromMobile } from '@/lib/api-utils'

// Entity type mapping to Prisma models
const entityModels = {
  cliente: 'cliente',
  produto: 'produto',
  locacao: 'locacao',
  cobranca: 'historicoCobranca',
  rota: 'rota',
  usuario: 'usuario',
  tipoProduto: 'tipoProduto',
  descricaoProduto: 'descricaoProduto',
  tamanhoProduto: 'tamanhoProduto',
  estabelecimento: 'estabelecimento',
  manutencao: 'manutencao',
  equipamento: 'equipamento',
} as const

type EntityType = keyof typeof entityModels

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { changes, deviceId } = body

    if (!changes || !Array.isArray(changes)) {
      return apiError('Changes array is required', 400)
    }

    if (!deviceId) {
      return apiError('Device ID is required', 400)
    }

    const results = {
      applied: [] as string[],
      failed: [] as { id: string; error: string }[],
    }

    for (const change of changes) {
      try {
        const { entityId, entityType, operation, data } = change
        
        if (!entityId || !entityType || !operation) {
          results.failed.push({ id: change.id || 'unknown', error: 'Missing required fields' })
          continue
        }

        const modelName = entityModels[entityType as EntityType]
        if (!modelName) {
          results.failed.push({ id: entityId, error: `Unknown entity type: ${entityType}` })
          continue
        }

        // Transform data from mobile format
        const transformedData = data ? transformFromMobile(data) : {}

        // Apply the change
        switch (operation) {
          case 'create':
            await createEntity(modelName, entityId, transformedData, deviceId)
            break
          case 'update':
            await updateEntity(modelName, entityId, transformedData)
            break
          case 'delete':
            await deleteEntity(modelName, entityId)
            break
          default:
            results.failed.push({ id: entityId, error: `Unknown operation: ${operation}` })
            continue
        }

        // Create change log entry (marked as synced)
        await db.changeLog.create({
          data: {
            entityId,
            entityType,
            operation,
            changes: JSON.stringify(data || {}),
            deviceId,
            synced: true,
            syncedAt: new Date(),
          },
        })

        results.applied.push(entityId)
      } catch (error) {
        console.error('Error applying change:', error)
        results.failed.push({ 
          id: change.entityId || change.id || 'unknown', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    // Update sync metadata
    await db.syncMetadata.upsert({
      where: { key: `lastPush_${deviceId}` },
      create: {
        key: `lastPush_${deviceId}`,
        value: new Date().toISOString(),
      },
      update: {
        value: new Date().toISOString(),
      },
    })

    return apiResponse({
      success: true,
      applied: results.applied.length,
      failed: results.failed.length,
      results,
    })
  } catch (error) {
    console.error('Sync push error:', error)
    return apiError('Erro interno do servidor', 500)
  }
}

async function createEntity(modelName: string, entityId: string, data: Record<string, unknown>, deviceId: string) {
  const createData = {
    ...data,
    id: entityId,
    deviceId,
    version: 0,
  }

  switch (modelName) {
    case 'cliente':
      await db.cliente.create({ data: createData as any })
      break
    case 'produto':
      await db.produto.create({ data: createData as any })
      break
    case 'locacao':
      await db.locacao.create({ data: createData as any })
      break
    case 'historicoCobranca':
      await db.historicoCobranca.create({ data: createData as any })
      break
    case 'rota':
      await db.rota.create({ data: createData as any })
      break
    case 'usuario':
      await db.usuario.create({ data: createData as any })
      break
    case 'tipoProduto':
      await db.tipoProduto.create({ data: createData as any })
      break
    case 'descricaoProduto':
      await db.descricaoProduto.create({ data: createData as any })
      break
    case 'tamanhoProduto':
      await db.tamanhoProduto.create({ data: createData as any })
      break
    case 'estabelecimento':
      await db.estabelecimento.create({ data: createData as any })
      break
    case 'manutencao':
      await db.manutencao.create({ data: createData as any })
      break
    case 'equipamento':
      await db.equipamento.create({ data: createData as any })
      break
    default:
      throw new Error(`Unknown model: ${modelName}`)
  }
}

async function updateEntity(modelName: string, entityId: string, data: Record<string, unknown>) {
  const updateData = {
    ...data,
    updatedAt: new Date(),
  }

  // Increment version
  switch (modelName) {
    case 'cliente':
      const cliente = await db.cliente.findUnique({ where: { id: entityId } })
      if (cliente) {
        await db.cliente.update({
          where: { id: entityId },
          data: { ...updateData, version: cliente.version + 1 } as any,
        })
      }
      break
    case 'produto':
      const produto = await db.produto.findUnique({ where: { id: entityId } })
      if (produto) {
        await db.produto.update({
          where: { id: entityId },
          data: { ...updateData, version: produto.version + 1 } as any,
        })
      }
      break
    case 'locacao':
      const locacao = await db.locacao.findUnique({ where: { id: entityId } })
      if (locacao) {
        await db.locacao.update({
          where: { id: entityId },
          data: { ...updateData, version: locacao.version + 1 } as any,
        })
      }
      break
    case 'historicoCobranca':
      const cobranca = await db.historicoCobranca.findUnique({ where: { id: entityId } })
      if (cobranca) {
        await db.historicoCobranca.update({
          where: { id: entityId },
          data: { ...updateData, version: cobranca.version + 1 } as any,
        })
      }
      break
    case 'rota':
      const rota = await db.rota.findUnique({ where: { id: entityId } })
      if (rota) {
        await db.rota.update({
          where: { id: entityId },
          data: { ...updateData, version: rota.version + 1 } as any,
        })
      }
      break
    case 'usuario':
      const usuario = await db.usuario.findUnique({ where: { id: entityId } })
      if (usuario) {
        await db.usuario.update({
          where: { id: entityId },
          data: { ...updateData, version: usuario.version + 1 } as any,
        })
      }
      break
    case 'tipoProduto':
      const tipo = await db.tipoProduto.findUnique({ where: { id: entityId } })
      if (tipo) {
        await db.tipoProduto.update({
          where: { id: entityId },
          data: { ...updateData, version: tipo.version + 1 } as any,
        })
      }
      break
    case 'descricaoProduto':
      const desc = await db.descricaoProduto.findUnique({ where: { id: entityId } })
      if (desc) {
        await db.descricaoProduto.update({
          where: { id: entityId },
          data: { ...updateData, version: desc.version + 1 } as any,
        })
      }
      break
    case 'tamanhoProduto':
      const tam = await db.tamanhoProduto.findUnique({ where: { id: entityId } })
      if (tam) {
        await db.tamanhoProduto.update({
          where: { id: entityId },
          data: { ...updateData, version: tam.version + 1 } as any,
        })
      }
      break
    case 'estabelecimento':
      const est = await db.estabelecimento.findUnique({ where: { id: entityId } })
      if (est) {
        await db.estabelecimento.update({
          where: { id: entityId },
          data: { ...updateData, version: est.version + 1 } as any,
        })
      }
      break
    case 'manutencao':
      const manut = await db.manutencao.findUnique({ where: { id: entityId } })
      if (manut) {
        await db.manutencao.update({
          where: { id: entityId },
          data: { ...updateData, version: manut.version + 1 } as any,
        })
      }
      break
    case 'equipamento':
      const equip = await db.equipamento.findUnique({ where: { id: entityId } })
      if (equip) {
        await db.equipamento.update({
          where: { id: entityId },
          data: { ...updateData, version: equip.version + 1 } as any,
        })
      }
      break
    default:
      throw new Error(`Unknown model: ${modelName}`)
  }
}

async function deleteEntity(modelName: string, entityId: string) {
  const deleteData = {
    deletedAt: new Date(),
    updatedAt: new Date(),
  }

  switch (modelName) {
    case 'cliente':
      const cliente = await db.cliente.findUnique({ where: { id: entityId } })
      if (cliente) {
        await db.cliente.update({
          where: { id: entityId },
          data: { ...deleteData, version: cliente.version + 1 },
        })
      }
      break
    case 'produto':
      const produto = await db.produto.findUnique({ where: { id: entityId } })
      if (produto) {
        await db.produto.update({
          where: { id: entityId },
          data: { ...deleteData, version: produto.version + 1 },
        })
      }
      break
    case 'locacao':
      const locacao = await db.locacao.findUnique({ where: { id: entityId } })
      if (locacao) {
        await db.locacao.update({
          where: { id: entityId },
          data: { ...deleteData, version: locacao.version + 1 },
        })
      }
      break
    case 'historicoCobranca':
      const cobranca = await db.historicoCobranca.findUnique({ where: { id: entityId } })
      if (cobranca) {
        await db.historicoCobranca.update({
          where: { id: entityId },
          data: { ...deleteData, version: cobranca.version + 1 },
        })
      }
      break
    case 'rota':
      const rota = await db.rota.findUnique({ where: { id: entityId } })
      if (rota) {
        await db.rota.update({
          where: { id: entityId },
          data: { ...deleteData, version: rota.version + 1 },
        })
      }
      break
    case 'usuario':
      const usuario = await db.usuario.findUnique({ where: { id: entityId } })
      if (usuario) {
        await db.usuario.update({
          where: { id: entityId },
          data: { ...deleteData, version: usuario.version + 1 },
        })
      }
      break
    case 'tipoProduto':
      const tipo = await db.tipoProduto.findUnique({ where: { id: entityId } })
      if (tipo) {
        await db.tipoProduto.update({
          where: { id: entityId },
          data: { ...deleteData, version: tipo.version + 1 },
        })
      }
      break
    case 'descricaoProduto':
      const desc = await db.descricaoProduto.findUnique({ where: { id: entityId } })
      if (desc) {
        await db.descricaoProduto.update({
          where: { id: entityId },
          data: { ...deleteData, version: desc.version + 1 },
        })
      }
      break
    case 'tamanhoProduto':
      const tam = await db.tamanhoProduto.findUnique({ where: { id: entityId } })
      if (tam) {
        await db.tamanhoProduto.update({
          where: { id: entityId },
          data: { ...deleteData, version: tam.version + 1 },
        })
      }
      break
    case 'estabelecimento':
      const est = await db.estabelecimento.findUnique({ where: { id: entityId } })
      if (est) {
        await db.estabelecimento.update({
          where: { id: entityId },
          data: { ...deleteData, version: est.version + 1 },
        })
      }
      break
    case 'manutencao':
      const manut = await db.manutencao.findUnique({ where: { id: entityId } })
      if (manut) {
        await db.manutencao.update({
          where: { id: entityId },
          data: { ...deleteData, version: manut.version + 1 },
        })
      }
      break
    case 'equipamento':
      const equip = await db.equipamento.findUnique({ where: { id: entityId } })
      if (equip) {
        await db.equipamento.update({
          where: { id: entityId },
          data: { ...deleteData, version: equip.version + 1 },
        })
      }
      break
    default:
      throw new Error(`Unknown model: ${modelName}`)
  }
}
