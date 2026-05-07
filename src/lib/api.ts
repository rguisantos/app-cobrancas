import { toast } from 'sonner'

interface FetchOptions extends RequestInit {
  requireAuth?: boolean
}

class ApiClient {
  private baseUrl = '/api'

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (requireAuth) {
      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
      if (userId) {
        (headers as Record<string, string>)['x-user-id'] = userId
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || 'Erro desconhecido'
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }

      return data
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      toast.error('Erro de conexão')
      throw new Error('Erro de conexão')
    }
  }

  async get<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T>(endpoint: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put<T>(endpoint: string, body?: unknown, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

export const api = new ApiClient()

// Helper function to get auth headers
export function getAuthHeaders(): Record<string, string> {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (userId) {
    headers['x-user-id'] = userId
  }
  return headers
}
