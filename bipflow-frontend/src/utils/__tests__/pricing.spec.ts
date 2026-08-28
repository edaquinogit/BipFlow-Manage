import { describe, expect, it } from 'vitest'
import { displayPrice, effectiveUnitPrice } from '../pricing'
import type { Product, ProductVariant } from '@/types/product'

const variant = (over: Partial<ProductVariant>): ProductVariant => ({
  id: 1,
  name: 'V',
  color_hex: '#111827',
  price: null,
  effective_price: '',
  stock_quantity: 5,
  image: null,
  is_active: true,
  position: 0,
  ...over,
})

const product = (over: Partial<Product>): Product => ({
  id: 1,
  name: 'P',
  slug: 'p',
  price: '59.90',
  category: { id: 1, name: 'C', slug: 'c' },
  image: null,
  stock_quantity: 10,
  is_available: true,
  created_at: '2026-01-01T00:00:00Z',
  variants: [],
  ...over,
})

describe('effectiveUnitPrice', () => {
  it('returns the base price when there is no variant', () => {
    expect(effectiveUnitPrice(product({ price: '59.90' }))).toBe('59.90')
  })

  it('prefers the server-resolved effective_price', () => {
    expect(
      effectiveUnitPrice(product({ price: '59.90' }), variant({ effective_price: '69.90' })),
    ).toBe('69.90')
  })

  it('falls back to the raw override when effective_price is missing', () => {
    expect(
      effectiveUnitPrice(product({ price: '59.90' }), variant({ price: '64.90', effective_price: '' })),
    ).toBe('64.90')
  })

  it('inherits the base price for a variant with no price at all', () => {
    expect(
      effectiveUnitPrice(product({ price: '59.90' }), variant({ price: null, effective_price: '' })),
    ).toBe('59.90')
  })
})

describe('displayPrice', () => {
  it('is a single price when the product has no variants', () => {
    expect(displayPrice(product({ price: '59.90' }))).toEqual({ amount: '59.90', from: false })
  })

  it('is a single price when active variants all cost the same', () => {
    const p = product({
      price: '59.90',
      variants: [
        variant({ id: 1, effective_price: '59.90' }),
        variant({ id: 2, effective_price: '59.90' }),
      ],
    })
    expect(displayPrice(p)).toEqual({ amount: '59.90', from: false })
  })

  it('is "from the cheapest" when active variants disagree', () => {
    const p = product({
      price: '59.90',
      variants: [
        variant({ id: 1, effective_price: '59.90' }),
        variant({ id: 2, effective_price: '69.90' }),
        variant({ id: 3, effective_price: '49.90' }),
      ],
    })
    expect(displayPrice(p)).toEqual({ amount: '49.90', from: true })
  })

  it('ignores inactive variants', () => {
    const p = product({
      price: '59.90',
      variants: [
        variant({ id: 1, effective_price: '59.90', is_active: true }),
        variant({ id: 2, effective_price: '999.00', is_active: false }),
      ],
    })
    expect(displayPrice(p)).toEqual({ amount: '59.90', from: false })
  })
})
