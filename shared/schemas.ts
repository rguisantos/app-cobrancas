// packages/shared/src/schemas.ts
// Zod schemas compartilhados entre web e mobile
// Garante que as validações sejam idênticas no servidor e no cliente

import { z } from 'zod'

// ============================================================================
// CUSTOM VALIDATORS — CPF, CNPJ, Telefone
// ============================================================================

/**
 * Valida CPF usando algoritmo da Receita Federal
 */
function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return false
  if (/^(\d)\1+$/.test(clean)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i)
  }
  let remainder = 11 - (sum % 11)
  if (remainder > 9) remainder = 0
  if (remainder !== parseInt(clean.charAt(9))) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i)
  }
  remainder = 11 - (sum % 11)
  if (remainder > 9) remainder = 0
  if (remainder !== parseInt(clean.charAt(10))) return false

  return true
}

/**
 * Valida CNPJ usando algoritmo da Receita Federal
 */
function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return false
  if (/^(\d)\1+$/.test(clean)) return false

  let sum = 0
  let weight = 2
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(clean.charAt(i)) * weight
    weight++
    if (weight > 9) weight = 2
  }
  let remainder = sum % 11
  let digit = remainder < 2 ? 0 : 11 - remainder
  if (digit !== parseInt(clean.charAt(12))) return false

  sum = 0
  weight = 2
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(clean.charAt(i)) * weight
    weight++
    if (weight > 9) weight = 2
  }
  remainder = sum % 11
  digit = remainder < 2 ? 0 : 11 - remainder
  if (digit !== parseInt(clean.charAt(13))) return false

  return true
}

/**
 * Valida telefone brasileiro (mínimo 10 dígitos com DDD)
 */
function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '')
  return clean.length >= 10 && clean.length <= 11
}

/**
 * Valida CEP brasileiro (8 dígitos)
 */
function validateCEP(cep: string): boolean {
  const clean = cep.replace(/\D/g, '')
  return clean.length === 8
}

// ============================================================================
// CUSTOM ZOD TYPES
// ============================================================================

const cpfSchema = z.string()
  .min(1, 'CPF é obrigatório')
  .refine(val => validateCPF(val), { message: 'CPF inválido' })

const cnpjSchema = z.string()
  .min(1, 'CNPJ é obrigatório')
  .refine(val => validateCNPJ(val), { message: 'CNPJ inválido' })

const cpfOrCnpjSchema = z.string()
  .min(1, 'CPF/CNPJ é obrigatório')
  .refine(val => validateCPF(val) || validateCNPJ(val), { message: 'CPF/CNPJ inválido' })

const phoneSchema = z.string()
  .min(1, 'Telefone é obrigatório')
  .refine(val => validatePhone(val), { message: 'Telefone inválido' })

const cepSchema = z.string()
  .refine(val => !val || validateCEP(val), { message: 'CEP inválido' })

const percentageSchema = z.number()
  .min(0, 'Percentual não pode ser negativo')
  .max(100, 'Percentual não pode exceder 100')

const positiveNumberSchema = z.number()
  .min(0, 'Valor não pode ser negativo')

const positiveRequiredSchema = z.number()
  .min(0.01, 'Valor deve ser maior que zero')

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
  dispositivo: z.enum(['Web', 'Mobile']).default('Web'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  novaSenha: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?\/]/, 'Senha deve conter pelo menos um caractere especial'),
  confirmarSenha: z.string().min(1, 'Confirmação é obrigatória'),
}).refine(data => data.novaSenha === data.confirmarSenha, {
  message: 'As senhas não coincidem',
  path: ['confirmarSenha'],
})

export const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual é obrigatória'),
  novaSenha: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?\/]/, 'Senha deve conter pelo menos um caractere especial'),
  confirmarSenha: z.string().min(1, 'Confirmação é obrigatória'),
}).refine(data => data.novaSenha === data.confirmarSenha, {
  message: 'As senhas não coincidem',
  path: ['confirmarSenha'],
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
})

