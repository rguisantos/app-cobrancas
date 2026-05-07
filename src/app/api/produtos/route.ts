import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/produtos - List all produtos
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)
    
    const { search, statusProduto, tipoId, conservacao } = params

    const where: any = {
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { identificador: { contains: search } },
        { numeroRelogio: { contains: search } },
        { codigoCH: { contains: search } },
        { codigoABLF: { contains: search } },
      ]
    }

    if (statusProduto) {
      where.statusProduto = statusProduto
    }

    if (tipoId) {
      where.tipoId = tipoId
    }

    if (conservacao) {
      where.conservacao = conservacao
    }

    const [produtos, total] = await Promise.all([
      db.produto.findMany({
        where,
        skip,
        take: limit,
        include: { 
          tipo: true, 
          descricao: true, 
          tamanho: true,
        },
        orderBy: { identificador: 'asc' },
      }),
      db.produto.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: produtos.map(transformForMobile),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get produtos error:', error)
    return apiError('Erro ao buscar produtos', 500)
  }
}

// POST /api/produtos - Create new produto
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Validate required fields
    if (!data.identificador) {
      return apiError('Identificador é obrigatório', 400)
    }

    // Check for duplicate identificador
    const existingProduto = await db.produto.findFirst({
      where: { identificador: data.identificador as string, deletedAt: null },
    })
    if (existingProduto) {
      return apiError('Identificador já cadastrado', 400)
    }

    const produto = await db.produto.create({
      data: {
        identificador: data.identificador as string,
        numeroRelogio: data.numeroRelogio as string | undefined,
        tipoId: data.tipoId as string | undefined,
        descricaoId: data.descricaoId as string | undefined,
        tamanhoId: data.tamanhoId as string | undefined,
        codigoCH: data.codigoCH as string | undefined,
        codigoABLF: data.codigoABLF as string | undefined,
        conservacao: (data.conservacao as string) || 'Boa',
        statusProduto: (data.statusProduto as string) || 'Ativo',
        dataFabricacao: data.dataFabricacao as Date | undefined,
        dataUltimaManutencao: data.dataUltimaManutencao as Date | undefined,
        relatorioUltimaManutencao: data.relatorioUltimaManutencao as string | undefined,
        dataAvaliacao: data.dataAvaliacao as Date | undefined,
        aprovacao: data.aprovacao as string | undefined,
        estabelecimento: data.estabelecimento as string | undefined,
        observacao: data.observacao as string | undefined,
        deviceId,
        version: 0,
      },
      include: { 
        tipo: true, 
        descricao: true, 
        tamanho: true,
      },
    })

    // Log the change
    await logChange(produto.id, 'produto', 'create', produto, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(produto),
    }, 201)
  } catch (error) {
    console.error('Create produto error:', error)
    return apiError('Erro ao criar produto', 500)
  }
}
