import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/usuarios/[id] - Get usuario by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const usuario = await db.usuario.findUnique({
      where: { id },
    })

    if (!usuario || usuario.deletedAt) {
      return apiError('Usuário não encontrado', 404)
    }

    // Remove password from response
    const { senha: _, ...userWithoutPassword } = usuario

    return apiResponse({
      success: true,
      data: transformForMobile(userWithoutPassword),
    })
  } catch (error) {
    console.error('Get usuario error:', error)
    return apiError('Erro ao buscar usuário', 500)
  }
}

// PUT /api/usuarios/[id] - Update usuario
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if usuario exists
    const existingUsuario = await db.usuario.findUnique({
      where: { id },
    })

    if (!existingUsuario || existingUsuario.deletedAt) {
      return apiError('Usuário não encontrado', 404)
    }

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Check for duplicate email (excluding current usuario)
    if (data.email && data.email !== existingUsuario.email) {
      const duplicateEmail = await db.usuario.findFirst({
        where: { 
          email: (data.email as string).toLowerCase(), 
          deletedAt: null,
          NOT: { id },
        },
      })
      if (duplicateEmail) {
        return apiError('Email já cadastrado', 400)
      }
    }

    // Check for duplicate CPF (excluding current usuario)
    if (data.cpf && data.cpf !== existingUsuario.cpf) {
      const duplicateCpf = await db.usuario.findFirst({
        where: { 
          cpf: data.cpf as string, 
          deletedAt: null,
          NOT: { id },
        },
      })
      if (duplicateCpf) {
        return apiError('CPF já cadastrado', 400)
      }
    }

    const usuario = await db.usuario.update({
      where: { id },
      data: {
        nome: data.nome as string | undefined,
        cpf: data.cpf as string | undefined,
        telefone: data.telefone as string | undefined,
        email: data.email ? (data.email as string).toLowerCase() : undefined,
        senha: data.senha as string | undefined,
        tipoPermissao: data.tipoPermissao as string | undefined,
        permissoesWebTodosCadastros: data.permissoesWebTodosCadastros as boolean | undefined,
        permissoesWebLocacaoRelocacao: data.permissoesWebLocacaoRelocacao as boolean | undefined,
        permissoesWebRelatorios: data.permissoesWebRelatorios as boolean | undefined,
        permissoesMobileTodosCadastros: data.permissoesMobileTodosCadastros as boolean | undefined,
        permissoesMobileAlteracaoRelogio: data.permissoesMobileAlteracaoRelogio as boolean | undefined,
        permissoesMobileLocacaoRelocacao: data.permissoesMobileLocacaoRelocacao as boolean | undefined,
        permissoesMobileCobrancasFaturas: data.permissoesMobileCobrancasFaturas as boolean | undefined,
        rotasPermitidas: data.rotasPermitidas as string | undefined,
        status: data.status as string | undefined,
        bloqueado: data.bloqueado as boolean | undefined,
        version: existingUsuario.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(usuario.id, 'usuario', 'update', { ...usuario, senha: '[REDACTED]' }, deviceId)

    // Remove password from response
    const { senha: _, ...userWithoutPassword } = usuario

    return apiResponse({
      success: true,
      data: transformForMobile(userWithoutPassword),
    })
  } catch (error) {
    console.error('Update usuario error:', error)
    return apiError('Erro ao atualizar usuário', 500)
  }
}

// DELETE /api/usuarios/[id] - Soft delete usuario
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if usuario exists
    const existingUsuario = await db.usuario.findUnique({
      where: { id },
    })

    if (!existingUsuario || existingUsuario.deletedAt) {
      return apiError('Usuário não encontrado', 404)
    }

    // Check if this is the last admin
    if (existingUsuario.tipoPermissao === 'Administrador') {
      const adminCount = await db.usuario.count({
        where: {
          tipoPermissao: 'Administrador',
          deletedAt: null,
        },
      })
      if (adminCount <= 1) {
        return apiError('Não é possível excluir o último administrador do sistema', 400)
      }
    }

    // Soft delete
    const usuario = await db.usuario.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'Inativo',
        version: existingUsuario.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(usuario.id, 'usuario', 'delete', { id }, deviceId)

    return apiResponse({
      success: true,
      message: 'Usuário excluído com sucesso',
    })
  } catch (error) {
    console.error('Delete usuario error:', error)
    return apiError('Erro ao excluir usuário', 500)
  }
}