// ============================================================================
// CLIENTE SCHEMAS
// ============================================================================

export const contatoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1, 'Nome do contato é obrigatório'),
  telefone: z.string().min(1, 'Telefone do contato é obrigatório'),
  whatsapp: z.boolean().optional().default(false),
  principal: z.boolean().optional().default(false),
})

export const clienteFormSchema = z.discriminatedUnion('tipoPessoa', [
  z.object({
    tipoPessoa: z.literal('Fisica'),
    nomeExibicao: z.string().min(1, 'Nome completo é obrigatório'),
    cpf: cpfSchema,
    rg: z.string().optional(),
    nomeCompleto: z.string().optional(),
    email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
    telefonePrincipal: phoneSchema,
    contatos: z.array(contatoSchema).optional(),
    cep: cepSchema.optional(),
    logradouro: z.string().min(1, 'Logradouro é obrigatório'),
    numero: z.string().min(1, 'Número é obrigatório'),
    complemento: z.string().optional(),
    bairro: z.string().min(1, 'Bairro é obrigatório'),
    cidade: z.string().min(1, 'Cidade é obrigatória'),
    estado: z.string().min(1, 'Estado é obrigatório'),
    rotaId: z.string().min(1, 'Rota é obrigatória'),
    rotaNome: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    observacao: z.string().optional(),
    status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  }),
  z.object({
    tipoPessoa: z.literal('Juridica'),
    nomeExibicao: z.string().min(1, 'Razão social é obrigatória'),
    cnpj: cnpjSchema,
    razaoSocial: z.string().optional(),
    nomeFantasia: z.string().optional(),
    inscricaoEstadual: z.string().optional(),
    email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
    telefonePrincipal: phoneSchema,
    contatos: z.array(contatoSchema).optional(),
    cep: cepSchema.optional(),
    logradouro: z.string().min(1, 'Logradouro é obrigatório'),
    numero: z.string().min(1, 'Número é obrigatório'),
    complemento: z.string().optional(),
    bairro: z.string().min(1, 'Bairro é obrigatório'),
    cidade: z.string().min(1, 'Cidade é obrigatória'),
    estado: z.string().min(1, 'Estado é obrigatório'),
    rotaId: z.string().min(1, 'Rota é obrigatória'),
    rotaNome: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    observacao: z.string().optional(),
    status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
  }),
])

