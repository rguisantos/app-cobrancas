import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile, generateNumericPassword } from '@/lib/api-utils'

// GET /api/equipamentos - List all equipamentos
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)
    
    const { search, status } = params

    const where: any = {
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { nome: { contains: search } },
        { chave: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [equipamentos, total] = await Promise.all([
      db.equipamento.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
      }),
      db.equipamento.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: equipamentos.map(transformForMobile),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get equipamentos error:', error)
    return apiError('Erro ao buscar equipamentos', 500)
  }
}

// POST /api/equipamentos - Create new equipamento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Validate required fields
    if (!data.nome) {
      return apiError('Nome é obrigatório', 400)
    }

    if (!data.chave) {
      return apiError('Chave é obrigatória', 400)
    }

    // Check for duplicate chave
    const existingEquipamento = await db.equipamento.findFirst({
      where: { chave: data.chave as string, deletedAt: null },
    })
    if (existingEquipamento) {
      return apiError('Chave já cadastrada', 400)
    }

    // Generate 6-digit numeric password
    const senhaNumerica = generateNumericPassword()

    const equipamento = await db.equipamento.create({
      data: {
        nome: data.nome as string,
        chave: data.chave as string,
        senhaNumerica,
        tipo: (data.tipo as string) || 'Celular',
        status: (data.status as string) || 'nao_sincronizado',
        version: 0,
      },
    })

    // Log the change
    await logChange(equipamento.id, 'equipamento', 'create', equipamento, deviceId)

    return apiResponse({
      success: true,
      data: {
        ...transformForMobile(equipamento),
        senhaNumerica, // Include in response only on creation
      },
    }, 201)
  } catch (error) {
    console.error('Create equipamento error:', error)
    return apiError('Erro ao criar equipamento', 500)
  }
}
