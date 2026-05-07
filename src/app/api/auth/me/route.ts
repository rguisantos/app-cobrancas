import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiResponse, apiError, transformForMobile } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    // Get user ID from header (set by client after login)
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return apiError('Não autorizado', 401)
    }

    const usuario = await db.usuario.findUnique({
      where: { id: userId },
    })

    if (!usuario) {
      return apiError('Usuário não encontrado', 404)
    }

    if (usuario.deletedAt) {
      return apiError('Usuário não encontrado', 404)
    }

    // Return user data (without password)
    const { senha: _, ...userWithoutPassword } = usuario

    return apiResponse({
      success: true,
      user: transformForMobile(userWithoutPassword),
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return apiError('Erro interno do servidor', 500)
  }
}
