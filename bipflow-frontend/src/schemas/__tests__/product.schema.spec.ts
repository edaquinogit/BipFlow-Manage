import { describe, expect, it } from 'vitest'

import { ProductFormSchema } from '../product.schema'

describe('ProductFormSchema', () => {
  const validPayload = {
    name: 'Coxinha premium',
    price: '18.50',
    stock_quantity: '3',
    category: '2',
    sku: '',
    size: '',
    image: null,
    images: [],
    description: '',
  }

  it('coerces dashboard form values into the Django write contract', () => {
    const result = ProductFormSchema.safeParse(validPayload)

    expect(result.success).toBe(true)

    if (!result.success) return

    expect(result.data.price).toBe(18.5)
    expect(result.data.stock_quantity).toBe(3)
    expect(result.data.category).toBe(2)
  })

  it('requires a category before product creation reaches the API', () => {
    const result = ProductFormSchema.safeParse({
      ...validPayload,
      category: undefined,
    })

    expect(result.success).toBe(false)

    if (result.success) return

    const fieldErrors = result.error.flatten().fieldErrors
    expect(fieldErrors.category?.[0]).toBe('Please select a classification')
  })
})
