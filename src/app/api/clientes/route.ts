import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/clientes - List all clientes
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)
    
    const { search, status, rotaId, tipoPessoa } = params

    const where: any = {
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { nomeExibicao: { contains: search } },
        { nomeCompleto: { contains: search } },
        { nomeFantasia: { contains: search } },
        { cpf: { contains: search } },
        { cnpj: { contains: search } },
        { identificador: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (rotaId) {
      where.rotaId = rotaId
    }

    if (tipoPessoa) {
      where.tipoPessoa = tipoPessoa
    }

    const [clientes, total] = await Promise.all([
      db.cliente.findMany({
        where,
        skip,
        take: limit,
        include: { rota: true },
        orderBy: { nomeExibicao: 'asc' },
      }),
      db.cliente.count({ where }),
    ])

    return apiResponse({
      success: true,
      data: clientes.map(transformForMobile),
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get clientes error:', error)
    return apiError('Erro ao buscar clientes', 500)
  }
}

// POST /api/clientes - Create new cliente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Validate required fields
    if (!data.nomeExibicao) {
      return apiError('Nome de exibição é obrigatório', 400)
    }

    if (!data.telefonePrincipal) {
      return apiError('Telefone principal é obrigatório', 400)
    }

    // Check for duplicate CPF/CNPJ
    if (data.cpf) {
      const existingCpf = await db.cliente.findFirst({
        where: { cpf: data.cpf as string, deletedAt: null },
      })
      if (existingCpf) {
        return apiError('CPF já cadastrado', 400)
      }
    }

    if (data.cnpj) {
      const existingCnpj = await db.cliente.findFirst({
        where: { cnpj: data.cnpj as string, deletedAt: null },
      })
      if (existingCnpj) {
        return apiError('CNPJ já cadastrado', 400)
      }
    }

    const cliente = await db.cliente.create({
      data: {
        tipoPessoa: (data.tipoPessoa as string) || 'Fisica',
        identificador: data.identificador as string | undefined,
        cpf: data.cpf as string | undefined,
        rg: data.rg as string | undefined,
        nomeCompleto: data.nomeCompleto as string | undefined,
        cnpj: data.cnpj as string | undefined,
        razaoSocial: data.razaoSocial as string | undefined,
        nomeFantasia: data.nomeFantasia as string | undefined,
        inscricaoEstadual: data.inscricaoEstadual as string | undefined,
        nomeExibicao: data.nomeExibicao as string,
        email: data.email as string | undefined,
        telefonePrincipal: data.telefonePrincipal as string,
        contatosAdicionais: (data.contatosAdicionais as string) || '[]',
        cep: data.cep as string | undefined,
        logradouro: data.logradouro as string | undefined,
        numero: data.numero as string | undefined,
        complemento: data.complemento as string | undefined,
        bairro: data.bairro as string | undefined,
        cidade: data.cidade as string | undefined,
        estado: data.estado as string | undefined,
        rotaId: data.rotaId as string | undefined,
        status: (data.status as string) || 'Ativo',
        observacao: data.observacao as string | undefined,
        deviceId,
        version: 0,
      },
      include: { rota: true },
    })

    // Log the change
    await logChange(cliente.id, 'cliente', 'create', cliente, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(cliente),
    }, 201)
  } catch (error) {
    console.error('Create cliente error:', error)
    return apiError('Erro ao criar cliente', 500)
  }
}
