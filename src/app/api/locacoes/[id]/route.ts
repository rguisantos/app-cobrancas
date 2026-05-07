import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/locacoes/[id] - Get locacao by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const locacao = await db.locacao.findUnique({
      where: { id },
      include: { 
        cliente: true, 
        produto: {
          include: { tipo: true, descricao: true, tamanho: true },
        },
        cobrancas: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!locacao || locacao.deletedAt) {
      return apiError('Locação não encontrada', 404)
    }

    return apiResponse({
      success: true,
      data: transformForMobile(locacao),
    })
  } catch (error) {
    console.error('Get locacao error:', error)
    return apiError('Erro ao buscar locação', 500)
  }
}

// PUT /api/locacoes/[id] - Update locacao
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if locacao exists
    const existingLocacao = await db.locacao.findUnique({
      where: { id },
    })

    if (!existingLocacao || existingLocacao.deletedAt) {
      return apiError('Locação não encontrada', 404)
    }

    // Transform data from mobile format
    const data = transformFromMobile(body)

    const locacao = await db.locacao.update({
      where: { id },
      data: {
        dataLocacao: data.dataLocacao ? new Date(data.dataLocacao as string) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim as string) : undefined,
        observacao: data.observacao as string | undefined,
        formaPagamento: data.formaPagamento as string | undefined,
        numeroRelogio: data.numeroRelogio as string | undefined,
        precoFicha: data.precoFicha as number | undefined,
        percentualEmpresa: data.percentualEmpresa as number | undefined,
        percentualCliente: data.percentualCliente as number | undefined,
        periodicidade: data.periodicidade as string | undefined,
        valorFixo: data.valorFixo as number | undefined,
        dataPrimeiraCobranca: data.dataPrimeiraCobranca ? new Date(data.dataPrimeiraCobranca as string) : undefined,
        status: data.status as string | undefined,
        ultimaLeituraRelogio: data.ultimaLeituraRelogio as number | undefined,
        dataUltimaCobranca: data.dataUltimaCobranca ? new Date(data.dataUltimaCobranca as string) : undefined,
        trocaPano: data.trocaPano as boolean | undefined,
        dataUltimaManutencao: data.dataUltimaManutencao ? new Date(data.dataUltimaManutencao as string) : undefined,
        version: existingLocacao.version + 1,
        deviceId,
      },
      include: { 
        cliente: true, 
        produto: {
          include: { tipo: true, descricao: true, tamanho: true },
        },
      },
    })

    // Log the change
    await logChange(locacao.id, 'locacao', 'update', locacao, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(locacao),
    })
  } catch (error) {
    console.error('Update locacao error:', error)
    return apiError('Erro ao atualizar locação', 500)
  }
}

// DELETE /api/locacoes/[id] - Soft delete locacao
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if locacao exists
    const existingLocacao = await db.locacao.findUnique({
      where: { id },
    })

    if (!existingLocacao || existingLocacao.deletedAt) {
      return apiError('Locação não encontrada', 404)
    }

    // Check for pending cobrancas
    const pendingCobrancas = await db.historicoCobranca.count({
      where: {
        locacaoId: id,
        status: 'Pendente',
        deletedAt: null,
      },
    })

    if (pendingCobrancas > 0) {
      return apiError('Locação possui cobranças pendentes. Resolva as cobranças antes de excluir.', 400)
    }

    // Soft delete
    const locacao = await db.locacao.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'Cancelada',
        version: existingLocacao.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(locacao.id, 'locacao', 'delete', { id }, deviceId)

    return apiResponse({
      success: true,
      message: 'Locação excluída com sucesso',
    })
  } catch (error) {
    console.error('Delete locacao error:', error)
    return apiError('Erro ao excluir locação', 500)
  }
}
