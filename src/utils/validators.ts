/**
 * validators.ts
 * Validações de dados (CPF, CNPJ, email, etc.)
 * 
 * Uso:
 * import { validators } from '../utils/validators';
 * validators.isValidCPF(cpf)
 */

import { unmask } from './masks';

// ============================================================================
// VALIDADORES
// ============================================================================

export const validators = {
  /**
   * Valida CPF
   * Algoritmo oficial da Receita Federal
   */
  isValidCPF: (cpf: string): boolean => {
    const cleanCPF = unmask.cpf(cpf);
    
    // Verifica se tem 11 dígitos
    if (cleanCPF.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
    if (/^(\d)\1+$/.test(cleanCPF)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = 11 - (sum % 11);
    if (remainder > 9) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
    
    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = 11 - (sum % 11);
    if (remainder > 9) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
    
    return true;
  },
  /**
   * Valida CNPJ
   * Algoritmo oficial da Receita Federal
   */
  isValidCNPJ: (cnpj: string): boolean => {
    const cleanCNPJ = unmask.cnpj(cnpj);
    
    // Verifica se tem 14 dígitos
    if (cleanCNPJ.length !== 14) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cleanCNPJ)) return false;
    
    // Validação do primeiro dígito verificador
    let sum = 0;
    let weight = 2;
    for (let i = 11; i >= 0; i--) {
      sum += parseInt(cleanCNPJ.charAt(i)) * weight;
      weight++;
      if (weight > 9) weight = 2;
    }
    let remainder = sum % 11;
    let digit = remainder < 2 ? 0 : 11 - remainder;
    if (digit !== parseInt(cleanCNPJ.charAt(12))) return false;
    
    // Validação do segundo dígito verificador
    sum = 0;
    weight = 2;
    for (let i = 12; i >= 0; i--) {
      sum += parseInt(cleanCNPJ.charAt(i)) * weight;
      weight++;
      if (weight > 9) weight = 2;
    }
    remainder = sum % 11;
    digit = remainder < 2 ? 0 : 11 - remainder;
    if (digit !== parseInt(cleanCNPJ.charAt(13))) return false;
    
    return true;
  },

  /**
   * Valida CPF ou CNPJ
   */
  isValidCPFOrCNPJ: (documento: string): boolean => {
    const clean = unmask.cpf(documento);
    if (clean.length === 11) {
      return validators.isValidCPF(documento);
    } else if (clean.length === 14) {
      return validators.isValidCNPJ(documento);
    }    return false;
  },

  /**
   * Valida e-mail
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Valida telefone (mínimo 10 dígitos)
   */
  isValidPhone: (phone: string): boolean => {
    const clean = unmask.phone(phone);
    return clean.length >= 10 && clean.length <= 11;
  },

  /**
   * Valida CEP
   */
  isValidCEP: (cep: string): boolean => {
    const clean = unmask.cep(cep);
    return clean.length === 8;
  },

  /**
   * Valida se campo não está vazio
   */
  isNotEmpty: (value: string | undefined | null): boolean => {
    return value !== undefined && value !== null && value.trim().length > 0;
  },

  /**
   * Valida tamanho mínimo
   */
  minLength: (value: string, min: number): boolean => {
    return value.trim().length >= min;
  },

  /**
   * Valida tamanho máximo
   */
  maxLength: (value: string, max: number): boolean => {
    return value.trim().length <= max;
  },

  /**
   * Valida se é número   */
  isNumber: (value: string): boolean => {
    return !isNaN(Number(value));
  },

  /**
   * Valida intervalo numérico
   */
  isInRange: (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max;
  },

  /**
   * Valida porcentagem (0-100)
   */
  isValidPercentage: (value: string | number): boolean => {
    const num = typeof value === 'string' ? parseInt(unmask.percentage(value), 10) : value;
    return !isNaN(num) && num >= 0 && num <= 100;
  },

  /**
   * Valida data (se é uma data válida)
   */
  isValidDate: (dateString: string): boolean => {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  },

  /**
   * Valida se data é futura
   */
  isFutureDate: (dateString: string): boolean => {
    const date = new Date(dateString);
    const now = new Date();
    return date > now;
  },

  /**
   * Valida se data é passada
   */
  isPastDate: (dateString: string): boolean => {
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
  },

  /**
   * Valida senha (mínimo 6 caracteres)
   */
  isValidPassword: (password: string, minLength: number = 6): boolean => {    return password.length >= minLength;
  },

  /**
   * Valida se duas senhas são iguais
   */
  passwordsMatch: (password: string, confirmPassword: string): boolean => {
    return password === confirmPassword;
  },

  /**
   * Valida número do relógio (não negativo)
   */
  isValidRelogio: (value: string): boolean => {
    const clean = unmask.relogio(value);
    return clean.length > 0 && parseInt(clean, 10) >= 0;
  },
};

// ============================================================================
// MENSAGENS DE ERRO PADRÃO
// ============================================================================

export const errorMessages = {
  required: 'Campo obrigatório',
  invalidCPF: 'CPF inválido',
  invalidCNPJ: 'CNPJ inválido',
  invalidEmail: 'E-mail inválido',
  invalidPhone: 'Telefone inválido',
  invalidCEP: 'CEP inválido',
  minLength: (min: number) => `Mínimo de ${min} caracteres`,
  maxLength: (max: number) => `Máximo de ${max} caracteres`,
  invalidNumber: 'Número inválido',
  invalidPercentage: 'Porcentagem deve ser entre 0 e 100',
  invalidDate: 'Data inválida',
  passwordsDontMatch: 'Senhas não conferem',
  invalidPassword: (min: number) => `Senha deve ter no mínimo ${min} caracteres`,
  relogioInvalid: 'Número do relógio inválido',
  relogioRegressed: 'Relógio não pode ser menor que o anterior',
};

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export default validators;