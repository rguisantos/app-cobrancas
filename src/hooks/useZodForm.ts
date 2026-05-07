/**
 * useZodForm.ts
 * Hook reutilizável para validação de formulários com Zod
 *
 * Integra validação Zod com o padrão de formulários do app mobile.
 * Substitui as funções manuais validateForm() em todos os forms.
 *
 * Uso:
 * const { formData, errors, setField, validate, setFormData } = useZodForm(clienteFormUnifiedSchema, {
 *   nomeExibicao: '',
 *   cpfCnpj: '',
 *   ...
 * })
 */

import { useState, useCallback, useMemo } from 'react';
import { ZodSchema, ZodError } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface UseZodFormReturn<T> {
  /** Valores atuais do formulário */
  formData: T;
  /** Erros de validação por campo */
  errors: Record<string, string>;
  /** Se o formulário foi submetido ao menos uma vez (mostra erros só depois) */
  isSubmitted: boolean;
  /** Se a validação está em andamento */
  isValidating: boolean;
  /** Atualiza um campo individual e limpa o erro desse campo */
  setField: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Atualiza múltiplos campos de uma vez */
  setFields: (fields: Partial<T>) => void;
  /** Substitui todo o formData */
  setFormData: (data: T) => void;
  /** Limpa os erros */
  clearErrors: () => void;
  /** Limpa o erro de um campo específico */
  clearFieldError: (field: keyof T) => void;
  /** Valida o formulário inteiro. Retorna true se válido. */
  validate: () => boolean;
  /** Valida o formulário e retorna os dados validados ou null se inválido */
  validateAndGet: () => T | null;
  /** Reseta o formulário para os valores iniciais */
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useZodForm<T extends Record<string, any>>(
  schema: ZodSchema<T>,
  initialValues: T
): UseZodFormReturn<T> {
  const [formData, setFormDataState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Memoriza valores iniciais para reset
  const initialMemo = useMemo(() => initialValues, []);

  /**
   * Converte ZodError para Record<string, string>
   */
  const parseZodErrors = useCallback((error: ZodError): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const fieldPath = issue.path.join('.');
      // Pega só a primeira mensagem de erro por campo
      if (!fieldErrors[fieldPath]) {
        fieldErrors[fieldPath] = issue.message;
      }
    }
    return fieldErrors;
  }, []);

  /**
   * Atualiza um campo individual e limpa o erro
   */
  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormDataState(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo ao digitar
    setErrors(prev => {
      if (prev[field as string]) {
        const next = { ...prev };
        delete next[field as string];
        return next;
      }
      return prev;
    });
  }, []);

  /**
   * Atualiza múltiplos campos
   */
  const setFields = useCallback((fields: Partial<T>) => {
    setFormDataState(prev => ({ ...prev, ...fields }));
    // Limpar erros dos campos atualizados
    setErrors(prev => {
      const next = { ...prev };
      for (const key of Object.keys(fields)) {
        delete next[key];
      }
      return next;
    });
  }, []);

  /**
   * Substitui todo o formData
   */
  const setFormData = useCallback((data: T) => {
    setFormDataState(data);
    setErrors({});
  }, []);

  /**
   * Limpa todos os erros
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Limpa o erro de um campo específico
   */
  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
  }, []);

  /**
   * Valida o formulário inteiro
   * Retorna true se válido, false caso contrário
   */
  const validate = useCallback((): boolean => {
    setIsValidating(true);
    setIsSubmitted(true);
    try {
      schema.parse(formData);
      setErrors({});
      setIsValidating(false);
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        setErrors(parseZodErrors(error));
      }
      setIsValidating(false);
      return false;
    }
  }, [schema, formData, parseZodErrors]);

  /**
   * Valida e retorna os dados tipados ou null se inválido
   */
  const validateAndGet = useCallback((): T | null => {
    setIsValidating(true);
    setIsSubmitted(true);
    try {
      const result = schema.parse(formData);
      setErrors({});
      setIsValidating(false);
      return result;
    } catch (error) {
      if (error instanceof ZodError) {
        setErrors(parseZodErrors(error));
      }
      setIsValidating(false);
      return null;
    }
  }, [schema, formData, parseZodErrors]);

  /**
   * Reseta o formulário para os valores iniciais
   */
  const reset = useCallback(() => {
    setFormDataState(initialMemo);
    setErrors({});
    setIsSubmitted(false);
  }, [initialMemo]);

  return {
    formData,
    errors,
    isSubmitted,
    isValidating,
    setField,
    setFields,
    setFormData,
    clearErrors,
    clearFieldError,
    validate,
    validateAndGet,
    reset,
  };
}
