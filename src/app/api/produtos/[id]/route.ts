import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/produtos/[id] - Get produto by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const produto = await db.produto.findUnique({
      where: { id },
      include: { 
        tipo: true, 
        descricao: true, 
        tamanho: true,
        locacoes: {
          where: { deletedAt: null, status: 'Ativa' },
          include: { cliente: true },
          take: 1,
        },
        manutencoes: {
          where: { deletedAt: null },
          orderBy: { data: 'desc' },
          take: 5,
        },
      },
    })

    if (!produto || produto.deletedAt) {
      return apiError('Produto não encontrado', 404)
    }

    // Get current active locacao if exists
    const locacaoAtiva = produto.locacoes.length > 0 ? produto.locacoes[0] : null

    return apiResponse({
      success: true,
      data: {
        ...transformForMobile(produto),
        locacaoAtiva: locacaoAtiva ? transformForMobile(locacaoAtiva) : null,
      },
    })
  } catch (error) {
    console.error('Get produto error:', error)
    return apiError('Erro ao buscar produto', 500)
  }
}

// PUT /api/produtos/[id] - Update produto
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if produto exists
    const existingProduto = await db.produto.findUnique({
      where: { id },
    })

    if (!existingProduto || existingProduto.deletedAt) {
      return apiError('Produto não encontrado', 404)
    }

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Check for duplicate identificador (excluding current produto)
    if (data.identificador && data.identificador !== existingProduto.identificador) {
      const duplicate = await db.produto.findFirst({
        where: { 
          identificador: data.identificador as string, 
          deletedAt: null,
          NOT: { id },
        },
      })
      if (duplicate) {
        return apiError('Identificador já cadastrado', 400)
      }
    }

    const produto = await db.produto.update({
      where: { id },
      data: {
        identificador: data.identificador as string | undefined,
        numeroRelogio: data.numeroRelogio as string | undefined,
        tipoId: data.tipoId as string | undefined,
        descricaoId: data.descricaoId as string | undefined,
        tamanhoId: data.tamanhoId as string | undefined,
        codigoCH: data.codigoCH as string | undefined,
        codigoABLF: data.codigoABLF as string | undefined,
        conservacao: data.conservacao as string | undefined,
        statusProduto: data.statusProduto as string | undefined,
        dataFabricacao: data.dataFabricacao as Date | undefined,
        dataUltimaManutencao: data.dataUltimaManutencao as Date | undefined,
        relatorioUltimaManutencao: data.relatorioUltimaManutencao as string | undefined,
        dataAvaliacao: data.dataAvaliacao as Date | undefined,
        aprovacao: data.aprovacao as string | undefined,
        estabelecimento: data.estabelecimento as string | undefined,
        observacao: data.observacao as string | undefined,
        version: existingProduto.version + 1,
        deviceId,
      },
      include: { 
        tipo: true, 
        descricao: true, 
        tamanho: true,
      },
    })

    // Log the change
    await logChange(produto.id, 'produto', 'update', produto, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(produto),
    })
  } catch (error) {
    console.error('Update produto error:', error)
    return apiError('Erro ao atualizar produto', 500)
  }
}

// DELETE /api/produtos/[id] - Soft delete produto
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if produto exists
    const existingProduto = await db.produto.findUnique({
      where: { id },
    })

    if (!existingProduto || existingProduto.deletedAt) {
      return apiError('Produto não encontrado', 404)
    }

    // Check for active locacoes
    const activeLocacoes = await db.locacao.count({
      where: {
        produtoId: id,
        status: 'Ativa',
        deletedAt: null,
      },
    })

    if (activeLocacoes > 0) {
      return apiError('Produto possui locações ativas. Finalize as locações antes de excluir.', 400)
    }

    // Soft delete
    const produto = await db.produto.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: existingProduto.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(produto.id, 'produto', 'delete', { id }, deviceId)

    return apiResponse({
      success: true,
      message: 'Produto excluído com sucesso',
    })
  } catch (error) {
    console.error('Delete produto error:', error)
    return apiError('Erro ao excluir produto', 500)
  }
}
