import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, transformForMobile } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lastSyncAt, deviceId } = body

    if (!deviceId) {
      return apiError('Device ID is required', 400)
    }

    // Parse lastSyncAt if provided
    const lastSyncDate = lastSyncAt ? new Date(lastSyncAt) : new Date(0)

    // Fetch all entities updated since lastSync
    const [
      clientes,
      produtos,
      locacoes,
      cobrancas,
      rotas,
      usuarios,
      tiposProduto,
      descricoesProduto,
      tamanhosProduto,
      estabelecimentos,
      manutencoes,
      equipamentos,
    ] = await Promise.all([
      db.cliente.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
        include: { rota: true },
      }),
      db.produto.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
        include: { tipo: true, descricao: true, tamanho: true },
      }),
      db.locacao.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
        include: { cliente: true, produto: { include: { tipo: true, descricao: true, tamanho: true } } },
      }),
      db.historicoCobranca.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
        include: { locacao: true, cliente: true, registradoPor: true },
      }),
      db.rota.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
      db.usuario.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
      db.tipoProduto.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
      db.descricaoProduto.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
      db.tamanhoProduto.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
      db.estabelecimento.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
      db.manutencao.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
      db.equipamento.findMany({
        where: { updatedAt: { gt: lastSyncDate } },
      }),
    ])

    // Transform all entities for mobile compatibility
    const transformedData = {
      clientes: clientes.map(transformForMobile),
      produtos: produtos.map(transformForMobile),
      locacoes: locacoes.map(transformForMobile),
      cobrancas: cobrancas.map(transformForMobile),
      rotas: rotas.map(transformForMobile),
      usuarios: usuarios.map(u => {
        const { senha, ...userWithoutPassword } = u
        return transformForMobile(userWithoutPassword)
      }),
      tiposProduto: tiposProduto.map(transformForMobile),
      descricoesProduto: descricoesProduto.map(transformForMobile),
      tamanhosProduto: tamanhosProduto.map(transformForMobile),
      estabelecimentos: estabelecimentos.map(transformForMobile),
      manutencoes: manutencoes.map(transformForMobile),
      equipamentos: equipamentos.map(transformForMobile),
    }

    // Get unsynced change logs for this device
    const changeLogs = await db.changeLog.findMany({
      where: {
        deviceId: { not: deviceId },
        synced: false,
        timestamp: { gt: lastSyncDate },
      },
      orderBy: { timestamp: 'asc' },
    })

    // Mark change logs as synced
    if (changeLogs.length > 0) {
      await db.changeLog.updateMany({
        where: {
          id: { in: changeLogs.map(cl => cl.id) },
        },
        data: {
          synced: true,
          syncedAt: new Date(),
        },
      })
    }

    // Update sync metadata
    await db.syncMetadata.upsert({
      where: { key: `lastPull_${deviceId}` },
      create: {
        key: `lastPull_${deviceId}`,
        value: new Date().toISOString(),
      },
      update: {
        value: new Date().toISOString(),
      },
    })

    return apiResponse({
      success: true,
      timestamp: new Date().toISOString(),
      data: transformedData,
      changeLogs: changeLogs.map(cl => ({
        id: cl.id,
        entityId: cl.entityId,
        entityType: cl.entityType,
        operation: cl.operation,
        changes: JSON.parse(cl.changes),
        timestamp: cl.timestamp.toISOString(),
      })),
      counts: {
        clientes: transformedData.clientes.length,
        produtos: transformedData.produtos.length,
        locacoes: transformedData.locacoes.length,
        cobrancas: transformedData.cobrancas.length,
        rotas: transformedData.rotas.length,
        usuarios: transformedData.usuarios.length,
        tiposProduto: transformedData.tiposProduto.length,
        descricoesProduto: transformedData.descricoesProduto.length,
        tamanhosProduto: transformedData.tamanhosProduto.length,
        estabelecimentos: transformedData.estabelecimentos.length,
        manutencoes: transformedData.manutencoes.length,
        equipamentos: transformedData.equipamentos.length,
      },
    })
  } catch (error) {
    console.error('Sync pull error:', error)
    return apiError('Erro interno do servidor', 500)
  }
}
