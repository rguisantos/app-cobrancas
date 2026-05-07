import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, parseQueryParams, getPagination, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/usuarios - List all usuarios
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { skip, limit } = getPagination(params)
    
    const { search, status, tipoPermissao } = params

    const where: any = {
      deletedAt: null,
    }

    if (search) {
      where.OR = [
        { nome: { contains: search } },
        { email: { contains: search } },
        { cpf: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (tipoPermissao) {
      where.tipoPermissao = tipoPermissao
    }

    const [usuarios, total] = await Promise.all([
      db.usuario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
      }),
      db.usuario.count({ where }),
    ])

    // Remove passwords from response
    const usuariosSemSenha = usuarios.map(u => {
      const { senha: _, ...userWithoutPassword } = u
      return transformForMobile(userWithoutPassword)
    })

    return apiResponse({
      success: true,
      data: usuariosSemSenha,
      pagination: {
        total,
        page: parseInt(params.page || '1'),
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get usuarios error:', error)
    return apiError('Erro ao buscar usuários', 500)
  }
}

// POST /api/usuarios - Create new usuario
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

    if (!data.email) {
      return apiError('Email é obrigatório', 400)
    }

    if (!data.senha) {
      return apiError('Senha é obrigatória', 400)
    }

    if (!data.cpf) {
      return apiError('CPF é obrigatório', 400)
    }

    // Check for duplicate email
    const existingEmail = await db.usuario.findFirst({
      where: { email: (data.email as string).toLowerCase(), deletedAt: null },
    })
    if (existingEmail) {
      return apiError('Email já cadastrado', 400)
    }

    // Check for duplicate CPF
    const existingCpf = await db.usuario.findFirst({
      where: { cpf: data.cpf as string, deletedAt: null },
    })
    if (existingCpf) {
      return apiError('CPF já cadastrado', 400)
    }

    const usuario = await db.usuario.create({
      data: {
        nome: data.nome as string,
        cpf: data.cpf as string,
        telefone: data.telefone as string | undefined,
        email: (data.email as string).toLowerCase(),
        senha: data.senha as string, // Should be hashed in production
        tipoPermissao: (data.tipoPermissao as string) || 'AcessoControlado',
        permissoesWebTodosCadastros: (data.permissoesWebTodosCadastros as boolean) || false,
        permissoesWebLocacaoRelocacao: (data.permissoesWebLocacaoRelocacao as boolean) || false,
        permissoesWebRelatorios: (data.permissoesWebRelatorios as boolean) || false,
        permissoesMobileTodosCadastros: (data.permissoesMobileTodosCadastros as boolean) || false,
        permissoesMobileAlteracaoRelogio: (data.permissoesMobileAlteracaoRelogio as boolean) || false,
        permissoesMobileLocacaoRelocacao: (data.permissoesMobileLocacaoRelocacao as boolean) || false,
        permissoesMobileCobrancasFaturas: (data.permissoesMobileCobrancasFaturas as boolean) || false,
        rotasPermitidas: (data.rotasPermitidas as string) || '[]',
        status: (data.status as string) || 'Ativo',
        bloqueado: (data.bloqueado as boolean) || false,
        deviceId,
        version: 0,
      },
    })

    // Log the change
    await logChange(usuario.id, 'usuario', 'create', { ...usuario, senha: '[REDACTED]' }, deviceId)

    // Remove password from response
    const { senha: _, ...userWithoutPassword } = usuario

    return apiResponse({
      success: true,
      data: transformForMobile(userWithoutPassword),
    }, 201)
  } catch (error) {
    console.error('Create usuario error:', error)
    return apiError('Erro ao criar usuário', 500)
  }
}
