import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/rotas/[id] - Get rota by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const rota = await db.rota.findUnique({
      where: { id },
      include: {
        clientes: {
          where: { deletedAt: null },
          orderBy: { nomeExibicao: 'asc' },
        },
      },
    })

    if (!rota || rota.deletedAt) {
      return apiError('Rota não encontrada', 404)
    }

    return apiResponse({
      success: true,
      data: transformForMobile(rota),
    })
  } catch (error) {
    console.error('Get rota error:', error)
    return apiError('Erro ao buscar rota', 500)
  }
}

// PUT /api/rotas/[id] - Update rota
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if rota exists
    const existingRota = await db.rota.findUnique({
      where: { id },
    })

    if (!existingRota || existingRota.deletedAt) {
      return apiError('Rota não encontrada', 404)
    }

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Check for duplicate descricao (excluding current rota)
    if (data.descricao && data.descricao !== existingRota.descricao) {
      const duplicate = await db.rota.findFirst({
        where: { 
          descricao: data.descricao as string, 
          deletedAt: null,
          NOT: { id },
        },
      })
      if (duplicate) {
        return apiError('Já existe uma rota com esta descrição', 400)
      }
    }

    const rota = await db.rota.update({
      where: { id },
      data: {
        descricao: data.descricao as string | undefined,
        status: data.status as string | undefined,
        version: existingRota.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(rota.id, 'rota', 'update', rota, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(rota),
    })
  } catch (error) {
    console.error('Update rota error:', error)
    return apiError('Erro ao atualizar rota', 500)
  }
}

// DELETE /api/rotas/[id] - Soft delete rota
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if rota exists
    const existingRota = await db.rota.findUnique({
      where: { id },
    })

    if (!existingRota || existingRota.deletedAt) {
      return apiError('Rota não encontrada', 404)
    }

    // Check for clients assigned to this rota
    const clientsCount = await db.cliente.count({
      where: {
        rotaId: id,
        deletedAt: null,
      },
    })

    if (clientsCount > 0) {
      return apiError('Rota possui clientes vinculados. Remova os vínculos antes de excluir.', 400)
    }

    // Soft delete
    const rota = await db.rota.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: existingRota.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(rota.id, 'rota', 'delete', { id }, deviceId)

    return apiResponse({
      success: true,
      message: 'Rota excluída com sucesso',
    })
  } catch (error) {
    console.error('Delete rota error:', error)
    return apiError('Erro ao excluir rota', 500)
  }
}
