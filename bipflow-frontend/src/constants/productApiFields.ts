/**
 * Writable `api.Product` fields for multipart/JSON (matches Django `Product` + serializer).
 * Excludes read-only: `id`, `slug`, `category_name`, `created_at`, `updated_at`.
 */
export const PRODUCT_WRITABLE_API_KEYS = [
  "sku",
  "name",
  "description",
  "price",
  "size",
  "stock_quantity",
  "is_available",
  "category",
  "image",
] as const;

export type ProductWritableApiKey = (typeof PRODUCT_WRITABLE_API_KEYS)[number];

export const PRODUCT_WRITABLE_KEY_SET = new Set<string>(
  PRODUCT_WRITABLE_API_KEYS,
);
