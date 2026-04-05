import { z } from "zod";

/**
 * ---------------------------------------------------------
 * 📦 1. DOMÍNIO DE CATEGORIAS
 * ---------------------------------------------------------
 */
export const CategorySchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Category name is required"),
  slug: z.string().optional(),
});

/**
 * ---------------------------------------------------------
 * 🚀 2. DOMÍNIO DE PRODUTOS (CORE ASSETS)
 * ---------------------------------------------------------
 */

// Trava de Segurança NYC: 2MB em Bytes
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const productBase = {
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name too long for registry"),

  description: z.string().nullable().optional(),

  /** Matches Django `CharField(max_length=50, blank=True, null=True, unique=True)`. */
  sku: z
    .union([z.string(), z.null()])
    .optional()
    .transform((val) => {
      if (val == null || val === "") return null;
      const u = String(val).trim().toUpperCase();
      return u === "" ? null : u;
    })
    .refine((s) => s === null || s.length <= 50, "SKU exceeds 50 characters"),

  // Coerção Inteligente: Garante que o input do form vire número real
  price: z.coerce.number().min(0, "Price cannot be negative").default(0),

  stock_quantity: z.coerce
    .number()
    .int("Stock must be an integer")
    .nonnegative("Stock cannot be negative")
    .default(0),

  // Categoria: Suporta ID (Number) ou Objeto Completo
  category: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.union([
      z.coerce.number().positive("Please select a classification"),
      CategorySchema,
      z.undefined(),
    ]),
  ),

  is_available: z.boolean().default(true),
  size: z.string().nullable().optional(),

  /**
   * 🛡️ ASSET MEDIA GUARD (2MB Limit)
   * Validação multimodal para URLs existentes e Novos Uploads.
   */
  image: z
    .union([z.instanceof(File), z.string(), z.null(), z.undefined()])
    .refine((file) => {
      if (!file || typeof file === "string") return true;
      return file instanceof File;
    }, "Invalid file format.")
    .refine((file) => {
      if (!(file instanceof File)) return true;
      return file.size <= MAX_FILE_SIZE;
    }, `Image too heavy. Max limit is 2MB.`)
    .refine((file) => {
      if (!(file instanceof File)) return true;
      return ACCEPTED_IMAGE_TYPES.includes(file.type);
    }, "Only .jpg, .png and .webp formats are supported.")
    .nullable()
    .optional(),
};

// Schema de Leitura (API Response)
export const ProductSchema = z.object({
  id: z.number().optional(),
  ...productBase,
  category_name: z.string().optional(),
  slug: z.string().nullable().optional(),
  price: z.preprocess(
    (val) => parseFloat(val as string),
    z.number().nonnegative(),
  ),
  stock_quantity: z.preprocess(
    (val) => parseInt(val as string),
    z.number().nonnegative(),
  ),
  image_url: z.string().url().nullable().optional(),
  created_at: z.string().optional(), // mais flexível
  updated_at: z.string().optional(),
});

// Schema de Escrita (Formulário)
export const ProductFormSchema = ProductSchema.omit({
  id: true,
  category_name: true,
  created_at: true,
  updated_at: true,
  slug: true,
});

/**
 * ---------------------------------------------------------
 * 🛒 3. DOMÍNIO DE PEDIDOS (LEGACY INTEGRATION)
 * ---------------------------------------------------------
 */

export const OrderItemSchema = z.object({
  idItem: z.string().min(1, "Item ID is required"),
  quantidadeItem: z.number().positive("Quantity must be positive"),
  valorItem: z.number().positive("Value must be positive"),
});

export const CreateOrderSchema = z.object({
  numeroPedido: z
    .string()
    .min(1, "Order number is required")
    .regex(/^[a-zA-Z0-9\-]+$/, "Invalid characters in order number"),
  valorTotal: z.number().positive().finite(),
  dataCriacao: z.string().datetime(),
  items: z.array(OrderItemSchema).default([]),
});

/**
 * ---------------------------------------------------------
 * 🏷️ 4. EXPORTS DE TIPOS & FACTORIES
 * ---------------------------------------------------------
 */

export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type ProductFormData = z.infer<typeof ProductFormSchema>;

export const createEmptyProduct = (): ProductFormData => ({
  name: "",
  price: 0,
  stock_quantity: 0,
  category: undefined,
  is_available: true,
  sku: "",
  size: "",
  image: null,
  description: "",
});
