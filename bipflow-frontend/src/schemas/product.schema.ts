import { z } from 'zod';

/**
 * 🛰️ BipFlow Product Schema - Enterprise Grade
 * Estruturado para escalabilidade, suportando tipos parciais e coerção de dados.
 */

// 1. Definições de Base (Reutilizáveis)
const productBase = {
  name: z.string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name too long for registry"),
  
  description: z.string().nullable().optional(),
  
  // .coerce é vital para inputs de formulário que retornam strings
  price: z.coerce.number()
    .min(0, "Price cannot be negative")
    .default(0),
  
  // Mapeamos para aceitar 'stock' ou 'stock_quantity' via transform se necessário, 
  // mas aqui mantemos o padrão do seu Django.
  stock_quantity: z.coerce.number()
    .int()
    .nonnegative()
    .default(0),

  // Categoria: Aceita o ID (number) ou null se não selecionado
  category: z.coerce.number()
    .positive("Please select a valid category")
    .nullable()
    .optional(),

  is_available: z.boolean().default(true),
  size: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
};

// 2. Schema Principal (O que a aplicação usa para validar)
export const ProductSchema = z.object({
  id: z.number().optional(),
  ...productBase,
  
  // Campos somente leitura vindos do Django
  category_name: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * 🧪 Schema de Criação/Edição (O que o formulário envia)
 * Usamos .omit() para remover campos que o Frontend não deve enviar ao Django.
 */
export const ProductFormSchema = ProductSchema.omit({
  id: true,
  category_name: true,
  created_at: true,
  updated_at: true,
  slug: true // Geralmente o Django gera o slug via Name
});

// 3. Tipagem Inferida
export type Product = z.infer<typeof ProductSchema>;
export type ProductFormData = z.infer<typeof ProductFormSchema>;