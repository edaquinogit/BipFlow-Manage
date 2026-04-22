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

  it('preserves persisted cover urls so multipart assembly can keep the first slot', () => {
    const result = sanitizePayloadForDjango({
      name: 'Produto existente',
      image: 'http://127.0.0.1:8000/media/products/2026/04/image.png',
    })

    expect(result.image).toBe('http://127.0.0.1:8000/media/products/2026/04/image.png')
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

  it('preserves mixed gallery payloads with uploaded files and persisted urls', () => {
    const secondFile = new File(['binary-image-2'], 'product-2.png', {
      type: 'image/png',
    })

    const result = sanitizePayloadForDjango({
      name: 'Produto com galeria',
      images: [
        'http://127.0.0.1:8000/media/products/2026/04/image.png',
        secondFile,
      ],
    })

    expect(result.images).toEqual([
      'http://127.0.0.1:8000/media/products/2026/04/image.png',
      secondFile,
    ])
  })

  it('preserves existing cover plus gallery so all 3 public images can be rebuilt', () => {
    const galleryFile = new File(['binary-image-3'], 'product-3.png', {
      type: 'image/png',
    })

    const result = sanitizePayloadForDjango({
      name: 'Produto com capa persistida',
      image: 'http://127.0.0.1:8000/media/products/2026/04/cover.png',
      images: [
        'http://127.0.0.1:8000/media/products/2026/04/gallery-1.png',
        galleryFile,
      ],
    })

    expect(result.image).toBe('http://127.0.0.1:8000/media/products/2026/04/cover.png')
    expect(result.images).toEqual([
      'http://127.0.0.1:8000/media/products/2026/04/gallery-1.png',
      galleryFile,
    ])
  })
})
