import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/tipos-produto - List all tipos
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

    const [tipos, total] = await Promise.all([
      db.tipoProduto.findMany({
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
      db.tipoProduto.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: tipos.map(t => ({
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
    console.error('Get tipos-produto error:', error)
    return apiError('Erro ao buscar tipos de produto', 500)
  }
}

// POST /api/tipos-produto - Create new tipo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    const data = transformFromMobile(body)

    if (!data.nome) {
      return apiError('Nome é obrigatório', 400)
    }

    // Check for duplicate
    const existing = await db.tipoProduto.findFirst({
      where: { nome: data.nome as string, deletedAt: null },
    })
    if (existing) {
      return apiError('Tipo já cadastrado', 400)
    }

    const tipo = await db.tipoProduto.create({
      data: {
        nome: data.nome as string,
        deviceId,
        version: 0,
      },
    })

    await logChange(tipo.id, 'tipoProduto', 'create', tipo, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(tipo),
    }, 201)
  } catch (error) {
    console.error('Create tipo-produto error:', error)
    return apiError('Erro ao criar tipo de produto', 500)
  }
}
