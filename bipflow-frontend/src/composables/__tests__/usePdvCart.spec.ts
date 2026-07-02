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
      productId: 1,
      publicCode: 'ABCD2345',
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

    cart.updateQuantity(1, 4)

    expect(cart.lines.value[0]?.quantity).toBe(4)
  })

  it('removes the line when the quantity is set to zero or less', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct())

    cart.updateQuantity(1, 0)

    expect(cart.lines.value).toHaveLength(0)
  })

  it('removes a line explicitly', () => {
    const cart = usePdvCart()
    cart.addProduct(buildProduct())

    cart.removeLine(1)

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
