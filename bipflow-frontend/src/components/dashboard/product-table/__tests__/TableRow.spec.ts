import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TableRow from '../TableRow.vue'
import type { Product } from '@/schemas/product.schema'

const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'Produto Teste',
  sku: 'SKU-1',
  price: '10.00',
  stock_quantity: 5,
  is_available: true,
  low_stock_threshold: null,
  ...overrides,
} as Product)

const mountRow = (product: Product) => mount(TableRow, { props: { product, canManageCatalog: true } })

describe('TableRow stock badge', () => {
  it('flags stock at or below the default threshold (5) as low when no override is set', () => {
    const wrapper = mountRow(buildProduct({ stock_quantity: 5 }))

    expect(wrapper.find('.text-amber-600').exists()).toBe(true)
  })

  it('does not flag stock above the default threshold as low when no override is set', () => {
    const wrapper = mountRow(buildProduct({ stock_quantity: 6 }))

    expect(wrapper.find('.text-amber-600').exists()).toBe(false)
  })

  it('respects a custom low_stock_threshold above the default', () => {
    const belowCustomThreshold = mountRow(
      buildProduct({ stock_quantity: 15, low_stock_threshold: 20 })
    )
    const aboveCustomThreshold = mountRow(
      buildProduct({ stock_quantity: 25, low_stock_threshold: 20 })
    )

    expect(belowCustomThreshold.find('.text-amber-600').exists()).toBe(true)
    expect(aboveCustomThreshold.find('.text-amber-600').exists()).toBe(false)
  })

  it('respects an explicit threshold of 0 ("only alert when truly zeroed")', () => {
    const wrapper = mountRow(buildProduct({ stock_quantity: 1, low_stock_threshold: 0 }))

    expect(wrapper.find('.text-amber-600').exists()).toBe(false)
  })
})
