import { z } from "zod";

/**
 * --- 1. CORE SCHEMA (Modelagem de Leitura) ---
 * Reflete exatamente o que o Django envia no GET.
 * Blindado contra valores nulos e dados inconsistentes.
 */
export const CategorySchema = z.object({
  id: z.number(),
  name: z
    .string()
    .min(2, "Category name must have at least 2 characters")
    .max(50, "Category name is too long"),
  description: z.string().nullable().optional().default(""), // Garantimos uma string vazia para evitar erros de renderização no Vue
  slug: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? ""),
  product_count: z.number().int().nonnegative().optional().default(0),
  created_at: z.string().optional(), // Removido .datetime() se o Django enviar ISO formatada com timezone
});

/**
 * --- 2. MUTATION SCHEMA (Modelagem de Escrita) ---
 * Omitimos os campos que são de responsabilidade exclusiva do Backend.
 */
export const CategoryCreateSchema = CategorySchema.omit({
  id: true,
  slug: true,
  product_count: true,
  created_at: true,
});

/**
 * --- TYPE INFERENCE ---
 */
export type Category = z.infer<typeof CategorySchema>;
export type CategoryCreatePayload = z.infer<typeof CategoryCreateSchema>;

/**
 * --- NYC FACTORY PATTERN ---
 * Gera um estado inicial limpo para o BipFlow Registry.
 */
export const createEmptyCategory = (): CategoryCreatePayload => ({
  name: "",
  description: "", // Mantendo consistência com o default do schema
});

export const CategoryPayloadSchema = CategorySchema.omit({ id: true, slug: true, product_count: true, created_at: true });
export type CategoryPayload = z.infer<typeof CategoryPayloadSchema>;
