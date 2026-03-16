import { z } from 'zod';

/**
 * 🚀 Schema de Produto - Padrão Enterprise
 * Refatorado para aceitar dados reais (e imperfeitos) do Django.
 */
export const ProductSchema = z.object({
  id: z.number().optional(),
  
  // SKU e Slug: O Django enviou 'null', então usamos .nullable()
  sku: z.string().nullable().optional(), 
  slug: z.string().nullable().optional(),
  
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().nullable().optional(),
  
  // Coerce garante que '10.50' (string) vire 10.50 (number) automaticamente
  price: z.coerce.number().min(0, "Price cannot be negative"),
  
  size: z.string().nullable().optional(),
  
  stock_quantity: z.coerce.number().int().nonnegative().default(0),
  is_available: z.boolean().default(true),

  /**
   * 🖼️ Tratamento de Imagem:
   * Removemos o .url() estrito porque se a string vier vazia (""), 
   * o Zod daria erro. O .nullable() resolve o erro de 'null' do banco.
   */
  image: z.string().nullable().optional(),

  category: z.number(),
  category_name: z.string().optional(),
  created_at: z.string().optional(),
});

export type Product = z.infer<typeof ProductSchema>;