// Simplified schema for when we use cpfCnpj as a unified field (mobile pattern)
export const clienteFormUnifiedSchema = z.object({
  tipoPessoa: z.enum(['Fisica', 'Juridica']),
  nomeExibicao: z.string().min(1, 'Nome é obrigatório'),
  cpfCnpj: cpfOrCnpjSchema,
  rgIe: z.string().optional(),
  nomeCompleto: z.string().optional(),
  nomeFantasia: z.string().optional(),
  razaoSocial: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional().default(''),
  telefonePrincipal: phoneSchema,
  contatos: z.array(contatoSchema).optional().default([]),
  cep: cepSchema.optional().default(''),
  logradouro: z.string().min(1, 'Logradouro é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().optional().default(''),
  bairro: z.string().min(1, 'Bairro é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  estado: z.string().min(1, 'Estado é obrigatório'),
  rotaId: z.string().min(1, 'Rota é obrigatória').default(''),
  rotaNome: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  observacao: z.string().optional().default(''),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
}).refine(
  (data) => {
    const clean = data.cpfCnpj.replace(/\D/g, '')
    if (data.tipoPessoa === 'Fisica') {
      return validateCPF(data.cpfCnpj) && clean.length === 11
    }
    return true
  },
  { message: 'CPF inválido', path: ['cpfCnpj'] }
).refine(
  (data) => {
    const clean = data.cpfCnpj.replace(/\D/g, '')
    if (data.tipoPessoa === 'Juridica') {
      return validateCNPJ(data.cpfCnpj) && clean.length === 14
    }
    return true
  },
  { message: 'CNPJ inválido', path: ['cpfCnpj'] }
)

// ============================================================================
// PRODUTO SCHEMAS
// ============================================================================

export const produtoFormSchema = z.object({
  identificador: z.string().min(1, 'Identificador é obrigatório'),
  numeroRelogio: z.string().min(1, 'Número do relógio é obrigatório'),
  tipoId: z.string().min(1, 'Tipo é obrigatório'),
  tipoNome: z.string().min(1, 'Nome do tipo é obrigatório'),
  descricaoId: z.string().min(1, 'Descrição é obrigatória'),
  descricaoNome: z.string().min(1, 'Nome da descrição é obrigatório'),
  tamanhoId: z.string().min(1, 'Tamanho é obrigatório'),
  tamanhoNome: z.string().min(1, 'Nome do tamanho é obrigatório'),
  codigoCH: z.string().optional(),
  codigoABLF: z.string().optional(),
  conservacao: z.enum(['Ótima', 'Boa', 'Regular', 'Ruim', 'Péssima'], {
    errorMap: () => ({ message: 'Conservação é obrigatória' }),
  }),
  statusProduto: z.enum(['Ativo', 'Inativo', 'Manutenção']).default('Ativo'),
  dataFabricacao: z.string().optional(),
  dataUltimaManutencao: z.string().optional(),
  relatorioUltimaManutencao: z.string().optional(),
  estabelecimento: z.string().optional(),
  observacao: z.string().optional(),
})

// ============================================================================
// PRODUTO ALTERAR RELÓGIO SCHEMA
// ============================================================================

export const produtoAlterarRelogioSchema = z.object({
  produtoId: z.string().min(1, 'Produto é obrigatório'),
  relogioNovo: z.string().min(1, 'Novo número do relógio é obrigatório'),
  motivo: z.string().min(1, 'Motivo é obrigatório'),
  relogioAnterior: z.string().optional(),
})

// ============================================================================
// LOCAÇÃO SCHEMAS
// ============================================================================

export const locacaoFormSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  clienteNome: z.string().min(1, 'Nome do cliente é obrigatório'),
  produtoId: z.string().min(1, 'Produto é obrigatório'),
  produtoIdentificador: z.string().min(1, 'Identificador do produto é obrigatório'),
  produtoTipo: z.string().min(1, 'Tipo do produto é obrigatório'),
  dataLocacao: z.string().min(1, 'Data da locação é obrigatória'),
  observacao: z.string().optional(),
  formaPagamento: z.enum(['Periodo', 'PercentualPagar', 'PercentualReceber'], {
    errorMap: () => ({ message: 'Forma de pagamento é obrigatória' }),
  }),
  numeroRelogio: z.string().min(1, 'Número do relógio é obrigatório'),
  precoFicha: positiveRequiredSchema,
  percentualEmpresa: percentageSchema,
  percentualCliente: percentageSchema,
  periodicidade: z.enum(['Mensal', 'Semanal', 'Quinzenal', 'Diária']).optional(),
  valorFixo: z.number().min(0, 'Valor fixo não pode ser negativo').optional(),
  dataPrimeiraCobranca: z.string().optional(),
  trocaPano: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.formaPagamento === 'Periodo') {
      return !!data.periodicidade && data.periodicidade.length > 0
    }
    return true
  },
  { message: 'Periodicidade é obrigatória para pagamento por período', path: ['periodicidade'] }
).refine(
  (data) => {
    if (data.formaPagamento === 'Periodo') {
      return data.valorFixo !== undefined && data.valorFixo > 0
    }
    return true
  },
  { message: 'Valor fixo é obrigatório para pagamento por período', path: ['valorFixo'] }
).refine(
  (data) => {
    if (data.formaPagamento !== 'Periodo') {
      return data.percentualEmpresa + data.percentualCliente === 100
    }
    return true
  },
  { message: 'Percentuais devem somar 100%', path: ['percentualCliente'] }
)

// ============================================================================
// COBRANÇA SCHEMAS
// ============================================================================

