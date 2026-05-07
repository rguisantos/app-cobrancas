import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/rotas - List all rotas
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)
    
    const { search, status } = params

    const where: any = {
      deletedAt: null,
    }

    if (search) {
      where.descricao = { contains: search }
    }

    if (status) {
      where.status = status
    }

    const [rotas, total] = await Promise.all([
      db.rota.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { clientes: { where: { deletedAt: null } } },
          },
        },
        orderBy: { descricao: 'asc' },
      }),
      db.rota.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: rotas.map(r => ({
        ...transformForMobile(r),
        totalClientes: r._count.clientes,
      })),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get rotas error:', error)
    return apiError('Erro ao buscar rotas', 500)
  }
}

// POST /api/rotas - Create new rota
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Validate required fields
    if (!data.descricao) {
      return apiError('Descrição é obrigatória', 400)
    }

    // Check for duplicate descricao
    const existingRota = await db.rota.findFirst({
      where: { descricao: data.descricao as string, deletedAt: null },
    })
    if (existingRota) {
      return apiError('Já existe uma rota com esta descrição', 400)
    }

    const rota = await db.rota.create({
      data: {
        descricao: data.descricao as string,
        status: (data.status as string) || 'Ativo',
        deviceId,
        version: 0,
      },
    })

    // Log the change
    await logChange(rota.id, 'rota', 'create', rota, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(rota),
    }, 201)
  } catch (error) {
    console.error('Create rota error:', error)
    return apiError('Erro ao criar rota', 500)
  }
}
