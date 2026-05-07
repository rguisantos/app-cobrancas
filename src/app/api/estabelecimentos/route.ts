import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/estabelecimentos - List all estabelecimentos
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

    const [estabelecimentos, total] = await Promise.all([
      db.estabelecimento.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
      }),
      db.estabelecimento.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: estabelecimentos.map(transformForMobile),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get estabelecimentos error:', error)
    return apiError('Erro ao buscar estabelecimentos', 500)
  }
}

// POST /api/estabelecimentos - Create new estabelecimento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    const data = transformFromMobile(body)

    if (!data.nome) {
      return apiError('Nome é obrigatório', 400)
    }

    // Check for duplicate
    const existing = await db.estabelecimento.findFirst({
      where: { nome: data.nome as string, deletedAt: null },
    })
    if (existing) {
      return apiError('Estabelecimento já cadastrado', 400)
    }

    const estabelecimento = await db.estabelecimento.create({
      data: {
        nome: data.nome as string,
        deviceId,
        version: 0,
      },
    })

    await logChange(estabelecimento.id, 'estabelecimento', 'create', estabelecimento, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(estabelecimento),
    }, 201)
  } catch (error) {
    console.error('Create estabelecimento error:', error)
    return apiError('Erro ao criar estabelecimento', 500)
  }
}
