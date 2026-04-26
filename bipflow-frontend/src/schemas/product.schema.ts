import { z } from "zod";

/**
 * ---------------------------------------------------------
 * 📦 1. DOMÍNIO DE CATEGORIAS
 * ---------------------------------------------------------
 */
export const CategorySchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Category name is required"),
  slug: z.string().nullable().optional(),
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
const REQUIRED_CATEGORY_MESSAGE = "Please select a classification";

const ProductGalleryImageSchema = z.union([
  z.string().url(),
  z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, `Image too heavy. Max limit is 2MB.`)
    .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .png and .webp formats are supported."),
]);

const OptionalCategoryReferenceSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.union([
    z.coerce.number().int().positive(REQUIRED_CATEGORY_MESSAGE),
    CategorySchema,
    z.undefined(),
  ]),
);

const RequiredCategoryIdSchema = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? 0 : value),
  z.coerce.number().int().positive(REQUIRED_CATEGORY_MESSAGE),
);

const productBase = {
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name too long for registry"),

  description: z.string().nullable().optional(),

  sku: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 4, {
      message: "SKU must be at least 4 characters if provided",
    })
    .transform((val) => val?.toUpperCase() || undefined)
    .nullable(),

  // Coerção Inteligente: Garante que o input do form vire número real
  price: z.coerce.number().min(0, "Price cannot be negative").default(0),

  stock_quantity: z.coerce
    .number()
    .int("Stock must be an integer")
    .nonnegative("Stock cannot be negative")
    .default(0),

  // Categoria de leitura: suporta ID cru do Django, objeto normalizado ou payload legado sem categoria.
  category: OptionalCategoryReferenceSchema,

  is_available: z.boolean().default(true),
  size: z.string().nullable().optional(),

  /**
   * 🛡️ ASSET MEDIA GUARD (2MB Limit)
   * Validação multimodal para URLs existentes e Novos Uploads.
   */
  image: z
    .any()
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

  images: z
    .array(ProductGalleryImageSchema)
    .max(3, "You can upload up to 3 images per product.")
    .optional()
    .default([]),
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
export const ProductFormSchema = z.object({
  ...productBase,
  category: RequiredCategoryIdSchema,
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
export type ProductFormDraft = Partial<Omit<ProductFormData, "category">> & {
  category?: ProductFormData["category"] | null;
};

export const createEmptyProduct = (): ProductFormDraft => ({
  name: "",
  price: 0,
  stock_quantity: 0,
  category: undefined,
  is_available: true,
  sku: "",
  size: "",
  image: null,
  images: [],
  description: "",
});
