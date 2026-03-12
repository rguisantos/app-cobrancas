/**
 * currency.ts
 * Utilitários para formatação e cálculos de moeda
 * 
 * Uso:
 * import { formatarMoeda, parseCurrency } from '../utils/currency';
 * formatarMoeda(1234.56) // R$ 1.234,56
 */

// ============================================================================
// FORMATAÇÃO
// ============================================================================

/**
 * Formata número para moeda brasileira (R$)
 */
export const formatarMoeda = (value: number | string): string => {
  const numberValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d,-]/g, '').replace(',', '.')) : value;
  
  if (isNaN(numberValue)) {
    return 'R$ 0,00';
  }
  
  return numberValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Formata número com separador de milhar
 */
export const formatarNumero = (value: number | string): string => {
  const numberValue = typeof value === 'string' ? parseInt(value.replace(/\D/g, ''), 10) : value;
  
  if (isNaN(numberValue)) {
    return '0';
  }
  
  return numberValue.toLocaleString('pt-BR');
};

/**
 * Formata porcentagem
 */
export const formatarPorcentagem = (value: number | string): string => {
  const numberValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numberValue)) {
    return '0%';
  }
  
  return `${numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
};

/**
 * Formata data para padrão brasileiro
 */
export const formatarData = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Data inválida';
  }
  
  return dateObj.toLocaleDateString('pt-BR');
};

/**
 * Formata data e hora
 */
export const formatarDataHora = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Data inválida';
  }
  
  return dateObj.toLocaleString('pt-BR');
};

// ============================================================================
// PARSE (CONVERSÃO)
// ============================================================================

/**
 * Converte string formatada como moeda para número
 */
export const parseCurrency = (value: string): number => {
  if (!value) return 0;
  
  // Remove R$, espaços e pontos de milhar, substitui vírgula por ponto
  const cleaned = value
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
    const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Converte string formatada como número para número inteiro
 */
export const parseNumber = (value: string): number => {
  if (!value) return 0;
  
  const cleaned = value.replace(/\D/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Converte string formatada como porcentagem para número
 */
export const parsePercentage = (value: string): number => {
  if (!value) return 0;
  
  const cleaned = value.replace('%', '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// ============================================================================
// CÁLCULOS
// ============================================================================

/**
 * Calcula percentual de um valor
 */
export const calcularPercentual = (valor: number, percentual: number): number => {
  return (valor * percentual) / 100;
};

/**
 * Calcula valor com desconto
 */
export const aplicarDesconto = (valor: number, desconto: number): number => {
  return Math.max(0, valor - desconto);
};

/**
 * Calcula valor com acréscimo
 */
export const aplicarAcrecimo = (valor: number, acrescimo: number): number => {
  return valor + acrescimo;
};
/**
 * Arredonda para 2 casas decimais
 */
export const arredondar = (valor: number): number => {
  return Math.round(valor * 100) / 100;
};

/**
 * Calcula diferença entre dois valores
 */
export const calcularDiferenca = (valor1: number, valor2: number): number => {
  return arredondar(valor1 - valor2);
};

/**
 * Calcula média de valores
 */
export const calcularMedia = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  
  const soma = valores.reduce((acc, val) => acc + val, 0);
  return arredondar(soma / valores.length);
};

/**
 * Calcula total de valores
 */
export const calcularTotal = (valores: number[]): number => {
  return arredondar(valores.reduce((acc, val) => acc + val, 0));
};

// ============================================================================
// UTILITÁRIOS DE EXIBIÇÃO
// ============================================================================

/**
 * Retorna classe de cor baseada no valor (positivo/negativo)
 */
export const getValorColor = (valor: number): string => {
  if (valor > 0) return '#16A34A'; // Verde
  if (valor < 0) return '#DC2626'; // Vermelho
  return '#64748B'; // Cinza
};

/**
 * Formata valor com sinal (+/-)
 */
export const formatarComSinal = (valor: number): string => {
  const formatted = formatarMoeda(Math.abs(valor));  
  if (valor > 0) return `+${formatted}`;
  if (valor < 0) return `-${formatted}`;
  return formatted;
};

/**
 * Verifica se valor é zero
 */
export const isZero = (valor: number | string): boolean => {
  const numberValue = typeof valor === 'string' ? parseCurrency(valor) : valor;
  return numberValue === 0;
};

/**
 * Verifica se valor é positivo
 */
export const isPositive = (valor: number | string): boolean => {
  const numberValue = typeof valor === 'string' ? parseCurrency(valor) : valor;
  return numberValue > 0;
};

/**
 * Verifica se valor é negativo
 */
export const isNegative = (valor: number | string): boolean => {
  const numberValue = typeof valor === 'string' ? parseCurrency(valor) : valor;
  return numberValue < 0;
};

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export default {
  formatarMoeda,
  formatarNumero,
  formatarPorcentagem,
  formatarData,
  formatarDataHora,
  parseCurrency,
  parseNumber,
  parsePercentage,
  calcularPercentual,
  aplicarDesconto,
  aplicarAcrecimo,
  arredondar,
  calcularDiferenca,
  calcularMedia,
  calcularTotal,  getValorColor,
  formatarComSinal,
  isZero,
  isPositive,
  isNegative,
};