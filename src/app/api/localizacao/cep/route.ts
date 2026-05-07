import { NextRequest } from 'next/server'
import { apiResponse, apiError, parseQueryParams } from '@/lib/api-utils'

// ViaCEP API response interface
interface ViaCEPResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  ibge: string
  gia: string
  ddd: string
  siafi: string
  erro?: boolean
}

// GET /api/localizacao/cep?cep=XXXXX-XXX - ViaCEP lookup
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const { cep } = params

    if (!cep) {
      return apiError('CEP é obrigatório', 400)
    }

    // Clean CEP (remove non-digits)
    const cleanCep = cep.replace(/\D/g, '')

    if (cleanCep.length !== 8) {
      return apiError('CEP deve ter 8 dígitos', 400)
    }

    // Call ViaCEP API
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)

    if (!response.ok) {
      return apiError('Erro ao consultar CEP', 500)
    }

    const data: ViaCEPResponse = await response.json()

    if (data.erro) {
      return apiError('CEP não encontrado', 404)
    }

    return apiResponse({
      success: true,
      data: {
        cep: data.cep,
        logradouro: data.logradouro,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
        ibge: data.ibge,
        ddd: data.ddd,
      },
    })
  } catch (error) {
    console.error('ViaCEP lookup error:', error)
    return apiError('Erro ao consultar CEP', 500)
  }
}
