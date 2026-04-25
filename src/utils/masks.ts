/**
 * masks.ts
 * Máscaras de formatação para inputs
 * 
 * Uso:
 * import { masks } from '../utils/masks';
 * onChangeText={(value) => masks.phone(value)}
 */

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

const cleanDigits = (value: string): string => {
  return value.replace(/\D/g, '');
};

const limitLength = (value: string, maxLength: number): string => {
  return value.slice(0, maxLength);
};

// ============================================================================
// MÁSCARAS
// ============================================================================

export const masks = {
  /**
   * CPF: 000.000.000-00
   */
  cpf: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 11);
    
    if (limited.length <= 3) return limited;
    if (limited.length <= 6) return `${limited.slice(0, 3)}.${limited.slice(3)}`;
    if (limited.length <= 9) return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
    return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
  },

  /**
   * CNPJ: 00.000.000/0000-00
   */
  cnpj: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 14);
    
    if (limited.length <= 2) return limited;
    if (limited.length <= 5) return `${limited.slice(0, 2)}.${limited.slice(2)}`;
    if (limited.length <= 8) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    if (limited.length <= 12) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;    return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12)}`;
  },

  /**
   * CPF ou CNPJ (automático)
   */
  cpfCnpj: (value: string): string => {
    const digits = cleanDigits(value);
    if (digits.length <= 11) {
      return masks.cpf(value);
  
  }
    return masks.cnpj(value);
  },

  /**
   * Telefone: (00) 00000-0000 ou (00) 0000-0000
   */
  phone: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 11);
    
    if (limited.length === 0) return '';
    if (limited.length <= 2) return `(${limited}`;
    if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  },

  /**
   * CEP: 00000-000
   */
  cep: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 8);
    
    if (limited.length <= 5) return limited;
    return `${limited.slice(0, 5)}-${limited.slice(5)}`;
  },

  /**
   * RG: 00.000.000-0 (SP)
   */
  rg: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 9);
    
    if (limited.length <= 2) return limited;
    if (limited.length <= 5) return `${limited.slice(0, 2)}.${limited.slice(2)}`;
    if (limited.length <= 8) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}-${limited.slice(8)}`;
  },
  /**
   * Inscrição Estadual (genérico)
   */
  ie: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 12);
    
    if (limited.length <= 4) return limited;
    if (limited.length <= 8) return `${limited.slice(0, 4)}.${limited.slice(4)}`;
    return `${limited.slice(0, 4)}.${limited.slice(4, 8)}.${limited.slice(8)}`;
  },

  /**
   * Moeda: R$ 0,00
   */
  currency: (value: string): string => {
    const digits = cleanDigits(value);
    const numberValue = parseInt(digits, 10) / 100;
    
    if (isNaN(numberValue)) return 'R$ 0,00';
    
    return numberValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  },

  /**
   * Número inteiro com separador de milhar
   */
  number: (value: string): string => {
    const digits = cleanDigits(value);
    const numberValue = parseInt(digits, 10);
    
    if (isNaN(numberValue)) return '0';
    
    return numberValue.toLocaleString('pt-BR');
  },

  /**
   * Porcentagem: 0%
   */
  percentage: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 3);
    
    if (limited.length === 0) return '';
    return `${limited}%`;
  },
  /**
   * Data: DD/MM/AAAA
   */
  date: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 8);
    
    if (limited.length <= 2) return limited;
    if (limited.length <= 4) return `${limited.slice(0, 2)}/${limited.slice(2)}`;
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`;
  },

  /**
   * Hora: HH:MM
   */
  time: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 4);
    
    if (limited.length <= 2) return limited;
    return `${limited.slice(0, 2)}:${limited.slice(2)}`;
  },

  /**
   * Placa de veículo: ABC-1234 ou ABC1234
   */
  plate: (value: string): string => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const limited = limitLength(cleaned, 7);
    
    if (limited.length <= 3) return limited;
    if (limited.length <= 7) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    return limited;
  },

  /**
   * Número do relógio/contador (inteiro)
   */
  relogio: (value: string): string => {
    const digits = cleanDigits(value);
    const limited = limitLength(digits, 10);
    
    return limited;
  },
};

// ============================================================================
// DESMASCARAR (para salvar no banco)
// ============================================================================
export const unmask = {
  cpf: (value: string): string => cleanDigits(value),
  cnpj: (value: string): string => cleanDigits(value),
  phone: (value: string): string => cleanDigits(value),
  cep: (value: string): string => cleanDigits(value),
  rg: (value: string): string => cleanDigits(value),
  currency: (value: string): string => {
    return cleanDigits(value);
  },
  percentage: (value: string): string => cleanDigits(value),
  date: (value: string): string => cleanDigits(value),
  relogio: (value: string): string => cleanDigits(value),
};

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export default { masks, unmask };