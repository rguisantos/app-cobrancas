import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/cobrancas/[id] - Get cobranca by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const cobranca = await db.historicoCobranca.findUnique({
      where: { id },
      include: { 
        locacao: {
          include: { produto: true },
        },
        cliente: true,
        registradoPor: true,
      },
    })

    if (!cobranca || cobranca.deletedAt) {
      return apiError('Cobrança não encontrada', 404)
    }

    return apiResponse({
      success: true,
      data: transformForMobile(cobranca),
    })
  } catch (error) {
    console.error('Get cobranca error:', error)
    return apiError('Erro ao buscar cobrança', 500)
  }
}

// PUT /api/cobrancas/[id] - Update cobranca
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if cobranca exists
    const existingCobranca = await db.historicoCobranca.findUnique({
      where: { id },
    })

    if (!existingCobranca || existingCobranca.deletedAt) {
      return apiError('Cobrança não encontrada', 404)
    }

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Recalculate totals if needed
    let updateData: any = {
      dataInicio: data.dataInicio ? new Date(data.dataInicio as string) : undefined,
      dataFim: data.dataFim ? new Date(data.dataFim as string) : undefined,
      dataPagamento: data.dataPagamento !== undefined ? (data.dataPagamento ? new Date(data.dataPagamento as string) : null) : undefined,
      relogioAnterior: data.relogioAnterior as number | undefined,
      relogioAtual: data.relogioAtual as number | undefined,
      fichasRodadas: data.fichasRodadas as number | undefined,
      valorFicha: data.valorFicha as number | undefined,
      totalBruto: data.totalBruto as number | undefined,
      descontoPartidasQtd: data.descontoPartidasQtd as number | undefined,
      descontoPartidasValor: data.descontoPartidasValor as number | undefined,
      descontoDinheiro: data.descontoDinheiro as number | undefined,
      percentualEmpresa: data.percentualEmpresa as number | undefined,
      subtotalAposDescontos: data.subtotalAposDescontos as number | undefined,
      valorPercentual: data.valorPercentual as number | undefined,
      totalClientePaga: data.totalClientePaga as number | undefined,
      valorRecebido: data.valorRecebido as number | undefined,
      saldoDevedorGerado: data.saldoDevedorGerado as number | undefined,
      status: data.status as string | undefined,
      dataVencimento: data.dataVencimento !== undefined ? (data.dataVencimento ? new Date(data.dataVencimento as string) : null) : undefined,
      observacao: data.observacao as string | undefined,
      version: existingCobranca.version + 1,
      deviceId,
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    const cobranca = await db.historicoCobranca.update({
      where: { id },
      data: updateData,
      include: { 
        locacao: {
          include: { produto: true },
        },
        cliente: true,
        registradoPor: true,
      },
    })

    // Log the change
    await logChange(cobranca.id, 'cobranca', 'update', cobranca, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(cobranca),
    })
  } catch (error) {
    console.error('Update cobranca error:', error)
    return apiError('Erro ao atualizar cobrança', 500)
  }
}

// DELETE /api/cobrancas/[id] - Soft delete cobranca
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if cobranca exists
    const existingCobranca = await db.historicoCobranca.findUnique({
      where: { id },
    })

    if (!existingCobranca || existingCobranca.deletedAt) {
      return apiError('Cobrança não encontrada', 404)
    }

    // Soft delete
    const cobranca = await db.historicoCobranca.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: existingCobranca.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(cobranca.id, 'cobranca', 'delete', { id }, deviceId)

    return apiResponse({
      success: true,
      message: 'Cobrança excluída com sucesso',
    })
  } catch (error) {
    console.error('Delete cobranca error:', error)
    return apiError('Erro ao excluir cobrança', 500)
  }
}