export const cobrancaFormSchema = z.object({
  locacaoId: z.string().min(1, 'Locação é obrigatória'),
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  clienteNome: z.string().min(1, 'Nome do cliente é obrigatório'),
  produtoIdentificador: z.string().min(1, 'Produto é obrigatório'),
  dataInicio: z.string().min(1, 'Data de início é obrigatória'),
  dataFim: z.string().min(1, 'Data de fim é obrigatória'),
  relogioAnterior: z.number().min(0, 'Leitura anterior não pode ser negativa'),
  relogioAtual: z.number().min(0, 'Leitura atual não pode ser negativa'),
  descontoPartidasQtd: z.number().min(0, 'Desconto não pode ser negativo').optional(),
  descontoPartidasValor: z.number().min(0, 'Desconto não pode ser negativo').optional(),
  descontoDinheiro: z.number().min(0, 'Desconto não pode ser negativo').optional(),
  observacao: z.string().optional(),
}).refine(
  (data) => data.relogioAtual >= data.relogioAnterior,
  { message: 'Leitura atual não pode ser menor que a anterior', path: ['relogioAtual'] }
)

export const cobrancaPagamentoSchema = z.object({
  cobrancaId: z.string().min(1, 'Cobrança é obrigatória'),
  valorRecebido: z.number().min(0, 'Valor recebido não pode ser negativo'),
  observacao: z.string().optional(),
})

// ============================================================================
// ROTA SCHEMAS
// ============================================================================

export const rotaFormSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hexadecimal').default('#2563EB'),
  regiao: z.string().optional(),
  ordem: z.number().min(0, 'Ordem não pode ser negativa').default(0),
  observacao: z.string().optional(),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
})

// ============================================================================
// MANUTENÇÃO SCHEMAS
// ============================================================================

export const manutencaoFormSchema = z.object({
  produtoId: z.string().min(1, 'Produto é obrigatório'),
  tipo: z.enum(['trocaPano', 'manutencao'], {
    errorMap: () => ({ message: 'Tipo de manutenção é obrigatório' }),
  }),
  descricao: z.string().optional(),
  data: z.string().min(1, 'Data é obrigatória'),
})

// ============================================================================
// USUÁRIO SCHEMAS
// ============================================================================

export const permissaoWebSchema = z.object({
  clientes: z.boolean().default(false),
  produtos: z.boolean().default(false),
  rotas: z.boolean().default(false),
  locacaoRelocacaoEstoque: z.boolean().default(false),
  cobrancas: z.boolean().default(false),
  manutencoes: z.boolean().default(false),
  relogios: z.boolean().default(false),
  relatorios: z.boolean().default(false),
  dashboard: z.boolean().default(false),
  agenda: z.boolean().default(false),
  mapa: z.boolean().default(false),
  adminCadastros: z.boolean().default(false),
  adminUsuarios: z.boolean().default(false),
  adminDispositivos: z.boolean().default(false),
  adminSincronizacao: z.boolean().default(false),
  adminAuditoria: z.boolean().default(false),
})

export const permissaoMobileSchema = z.object({
  clientes: z.boolean().default(false),
  produtos: z.boolean().default(false),
  alteracaoRelogio: z.boolean().default(false),
  locacaoRelocacaoEstoque: z.boolean().default(false),
  cobrancasFaturas: z.boolean().default(false),
  manutencoes: z.boolean().default(false),
  relatorios: z.boolean().default(false),
  sincronizacao: z.boolean().default(false),
})

export const usuarioFormSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').optional(),
  tipoPermissao: z.enum(['Administrador', 'Secretario', 'AcessoControlado'], {
    errorMap: () => ({ message: 'Tipo de permissão é obrigatório' }),
  }),
  permissoesWeb: permissaoWebSchema.optional(),
  permissoesMobile: permissaoMobileSchema.optional(),
  rotasPermitidas: z.array(z.string()).optional(),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo'),
})

// ============================================================================
// DISPOSITIVO / ATIVAÇÃO SCHEMAS
// ============================================================================

