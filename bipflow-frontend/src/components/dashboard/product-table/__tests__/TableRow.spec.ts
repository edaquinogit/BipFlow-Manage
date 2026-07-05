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

describe('TableRow public_code', () => {
  it('renders the auto-generated code when present', () => {
    const wrapper = mountRow(buildProduct({ public_code: 'ABCD2345' }))

    expect(wrapper.get('[data-cy="product-public-code"]').text()).toBe('#ABCD2345')
  })

  it('omits the code chip for products created before Etapa 1 (no backfill yet)', () => {
    const wrapper = mountRow(buildProduct({ public_code: '' }))

    expect(wrapper.find('[data-cy="product-public-code"]').exists()).toBe(false)
  })
})

describe('TableRow print-label action (Etapa 2 of the QR-code stock-exit evolution)', () => {
  it('does not render a dedicated stock-movement action anymore', () => {
    const wrapper = mountRow(buildProduct())

    expect(wrapper.find('[title="Movimentar estoque"]').exists()).toBe(false)
  })

  it('emits print-label with the product when the QR Code button is clicked', async () => {
    const product = buildProduct({ public_code: 'ABCD2345' })
    const wrapper = mountRow(product)

    await wrapper.find('[title="Imprimir etiqueta com QR Code"]').trigger('click')

    expect(wrapper.emitted('print-label')?.at(-1)).toEqual([product])
  })
})
