import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/tamanhos-produto - List all tamanhos
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

    const [tamanhos, total] = await Promise.all([
      db.tamanhoProduto.findMany({
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
      db.tamanhoProduto.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: tamanhos.map(t => ({
        ...transformForMobile(t),
        totalProdutos: t._count.produtos,
      })),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get tamanhos-produto error:', error)
    return apiError('Erro ao buscar tamanhos de produto', 500)
  }
}

// POST /api/tamanhos-produto - Create new tamanho
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    const data = transformFromMobile(body)

    if (!data.nome) {
      return apiError('Nome é obrigatório', 400)
    }

    // Check for duplicate
    const existing = await db.tamanhoProduto.findFirst({
      where: { nome: data.nome as string, deletedAt: null },
    })
    if (existing) {
      return apiError('Tamanho já cadastrado', 400)
    }

    const tamanho = await db.tamanhoProduto.create({
      data: {
        nome: data.nome as string,
        deviceId,
        version: 0,
      },
    })

    await logChange(tamanho.id, 'tamanhoProduto', 'create', tamanho, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(tamanho),
    }, 201)
  } catch (error) {
    console.error('Create tamanho-produto error:', error)
    return apiError('Erro ao criar tamanho de produto', 500)
  }
}
