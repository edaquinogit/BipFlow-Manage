import type { Product } from '@/schemas/product.schema'

/**
 * Prepare dashboard form payloads for Django without destroying File objects.
 *
 * The previous implementation used JSON serialization as a deep-clone step,
 * which coerced `File` into `{}` and silently dropped image uploads before
 * they could be appended to FormData.
 */
export function sanitizePayloadForDjango(
  rawPayload: Partial<Product>
): Partial<Product> {
  const {
    id: _id,
    created_at: _created_at,
    updated_at: _updated_at,
    category_name: _category_name,
    is_available: _is_available,
    ...cleanData
  } = rawPayload as Partial<Product> & Record<string, unknown>

  if (!cleanData.image) {
    delete cleanData.image
  }

  if (Array.isArray(cleanData.images)) {
    const normalizedImages = cleanData.images.filter((entry) => {
      if (!entry) {
        return false
      }

      return typeof entry === 'string' || entry instanceof File
    })

    if (normalizedImages.length > 0) {
      cleanData.images = normalizedImages.slice(0, 3) as Partial<Product>['images']
    } else {
      delete cleanData.images
    }
  } else {
    delete cleanData.images
  }

  return { ...cleanData } as Partial<Product>
}
