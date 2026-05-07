import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile, transformFromMobile, generateNumericPassword } from '@/lib/api-utils'

// GET /api/equipamentos/[id] - Get equipamento by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const equipamento = await db.equipamento.findUnique({
      where: { id },
    })

    if (!equipamento || equipamento.deletedAt) {
      return apiError('Equipamento não encontrado', 404)
    }

    return apiResponse({
      success: true,
      data: transformForMobile(equipamento),
    })
  } catch (error) {
    console.error('Get equipamento error:', error)
    return apiError('Erro ao buscar equipamento', 500)
  }
}

// PUT /api/equipamentos/[id] - Update equipamento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if equipamento exists
    const existingEquipamento = await db.equipamento.findUnique({
      where: { id },
    })

    if (!existingEquipamento || existingEquipamento.deletedAt) {
      return apiError('Equipamento não encontrado', 404)
    }

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Check for duplicate chave (excluding current equipamento)
    if (data.chave && data.chave !== existingEquipamento.chave) {
      const duplicate = await db.equipamento.findFirst({
        where: { 
          chave: data.chave as string, 
          deletedAt: null,
          NOT: { id },
        },
      })
      if (duplicate) {
        return apiError('Chave já cadastrada', 400)
      }
    }

    // Regenerate password if requested
    let senhaNumerica = existingEquipamento.senhaNumerica
    if (data.regenerarSenha) {
      senhaNumerica = generateNumericPassword()
    }

    const equipamento = await db.equipamento.update({
      where: { id },
      data: {
        nome: data.nome as string | undefined,
        chave: data.chave as string | undefined,
        senhaNumerica,
        tipo: data.tipo as string | undefined,
        status: data.status as string | undefined,
        ultimaSincronizacao: data.ultimaSincronizacao ? new Date(data.ultimaSincronizacao as string) : undefined,
        version: existingEquipamento.version + 1,
      },
    })

    // Log the change
    await logChange(equipamento.id, 'equipamento', 'update', equipamento, deviceId)

    return apiResponse({
      success: true,
      data: {
        ...transformForMobile(equipamento),
        senhaNumerica: data.regenerarSenha ? senhaNumerica : undefined,
      },
    })
  } catch (error) {
    console.error('Update equipamento error:', error)
    return apiError('Erro ao atualizar equipamento', 500)
  }
}

// DELETE /api/equipamentos/[id] - Soft delete equipamento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if equipamento exists
    const existingEquipamento = await db.equipamento.findUnique({
      where: { id },
    })

    if (!existingEquipamento || existingEquipamento.deletedAt) {
      return apiError('Equipamento não encontrado', 404)
    }

    // Soft delete
    const equipamento = await db.equipamento.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'inativo',
        version: existingEquipamento.version + 1,
      },
    })

    // Log the change
    await logChange(equipamento.id, 'equipamento', 'delete', { id }, deviceId)

    return apiResponse({
      success: true,
      message: 'Equipamento excluído com sucesso',
    })
  } catch (error) {
    console.error('Delete equipamento error:', error)
    return apiError('Erro ao excluir equipamento', 500)
  }
}
