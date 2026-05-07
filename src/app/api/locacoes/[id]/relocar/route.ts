import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile } from '@/lib/api-utils'

// POST /api/locacoes/[id]/relocar - Relocate product to another client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    const { novoClienteId, novoNumeroRelogio, observacao } = body

    if (!novoClienteId) {
      return apiError('Novo cliente é obrigatório', 400)
    }

    // Check if current locacao exists and is active
    const currentLocacao = await db.locacao.findUnique({
      where: { id },
      include: { produto: true, cliente: true },
    })

    if (!currentLocacao || currentLocacao.deletedAt) {
      return apiError('Locação não encontrada', 404)
    }

    if (currentLocacao.status !== 'Ativa') {
      return apiError('Apenas locações ativas podem ser relocadas', 400)
    }

    // Check if new client exists
    const novoCliente = await db.cliente.findUnique({
      where: { id: novoClienteId },
    })

    if (!novoCliente || novoCliente.deletedAt) {
      return apiError('Novo cliente não encontrado', 404)
    }

    // End current locacao
    const endedLocacao = await db.locacao.update({
      where: { id },
      data: {
        status: 'Finalizada',
        dataFim: new Date(),
        observacao: `${currentLocacao.observacao || ''}\n[RELOCADO para ${novoCliente.nomeExibicao}]`,
        version: currentLocacao.version + 1,
        deviceId,
      },
    })

    // Create new locacao for the same product
    const newLocacao = await db.locacao.create({
      data: {
        clienteId: novoClienteId,
        produtoId: currentLocacao.produtoId,
        dataLocacao: new Date(),
        formaPagamento: currentLocacao.formaPagamento,
        numeroRelogio: novoNumeroRelogio || currentLocacao.numeroRelogio,
        precoFicha: currentLocacao.precoFicha,
        percentualEmpresa: currentLocacao.percentualEmpresa,
        percentualCliente: currentLocacao.percentualCliente,
        periodicidade: currentLocacao.periodicidade,
        valorFixo: currentLocacao.valorFixo,
        observacao: observacao || `[RELOCADO de ${currentLocacao.cliente.nomeExibicao}]`,
        status: 'Ativa',
        deviceId,
        version: 0,
      },
      include: {
        cliente: true,
        produto: {
          include: { tipo: true, descricao: true, tamanho: true },
        },
      },
    })

    // Log the changes
    await logChange(endedLocacao.id, 'locacao', 'update', { action: 'relocate_end' }, deviceId)
    await logChange(newLocacao.id, 'locacao', 'create', { action: 'relocate_start' }, deviceId)

    return apiResponse({
      success: true,
      data: {
        locacaoAnterior: transformForMobile(endedLocacao),
        novaLocacao: transformForMobile(newLocacao),
      },
      message: 'Produto relocado com sucesso',
    })
  } catch (error) {
    console.error('Relocate error:', error)
    return apiError('Erro ao relocar produto', 500)
  }
}
