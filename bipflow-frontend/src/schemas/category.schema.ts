import { z } from "zod";

/**
 * --- 1. CORE SCHEMA (Read Modeling) ---
 * Reflects exactly what Django sends in GET.
 * Protected against null values and inconsistent data.
 */
export const CategorySchema = z.object({
  id: z.number(),
  name: z
    .string()
    .min(2, "Category name must have at least 2 characters")
    .max(50, "Category name is too long"),
  description: z.string().nullable().optional().default(""), // Ensure empty string to prevent rendering errors in Vue
  slug: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? ""),
  product_count: z.number().int().nonnegative().optional().default(0),
  created_at: z.string().optional(), // Removed .datetime() in case Django sends ISO formatted with timezone
});

/**
 * --- 2. MUTATION SCHEMA (Write Modeling) ---
 * Omit fields that are exclusively the Backend's responsibility.
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
