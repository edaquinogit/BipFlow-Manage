import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.number().optional(),
  name: z.string()
    .min(3, "O nome do produto deve ter pelo menos 3 caracteres")
    .max(50, "Nome muito longo"),
  
  // 🚀 A MÁGICA ESTÁ AQUI:
  // z.coerce.number() tenta transformar "150.00" em 150.00 antes de validar
  price: z.coerce.number()
    .positive("O preço deve ser um valor positivo"),
    
  category: z.string().min(1, "A categoria é obrigatória"),
  
  // Também é bom usar coerce no stock, caso o Django mande como string
  stock: z.coerce.number().int().nonnegative().default(0),
});

export type Product = z.infer<typeof ProductSchema>;