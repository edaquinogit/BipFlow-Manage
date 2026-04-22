import { describe, expect, it } from 'vitest'

import { sanitizePayloadForDjango } from '../productPayload'

describe('sanitizePayloadForDjango', () => {
  it('preserves uploaded image files for multipart submission', () => {
    const file = new File(['binary-image'], 'product.png', {
      type: 'image/png',
    })

    const result = sanitizePayloadForDjango({
      id: 10,
      name: 'Coxinha premium',
      price: 18.5,
      stock_quantity: 12,
      category: 2,
      image: file,
      category_name: 'Salgados',
      created_at: '2026-04-21T09:54:42.674999-03:00',
    })

    expect(result.id).toBeUndefined()
    expect(result.category_name).toBeUndefined()
    expect(result.created_at).toBeUndefined()
    expect(result.image).toBe(file)
  })

  it('removes persisted image urls to avoid overwriting binary uploads with text', () => {
    const result = sanitizePayloadForDjango({
      name: 'Produto existente',
      image: 'http://127.0.0.1:8000/media/products/2026/04/image.png',
    })

    expect(result.image).toBeUndefined()
  })

  it('removes empty image values while keeping editable business fields', () => {
    const result = sanitizePayloadForDjango({
      name: 'Produto sem imagem',
      price: 9.9,
      stock_quantity: 3,
      category: { id: 4, name: 'Categoria 2', slug: 'categoria-2' },
      image: null,
      is_available: true,
    })

    expect(result.image).toBeUndefined()
    expect(result.name).toBe('Produto sem imagem')
    expect(result.category).toEqual({ id: 4, name: 'Categoria 2', slug: 'categoria-2' })
    expect(result.is_available).toBeUndefined()
  })
})
