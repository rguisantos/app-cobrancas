import { NextRequest } from 'next/server'
import { apiResponse } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    // In a stateless API, logout is handled client-side
    // Here we just return success
    return apiResponse({ success: true, message: 'Logout realizado com sucesso' })
  } catch (error) {
    console.error('Logout error:', error)
    return apiResponse({ success: true }) // Still return success for logout
  }
}
