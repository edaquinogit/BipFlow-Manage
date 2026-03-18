import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.number().optional(),
  name: z.string().min(2, "O nome da categoria é obrigatório"),
  description: z.string().nullable().optional(),
  slug: z.string().optional(),
  product_count: z.number().optional().default(0), // Campo calculado que o Django costuma enviar
});

export type Category = z.infer<typeof CategorySchema>;