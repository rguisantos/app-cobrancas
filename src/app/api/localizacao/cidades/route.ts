import { NextRequest } from 'next/server'
import { apiResponse, apiError, parseQueryParams } from '@/lib/api-utils'

// GET /api/localizacao/cidades?uf=XX - List cities by state
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { uf } = params

    if (!uf) {
      return apiError('UF é obrigatória', 400)
    }

    const ufUpper = uf.toUpperCase()

    // Validate UF
    const validUFs = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
                      'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
                      'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

    if (!validUFs.includes(ufUpper)) {
      return apiError('UF inválida', 400)
    }

    // Call IBGE API for cities
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufUpper}/municipios`)

    if (!response.ok) {
      return apiError('Erro ao buscar cidades', 500)
    }

    const data = await response.json()

    const cidades = data.map((cidade: { id: number; nome: string }) => ({
      id: cidade.id,
      nome: cidade.nome,
    }))

    // Sort by name
    cidades.sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome))

    return apiResponse({
      success: true,
      data: cidades,
    })
  } catch (error) {
    console.error('Get cidades error:', error)
    return apiError('Erro ao buscar cidades', 500)
  }
}
