import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile } from '@/lib/api-utils'

// POST /api/locacoes/[id]/enviar-estoque - Send product to stock
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    const { estabelecimento, observacao } = body

    // Check if locacao exists and is active
    const currentLocacao = await db.locacao.findUnique({
      where: { id },
      include: { produto: true, cliente: true },
    })

    if (!currentLocacao || currentLocacao.deletedAt) {
      return apiError('Locação não encontrada', 404)
    }

    if (currentLocacao.status !== 'Ativa') {
      return apiError('Apenas locações ativas podem ser enviadas para estoque', 400)
    }

    // End current locacao
    const endedLocacao = await db.locacao.update({
      where: { id },
      data: {
        status: 'Finalizada',
        dataFim: new Date(),
        observacao: `${currentLocacao.observacao || ''}\n[ENVIADO PARA ESTOQUE${estabelecimento ? ` - ${estabelecimento}` : ''}]`,
        version: currentLocacao.version + 1,
        deviceId,
      },
    })

    // Update produto status and location
    const updatedProduto = await db.produto.update({
      where: { id: currentLocacao.produtoId },
      data: {
        statusProduto: 'Ativo',
        estabelecimento: estabelecimento || currentLocacao.produto.estabelecimento,
        observacao: `${currentLocacao.produto.observacao || ''}\n[Retornado ao estoque em ${new Date().toLocaleDateString('pt-BR')}]`,
        version: currentLocacao.produto.version + 1,
        deviceId,
      },
    })

    // Create maintenance record if needed
    const manutencoesPendentes = await db.manutencao.count({
      where: {
        produtoId: currentLocacao.produtoId,
        tipo: 'manutencao',
        deletedAt: null,
      },
    })

    // Log the changes
    await logChange(endedLocacao.id, 'locacao', 'update', { action: 'send_to_stock' }, deviceId)
    await logChange(updatedProduto.id, 'produto', 'update', { action: 'returned_to_stock' }, deviceId)

    return apiResponse({
      success: true,
      data: {
        locacao: transformForMobile(endedLocacao),
        produto: transformForMobile(updatedProduto),
      },
      message: 'Produto enviado para estoque com sucesso',
      manutencoesPendentes,
    })
  } catch (error) {
    console.error('Send to stock error:', error)
    return apiError('Erro ao enviar produto para estoque', 500)
  }
}
