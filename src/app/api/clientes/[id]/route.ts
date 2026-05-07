import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile, transformFromMobile } from '@/lib/api-utils'

// GET /api/clientes/[id] - Get cliente by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const cliente = await db.cliente.findUnique({
      where: { id },
      include: { 
        rota: true,
        locacoes: {
          where: { deletedAt: null },
          include: { produto: true },
        },
        cobrancas: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!cliente || cliente.deletedAt) {
      return apiError('Cliente não encontrado', 404)
    }

    return apiResponse({
      success: true,
      data: transformForMobile(cliente),
    })
  } catch (error) {
    console.error('Get cliente error:', error)
    return apiError('Erro ao buscar cliente', 500)
  }
}

// PUT /api/clientes/[id] - Update cliente
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if cliente exists
    const existingCliente = await db.cliente.findUnique({
      where: { id },
    })

    if (!existingCliente || existingCliente.deletedAt) {
      return apiError('Cliente não encontrado', 404)
    }

    // Transform data from mobile format
    const data = transformFromMobile(body)

    // Check for duplicate CPF/CNPJ (excluding current cliente)
    if (data.cpf && data.cpf !== existingCliente.cpf) {
      const duplicateCpf = await db.cliente.findFirst({
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

    if (data.cnpj && data.cnpj !== existingCliente.cnpj) {
      const duplicateCnpj = await db.cliente.findFirst({
        where: { 
          cnpj: data.cnpj as string, 
          deletedAt: null,
          NOT: { id },
        },
      })
      if (duplicateCnpj) {
        return apiError('CNPJ já cadastrado', 400)
      }
    }

    const cliente = await db.cliente.update({
      where: { id },
      data: {
        tipoPessoa: data.tipoPessoa as string | undefined,
        identificador: data.identificador as string | undefined,
        cpf: data.cpf as string | undefined,
        rg: data.rg as string | undefined,
        nomeCompleto: data.nomeCompleto as string | undefined,
        cnpj: data.cnpj as string | undefined,
        razaoSocial: data.razaoSocial as string | undefined,
        nomeFantasia: data.nomeFantasia as string | undefined,
        inscricaoEstadual: data.inscricaoEstadual as string | undefined,
        nomeExibicao: data.nomeExibicao as string | undefined,
        email: data.email as string | undefined,
        telefonePrincipal: data.telefonePrincipal as string | undefined,
        contatosAdicionais: data.contatosAdicionais as string | undefined,
        cep: data.cep as string | undefined,
        logradouro: data.logradouro as string | undefined,
        numero: data.numero as string | undefined,
        complemento: data.complemento as string | undefined,
        bairro: data.bairro as string | undefined,
        cidade: data.cidade as string | undefined,
        estado: data.estado as string | undefined,
        rotaId: data.rotaId as string | undefined,
        status: data.status as string | undefined,
        observacao: data.observacao as string | undefined,
        version: existingCliente.version + 1,
        deviceId,
      },
      include: { rota: true },
    })

    // Log the change
    await logChange(cliente.id, 'cliente', 'update', cliente, deviceId)

    return apiResponse({
      success: true,
      data: transformForMobile(cliente),
    })
  } catch (error) {
    console.error('Update cliente error:', error)
    return apiError('Erro ao atualizar cliente', 500)
  }
}

// DELETE /api/clientes/[id] - Soft delete cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const deviceId = request.headers.get('x-device-id') || 'web'

    // Check if cliente exists
    const existingCliente = await db.cliente.findUnique({
      where: { id },
    })

    if (!existingCliente || existingCliente.deletedAt) {
      return apiError('Cliente não encontrado', 404)
    }

    // Check for active locacoes
    const activeLocacoes = await db.locacao.count({
      where: {
        clienteId: id,
        status: 'Ativa',
        deletedAt: null,
      },
    })

    if (activeLocacoes > 0) {
      return apiError('Cliente possui locações ativas. Finalize as locações antes de excluir.', 400)
    }

    // Soft delete
    const cliente = await db.cliente.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: existingCliente.version + 1,
        deviceId,
      },
    })

    // Log the change
    await logChange(cliente.id, 'cliente', 'delete', { id }, deviceId)

    return apiResponse({
      success: true,
      message: 'Cliente excluído com sucesso',
    })
  } catch (error) {
    console.error('Delete cliente error:', error)
    return apiError('Erro ao excluir cliente', 500)
  }
}
