import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/descricoes-produto - List all descricoes
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)

    const where: any = {
      deletedAt: null,
    }

    if (params.search) {
      where.nome = { contains: params.search }
    }

    const [descricoes, total] = await Promise.all([
      db.descricaoProduto.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { produtos: { where: { deletedAt: null } } },
          },
        },
        orderBy: { nome: 'asc' },
      }),
      db.descricaoProduto.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: descricoes.map(d => ({
        ...transformForMobile(d),
        totalProdutos: d._count.produtos,
      })),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get descricoes-produto error:', error)
    return apiError('Erro ao buscar descrições de produto', 500)
  }
}

// POST /api/descricoes-produto - Create new descricao
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    const data = transformFromMobile(body)

    if (!data.nome) {
      return apiError('Nome é obrigatório', 400)
    }

    // Check for duplicate
    const existing = await db.descricaoProduto.findFirst({
      where: { nome: data.nome as string, deletedAt: null },
    })
    if (existing) {
      return apiError('Descrição já cadastrada', 400)
    }

    const descricao = await db.descricaoProduto.create({
      data: {
        nome: data.nome as string,
        deviceId,
        version: 0,
      },
    })

    await logChange(descricao.id, 'descricaoProduto', 'create', descricao, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(descricao),
    }, 201)
  } catch (error) {
    console.error('Create descricao-produto error:', error)
    return apiError('Erro ao criar descrição de produto', 500)
  }
}
