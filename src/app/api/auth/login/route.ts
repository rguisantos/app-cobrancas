import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, logChange, transformForMobile } from '@/lib/api-utils'
import { compare } from 'next-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, senha } = body

    if (!email || !senha) {
      return apiError('Email e senha são obrigatórios', 400)
    }

    // Find user by email
    const usuario = await db.usuario.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!usuario) {
      return apiError('Usuário não encontrado', 404)
    }

    // Check if user is blocked or inactive
    if (usuario.bloqueado) {
      return apiError('Usuário bloqueado. Entre em contato com o administrador.', 403)
    }

    if (usuario.status !== 'Ativo') {
      return apiError('Usuário inativo', 403)
    }

    // Verify password (plain text comparison for now - should use bcrypt in production)
    if (usuario.senha !== senha) {
      return apiError('Senha incorreta', 401)
    }

    // Update last access
    await db.usuario.update({
      where: { id: usuario.id },
      data: {
        dataUltimoAcesso: new Date(),
        ultimoAcessoDispositivo: 'Web',
      },
    })

    // Return user data (without password)
    const { senha: _, ...userWithoutPassword } = usuario
    
    // Log the login
    await logChange(usuario.id, 'usuario', 'update', { action: 'login' , timestamp: new Date().toISOString() }, 'web')

    return apiResponse({
      success: true,
      user: transformForMobile(userWithoutPassword),
    })
  } catch (error) {
    console.error('Login error:', error)
    return apiError('Erro interno do servidor', 500)
  }
}
