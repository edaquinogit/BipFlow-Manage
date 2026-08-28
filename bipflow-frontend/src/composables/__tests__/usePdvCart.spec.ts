import { describe, expect, it } from 'vitest'
import { usePdvCart } from '../usePdvCart'
import type { Product } from '@/schemas/product.schema'

const buildProduct = (overrides: Partial<Product> = {}): Product =>
  ({
    id: 1,
    name: 'Produto teste',
    price: 10,
    stock_quantity: 5,
    is_available: true,
    low_stock_threshold: null,
    public_code: 'ABCD2345',
    ...overrides,
  }) as Product

describe('usePdvCart', () => {
  it('starts empty', () => {
    const cart = usePdvCart()

    expect(cart.isEmpty.value).toBe(true)
    expect(cart.lines.value).toHaveLength(0)
    expect(cart.subtotal.value).toBe(0)
  })

  it('adds a scanned product as a new line', () => {
    const cart = usePdvCart()

    cart.addProduct(buildProduct())

    expect(cart.lines.value).toHaveLength(1)
    expect(cart.lines.value[0]).toMatchObject({
      lineKey: '1:default',
      productId: 1,
      publicCode: 'ABCD2345',
      variantId: null,
      variantName: '',
      variantColorHex: '',
      quantity: 1,
      unitPrice: 10,
    })
    expect(cart.isEmpty.value).toBe(false)
  })

  it('aggregates a second scan of the same product into the existing line', () => {
    const cart = usePdvCart()

    cart.addProduct(buildProduct())
    cart.addProduct(buildProduct())

    expect(cart.lines.value).toHaveLength(1)
    expect(cart.lines.value[0]?.quantity).toBe(2)
  })

  it('ignores a product without an id or public_code', () => {
    const cart = usePdvCart()

    cart.addProduct(buildProduct({ id: undefined }))
    cart.addProduct(buildProduct({ public_code: '' }))

    expect(cart.lines.value).toHaveLength(0)
  })

  it('rejects an unavailable product with a specific reason (Etapa R1 of the QR-code stock-exit refinement)', () => {
    const cart = usePdvCart()

    const result = cart.addProduct(buildProduct({ is_available: false }))

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(cart.lines.value).toHaveLength(0)
  })

  it('rejects a product with zero stock even if is_available is stale-true', () => {
    const cart = usePdvCart()

    const result = cart.addProduct(buildProduct({ stock_quantity: 0 }))

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(cart.lines.value).toHaveLength(0)
  })

  it('rejects a variant-managed product without a selected variant', () => {
    const cart = usePdvCart()

    const result = cart.addProduct(
      buildProduct({
        variants: [
          {
            id: 10,
            name: 'Preto',
            color_hex: '#111111',
            price: null,
            stock_quantity: 2,
            image: null,
            is_active: true,
            position: 0,
          },
        ],
      })
    )

    expect(result).toEqual({ ok: false, reason: 'variant_required' })
    expect(cart.lines.value).toHaveLength(0)
  })

  it('adds a selected variant as its own stock-limited line', () => {
    const cart = usePdvCart()
    const product = buildProduct({
      stock_quantity: 5,
      image_url: 'https://cdn.bipflow.app/produtos/camiseta.jpg',
      variants: [
        {
          id: 10,
          name: 'Preto',
          color_hex: '#111111',
          price: null,
          stock_quantity: 2,
          image: 'https://cdn.bipflow.app/produtos/camiseta-preta.jpg',
          is_active: true,
          position: 0,
        },
        {
          id: 11,
          name: 'Azul',
          color_hex: '#3366FF',
          price: null,
          stock_quantity: 3,
          image: null,
          is_active: true,
          position: 1,
        },
      ],
    })

    const result = cart.addProduct(product, 1, product.variants?.[0] ?? null)

    expect(result).toEqual({ ok: true })
    expect(cart.lines.value).toHaveLength(1)
    expect(cart.lines.value[0]).toMatchObject({
      lineKey: '1:10',
      productId: 1,
      publicCode: 'ABCD2345',
      variantId: 10,
      variantName: 'Preto',
      variantColorHex: '#111111',
      availableStock: 2,
      imageUrl: 'https://cdn.bipflow.app/produtos/camiseta-preta.jpg',
    })
  })

  it('keeps different variants of the same product as separate PDV cart lines', () => {
    const cart = usePdvCart()
    const product = buildProduct({
      stock_quantity: 5,
      variants: [
        {
          id: 10,
          name: 'Preto',
          color_hex: '#111111',
          price: null,
          stock_quantity: 2,
          image: null,
          is_active: true,
          position: 0,
        },
        {
          id: 11,
          name: 'Azul',
          color_hex: '#3366FF',
          price: null,
          stock_quantity: 3,
          image: null,
          is_active: true,
          position: 1,
        },
      ],
    })

    cart.addProduct(product, 1, product.variants?.[0] ?? null)
    cart.addProduct(product, 2, product.variants?.[1] ?? null)

    expect(cart.lines.value).toHaveLength(2)
    expect(cart.lines.value.map((line) => line.lineKey)).toEqual(['1:10', '1:11'])
    expect(cart.toSaleItems()).toEqual([
      { public_code: 'ABCD2345', variant_id: 10, quantity: 1 },
      { public_code: 'ABCD2345', variant_id: 11, quantity: 2 },
    ])
  })

  it('rejects a scan that would exceed the known available stock', () => {
    const cart = usePdvCart()

    const result = cart.addProduct(buildProduct({ stock_quantity: 3 }), 5)

    expect(result).toEqual({ ok: false, reason: 'exceeds_stock', availableStock: 3 })
    expect(cart.lines.value).toHaveLength(0)
  })

  it('rejects a second scan that would push the aggregated quantity past available stock', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct({ stock_quantity: 3 }), 2)

    const result = cart.addProduct(buildProduct({ stock_quantity: 3 }), 2)

    expect(result).toEqual({ ok: false, reason: 'exceeds_stock', availableStock: 3 })
    // The first, valid scan must not be rolled back by the second's rejection.
    expect(cart.lines.value[0]?.quantity).toBe(2)
  })

  it('computes subtotal and item count across multiple lines', () => {
    const cart = usePdvCart()

    cart.addProduct(buildProduct({ id: 1, price: 10 }), 2)
    cart.addProduct(buildProduct({ id: 2, price: 5, public_code: 'ZZZZ9999' }), 3)

    expect(cart.subtotal.value).toBe(35)
    expect(cart.itemCount.value).toBe(5)
  })

  it('updates a line quantity directly', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct())

    const result = cart.updateQuantity(cart.lines.value[0]!.lineKey, 4)

    expect(result).toEqual({ ok: true })
    expect(cart.lines.value[0]?.quantity).toBe(4)
  })

  it('caps a manual quantity edit at the available stock and reports it', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct({ stock_quantity: 3 }))

    const result = cart.updateQuantity(cart.lines.value[0]!.lineKey, 10)

    expect(result).toEqual({ ok: false, reason: 'exceeds_stock', availableStock: 3 })
    expect(cart.lines.value[0]?.quantity).toBe(3)
  })

  it('removes the line when the quantity is set to zero or less', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct())

    cart.updateQuantity(cart.lines.value[0]!.lineKey, 0)

    expect(cart.lines.value).toHaveLength(0)
  })

  it('removes a line explicitly', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct())

    cart.removeLine(cart.lines.value[0]!.lineKey)

    expect(cart.isEmpty.value).toBe(true)
  })

  it('clears the whole cart', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct({ id: 1 }))
    cart.addProduct(buildProduct({ id: 2, public_code: 'ZZZZ9999' }))

    cart.clear()

    expect(cart.lines.value).toHaveLength(0)
  })

  it('builds the sale payload items matching the backend contract', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct({ id: 1, public_code: 'ABCD2345' }), 2)
    cart.addProduct(buildProduct({ id: 2, public_code: 'ZZZZ9999' }), 1)

    expect(cart.toSaleItems()).toEqual([
      { public_code: 'ABCD2345', quantity: 2 },
      { public_code: 'ZZZZ9999', quantity: 1 },
    ])
  })
})
