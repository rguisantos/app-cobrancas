/**
 * LocalizacaoService.ts
 * Serviço para buscar estados e cidades brasileiras
 * Utiliza a API do IBGE (https://servicodados.ibge.gov.br/api/v1/localidades)
 */

export interface Estado {
  id: number;
  sigla: string;
  nome: string;
}

export interface Cidade {
  id: number;
  nome: string;
}

class LocalizacaoService {
  private baseUrl = 'https://servicodados.ibge.gov.br/api/v1/localidades';

  /**
   * Busca todos os estados brasileiros
   */
  async getEstados(): Promise<Estado[]> {
    try {
      const response = await fetch(`${this.baseUrl}/estados`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar estados');
      }

      const data = await response.json();
      
      // Ordenar por sigla
      return data
        .map((estado: any) => ({
          id: estado.id,
          sigla: estado.sigla,
          nome: estado.nome,
        }))
        .sort((a: Estado, b: Estado) => a.sigla.localeCompare(b.sigla));
    } catch (error) {
      console.error('[LocalizacaoService] Erro ao buscar estados:', error);
      return this.getEstadosFallback();
    }
  }

  /**
   * Busca cidades por estado (UF)
   */
  async getCidadesPorEstado(uf: string): Promise<Cidade[]> {
    try {
      const response = await fetch(`${this.baseUrl}/estados/${uf}/municipios`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar cidades');
      }

      const data = await response.json();
      
      // Ordenar por nome
      return data
        .map((cidade: any) => ({
          id: cidade.id,
          nome: cidade.nome,
        }))
        .sort((a: Cidade, b: Cidade) => a.nome.localeCompare(b.nome));
    } catch (error) {
      console.error('[LocalizacaoService] Erro ao buscar cidades:', error);
      return [];
    }
  }

  /**
   * Busca endereço por CEP usando ViaCEP
   */
  async buscarEnderecoPorCep(cep: string): Promise<{
    logradouro: string;
    bairro: string;
    cidade: string;
    estado: string;
    erro?: boolean;
  } | null> {
    try {
      const cepLimpo = cep.replace(/\D/g, '');
      
      if (cepLimpo.length !== 8) {
        return null;
      }

      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar CEP');
      }

      const data = await response.json();

      if (data.erro) {
        return { logradouro: '', bairro: '', cidade: '', estado: '', erro: true };
      }

      return {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
      };
    } catch (error) {
      console.error('[LocalizacaoService] Erro ao buscar CEP:', error);
      return null;
    }
  }

  /**
   * Lista de estados como fallback (caso a API falhe)
   */
  private getEstadosFallback(): Estado[] {
    return [
      { id: 11, sigla: 'RO', nome: 'Rondônia' },
      { id: 12, sigla: 'AC', nome: 'Acre' },
      { id: 13, sigla: 'AM', nome: 'Amazonas' },
      { id: 14, sigla: 'RR', nome: 'Roraima' },
      { id: 15, sigla: 'PA', nome: 'Pará' },
      { id: 16, sigla: 'AP', nome: 'Amapá' },
      { id: 17, sigla: 'TO', nome: 'Tocantins' },
      { id: 21, sigla: 'MA', nome: 'Maranhão' },
      { id: 22, sigla: 'PI', nome: 'Piauí' },
      { id: 23, sigla: 'CE', nome: 'Ceará' },
      { id: 24, sigla: 'RN', nome: 'Rio Grande do Norte' },
      { id: 25, sigla: 'PB', nome: 'Paraíba' },
      { id: 26, sigla: 'PE', nome: 'Pernambuco' },
      { id: 27, sigla: 'AL', nome: 'Alagoas' },
      { id: 28, sigla: 'SE', nome: 'Sergipe' },
      { id: 29, sigla: 'BA', nome: 'Bahia' },
      { id: 31, sigla: 'MG', nome: 'Minas Gerais' },
      { id: 32, sigla: 'ES', nome: 'Espírito Santo' },
      { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro' },
      { id: 35, sigla: 'SP', nome: 'São Paulo' },
      { id: 41, sigla: 'PR', nome: 'Paraná' },
      { id: 42, sigla: 'SC', nome: 'Santa Catarina' },
      { id: 43, sigla: 'RS', nome: 'Rio Grande do Sul' },
      { id: 50, sigla: 'MS', nome: 'Mato Grosso do Sul' },
      { id: 51, sigla: 'MT', nome: 'Mato Grosso' },
      { id: 52, sigla: 'GO', nome: 'Goiás' },
      { id: 53, sigla: 'DF', nome: 'Distrito Federal' },
    ];
  }
}

export const localizacaoService = new LocalizacaoService();
export default localizacaoService;
