// packages/shared/src/schemas.ts
// Zod schemas compartilhados entre web e mobile
// Garante que as validações sejam idênticas no servidor e no cliente

import { z } from 'zod'

// ─── Auth ────────────────────────────────────────────────────────

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

// ─── Password strength ───────────────────────────────────────────

export const SENHA_REQUISITOS = [
  { key: 'length', label: 'Mínimo 8 caracteres', test: (s: string) => s.length >= 8 },
  { key: 'upper', label: 'Uma letra maiúscula', test: (s: string) => /[A-Z]/.test(s) },
  { key: 'lower', label: 'Uma letra minúscula', test: (s: string) => /[a-z]/.test(s) },
  { key: 'number', label: 'Um número', test: (s: string) => /[0-9]/.test(s) },
  { key: 'special', label: 'Um caractere especial', test: (s: string) => /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?\/]/.test(s) },
] as const

// ─── Type exports ────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
