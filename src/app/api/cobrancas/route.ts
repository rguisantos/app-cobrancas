import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/cobrancas - List all cobrancas
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)
    
    const { search, status, clienteId, locacaoId, dataInicio, dataFim } = params

    const where: any = {
      deletedAt: null,
    }

    if (status) {
      where.status = status
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    if (locacaoId) {
      where.locacaoId = locacaoId
    }

    if (dataInicio || dataFim) {
      where.dataInicio = {}
      if (dataInicio) {
        where.dataInicio.gte = new Date(dataInicio)
      }
      if (dataFim) {
        where.dataInicio.lte = new Date(dataFim)
      }
    }

    if (search) {
      where.OR = [
        { cliente: { nomeExibicao: { contains: search } } },
        { locacao: { produto: { identificador: { contains: search } } } },
      ]
    }

    const [cobrancas, total] = await Promise.all([
      db.historicoCobranca.findMany({
        where,
        skip,
        take: limit,
        include: { 
          locacao: {
            include: { produto: true },
          },
          cliente: true,
          registradoPor: true,
        },
        orderBy: { dataInicio: 'desc' },
      }),
      db.historicoCobranca.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: cobrancas.map(transformForMobile),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get cobrancas error:', error)
    return apiError('Erro ao buscar cobranças', 500)
  }
}

// POST /api/cobrancas - Create new cobranca
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'
    const userId = request.headers.get('x-user-id')

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Validate required fields
    if (!data.locacaoId) {
      return apiError('Locação é obrigatória', 400)
    }

    if (!data.clienteId) {
      return apiError('Cliente é obrigatório', 400)
    }

    if (!data.dataInicio) {
      return apiError('Data de início é obrigatória', 400)
    }

    if (!data.dataFim) {
      return apiError('Data de fim é obrigatória', 400)
    }

    // Check if locacao exists and is active
    const locacao = await db.locacao.findUnique({
      where: { id: data.locacaoId as string },
      include: { produto: true },
    })

    if (!locacao || locacao.deletedAt) {
      return apiError('Locação não encontrada', 404)
    }

    // Check if cliente exists
    const cliente = await db.cliente.findUnique({
      where: { id: data.clienteId as string },
    })

    if (!cliente || cliente.deletedAt) {
      return apiError('Cliente não encontrado', 404)
    }

    // Calculate totals
    const fichasRodadas = ((data.relogioAtual as number) || 0) - ((data.relogioAnterior as number) || 0)
    const totalBruto = fichasRodadas * ((data.valorFicha as number) || locacao.precoFicha)
    const descontoTotal = ((data.descontoPartidasValor as number) || 0) + ((data.descontoDinheiro as number) || 0)
    const subtotalAposDescontos = totalBruto - descontoTotal
    const valorPercentual = subtotalAposDescontos * (((data.percentualEmpresa as number) || locacao.percentualEmpresa) / 100)
    const totalClientePaga = subtotalAposDescontos - valorPercentual

    const cobranca = await db.historicoCobranca.create({
      data: {
        locacaoId: data.locacaoId as string,
        clienteId: data.clienteId as string,
        dataInicio: new Date(data.dataInicio as string),
        dataFim: new Date(data.dataFim as string),
        dataPagamento: data.dataPagamento ? new Date(data.dataPagamento as string) : undefined,
        relogioAnterior: (data.relogioAnterior as number) || 0,
        relogioAtual: (data.relogioAtual as number) || 0,
        fichasRodadas,
        valorFicha: (data.valorFicha as number) || locacao.precoFicha,
        totalBruto,
        descontoPartidasQtd: (data.descontoPartidasQtd as number) || 0,
        descontoPartidasValor: (data.descontoPartidasValor as number) || 0,
        descontoDinheiro: (data.descontoDinheiro as number) || 0,
        percentualEmpresa: (data.percentualEmpresa as number) || locacao.percentualEmpresa,
        subtotalAposDescontos,
        valorPercentual,
        totalClientePaga,
        valorRecebido: (data.valorRecebido as number) || 0,
        saldoDevedorGerado: totalClientePaga - ((data.valorRecebido as number) || 0),
        status: (data.status as string) || 'Pendente',
        dataVencimento: data.dataVencimento ? new Date(data.dataVencimento as string) : undefined,
        observacao: data.observacao as string | undefined,
        registradoPorId: userId || undefined,
        deviceId,
        version: 0,
      },
      include: { 
        locacao: {
          include: { produto: true },
        },
        cliente: true,
        registradoPor: true,
      },
    })

    // Update locacao with last reading
    await db.locacao.update({
      where: { id: data.locacaoId as string },
      data: {
        ultimaLeituraRelogio: data.relogioAtual as number,
        dataUltimaCobranca: new Date(),
        version: locacao.version + 1,
      },
    })

    // Log the change
    await logChange(cobranca.id, 'cobranca', 'create', cobranca, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(cobranca),
    }, 201)
  } catch (error) {
    console.error('Create cobranca error:', error)
    return apiError('Erro ao criar cobrança', 500)
  }
}