export const deviceActivationSchema = z.object({
  dispositivoId: z.string().min(1, 'ID do dispositivo é obrigatório'),
  deviceKey: z.string().min(1, 'Chave do dispositivo é obrigatória'),
  deviceName: z.string().min(1, 'Nome do dispositivo é obrigatório'),
  senhaNumerica: z.string().length(6, 'Senha deve ter 6 dígitos').regex(/^\d{6}$/, 'Senha deve conter apenas números'),
})

// ============================================================================
// ATRIBUTOS DE PRODUTO SCHEMAS
// ============================================================================

export const tipoProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome do tipo é obrigatório'),
})

export const descricaoProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome da descrição é obrigatório'),
})

export const tamanhoProdutoSchema = z.object({
  nome: z.string().min(1, 'Nome do tamanho é obrigatório'),
})

// ============================================================================
// METAS SCHEMAS
// ============================================================================

export const metaFormSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  tipo: z.enum(['receita', 'cobrancas', 'adimplencia']).default('receita'),
  valorMeta: positiveRequiredSchema,
  dataInicio: z.string().min(1, 'Data de início é obrigatória'),
  dataFim: z.string().min(1, 'Data de fim é obrigatória'),
  rotaId: z.string().optional(),
}).refine(
  (data) => {
    if (data.dataInicio && data.dataFim) {
      return new Date(data.dataFim) >= new Date(data.dataInicio)
    }
    return true
  },
  { message: 'Data fim deve ser posterior à data início', path: ['dataFim'] }
)

// ============================================================================
// SYNC SCHEMAS
// ============================================================================

export const syncPayloadSchema = z.object({
  deviceId: z.string().min(1, 'Device ID é obrigatório'),
  deviceKey: z.string().min(1, 'Device key é obrigatória'),
  lastSyncAt: z.string().min(1, 'Last sync timestamp é obrigatório'),
})

// ============================================================================
// PASSWORD STRENGTH
// ============================================================================

export const SENHA_REQUISITOS = [
  { key: 'length', label: 'Mínimo 8 caracteres', test: (s: string) => s.length >= 8 },
  { key: 'upper', label: 'Uma letra maiúscula', test: (s: string) => /[A-Z]/.test(s) },
  { key: 'lower', label: 'Uma letra minúscula', test: (s: string) => /[a-z]/.test(s) },
  { key: 'number', label: 'Um número', test: (s: string) => /[0-9]/.test(s) },
  { key: 'special', label: 'Um caractere especial', test: (s: string) => /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?\/]/.test(s) },
] as const

// ============================================================================
// VALIDATION HELPER — para uso direto sem Zod schemas
// ============================================================================

export const validationHelpers = {
  isValidCPF: validateCPF,
  isValidCNPJ: validateCNPJ,
  isValidPhone: validatePhone,
  isValidCEP: validateCEP,
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>

export type ContatoInput = z.infer<typeof contatoSchema>
export type ClienteFormInput = z.infer<typeof clienteFormUnifiedSchema>
export type ProdutoFormInput = z.infer<typeof produtoFormSchema>
export type ProdutoAlterarRelogioInput = z.infer<typeof produtoAlterarRelogioSchema>
export type LocacaoFormInput = z.infer<typeof locacaoFormSchema>
export type CobrancaFormInput = z.infer<typeof cobrancaFormSchema>
export type CobrancaPagamentoInput = z.infer<typeof cobrancaPagamentoSchema>
export type RotaFormInput = z.infer<typeof rotaFormSchema>
export type ManutencaoFormInput = z.infer<typeof manutencaoFormSchema>
export type UsuarioFormInput = z.infer<typeof usuarioFormSchema>
export type DeviceActivationInput = z.infer<typeof deviceActivationSchema>
export type TipoProdutoInput = z.infer<typeof tipoProdutoSchema>
export type DescricaoProdutoInput = z.infer<typeof descricaoProdutoSchema>
export type TamanhoProdutoInput = z.infer<typeof tamanhoProdutoSchema>
export type MetaFormInput = z.infer<typeof metaFormSchema>
export type SyncPayloadInput = z.infer<typeof syncPayloadSchema>
