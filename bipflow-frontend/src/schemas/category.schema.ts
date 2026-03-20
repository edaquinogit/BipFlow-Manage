import { z } from 'zod';

/**
 * BIPFLOW CATEGORY ARCHITECTURE
 * Este schema reflete o contrato entre o Django REST Framework e o Vue 3.
 * Incluímos suporte para campos opcionais e transformações de segurança.
 */
export const CategorySchema = z.object({
  // Identificador único (Opcional apenas durante a criação no front)
  id: z.number().optional(),

  // Nome da categoria com validação mínima
  name: z.string()
    .min(2, "Category name must have at least 2 characters")
    .max(50, "Category name is too long"),

  // Descrição: Tratamos explicitamente como nulo ou opcional
  description: z.string()
    .nullable()
    .optional()
    .default(null),

  /**
   * 🛡️ FIX: SLUG NULL-SAFETY
   * O erro "expected string, received null" é resolvido aqui.
   * Aceitamos nulo e transformamos em string vazia se necessário para evitar quebras no UI.
   */
  slug: z.string()
    .nullable()
    .optional()
    .transform((val) => val ?? ""),

  // Campo calculado (Agregação do Django)
  product_count: z.number()
    .int()
    .nonnegative()
    .optional()
    .default(0),

  // Metadados de Auditoria (Opcionais para exibição em Tooltips/Logs)
  created_at: z.string().datetime().optional(),
});

/**
 * TYPE INFERENCE
 * Extraímos a tipagem estática diretamente do Schema do Zod.
 */
export type Category = z.infer<typeof CategorySchema>;

/**
 * NYC FACTORY PATTERN (Opcional)
 * Função auxiliar para gerar um estado inicial limpo para o formulário.
 */
export const createEmptyCategory = (): Partial<Category> => ({
  name: '',
  description: null,
  slug: '',
  product_count: 0
});