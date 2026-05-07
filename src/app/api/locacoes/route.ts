import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/locacoes - List all locacoes
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)
    
    const { search, status, clienteId, produtoId } = params

    const where: any = {
      deletedAt: null,
    }

    if (status) {
      where.status = status
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    if (produtoId) {
      where.produtoId = produtoId
    }

    if (search) {
      where.OR = [
        { cliente: { nomeExibicao: { contains: search } } },
        { produto: { identificador: { contains: search } } },
      ]
    }

    const [locacoes, total] = await Promise.all([
      db.locacao.findMany({
        where,
        skip,
        take: limit,
        include: { 
          cliente: true, 
          produto: {
            include: { tipo: true, descricao: true, tamanho: true },
          },
        },
        orderBy: { dataLocacao: 'desc' },
      }),
      db.locacao.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: locacoes.map(transformForMobile),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get locacoes error:', error)
    return apiError('Erro ao buscar locações', 500)
  }
}

// POST /api/locacoes - Create new locacao
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Validate required fields
    if (!data.clienteId) {
      return apiError('Cliente é obrigatório', 400)
    }

    if (!data.produtoId) {
      return apiError('Produto é obrigatório', 400)
    }

    if (!data.dataLocacao) {
      return apiError('Data de locação é obrigatória', 400)
    }

    if (!data.formaPagamento) {
      return apiError('Forma de pagamento é obrigatória', 400)
    }

    // Check if cliente exists
    const cliente = await db.cliente.findUnique({
      where: { id: data.clienteId as string },
    })
    if (!cliente || cliente.deletedAt) {
      return apiError('Cliente não encontrado', 404)
    }

    // Check if produto exists and is available
    const produto = await db.produto.findUnique({
      where: { id: data.produtoId as string },
    })
    if (!produto || produto.deletedAt) {
      return apiError('Produto não encontrado', 404)
    }

    // Check if produto has active locacao
    const activeLocacao = await db.locacao.findFirst({
      where: {
        produtoId: data.produtoId as string,
        status: 'Ativa',
        deletedAt: null,
      },
    })
    if (activeLocacao) {
      return apiError('Produto já está locado para outro cliente', 400)
    }

    const locacao = await db.locacao.create({
      data: {
        clienteId: data.clienteId as string,
        produtoId: data.produtoId as string,
        dataLocacao: new Date(data.dataLocacao as string),
        dataFim: data.dataFim as Date | undefined,
        observacao: data.observacao as string | undefined,
        formaPagamento: data.formaPagamento as string,
        numeroRelogio: (data.numeroRelogio as string) || produto.numeroRelogio || '',
        precoFicha: (data.precoFicha as number) || 0,
        percentualEmpresa: (data.percentualEmpresa as number) || 50,
        percentualCliente: (data.percentualCliente as number) || 50,
        periodicidade: data.periodicidade as string | undefined,
        valorFixo: data.valorFixo as number | undefined,
        dataPrimeiraCobranca: data.dataPrimeiraCobranca as Date | undefined,
        status: 'Ativa',
        trocaPano: (data.trocaPano as boolean) || false,
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

    // Update produto status
    await db.produto.update({
      where: { id: data.produtoId as string },
      data: { statusProduto: 'Ativo' },
    })

    // Log the change
    await logChange(locacao.id, 'locacao', 'create', locacao, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(locacao),
    }, 201)
  } catch (error) {
    console.error('Create locacao error:', error)
    return apiError('Erro ao criar locação', 500)
  }
}
