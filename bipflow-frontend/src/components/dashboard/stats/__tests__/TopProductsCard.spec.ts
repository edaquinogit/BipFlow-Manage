import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TopProductsCard from '../TopProductsCard.vue'
import type { TopProductBreakdown } from '@/types/sales'

const buildProduct = (overrides: Partial<TopProductBreakdown> = {}): TopProductBreakdown => ({
  product_id: 1,
  product_name: 'Combo Executivo',
  image_url: null,
  quantity_total: 4,
  revenue_total: '100.00',
  ...overrides,
})

describe('TopProductsCard', () => {
  it('shows skeleton placeholders while loading', () => {
    const wrapper = mount(TopProductsCard, { props: { products: [], isLoading: true } })

    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.text()).toContain('Carregando top produtos')
  })

  it('shows an empty state when there are no sales in the period', () => {
    const wrapper = mount(TopProductsCard, { props: { products: [], isLoading: false } })

    expect(wrapper.text()).toContain('Nenhuma venda registrada neste periodo')
  })

  it('renders a ranked list with name, quantity and formatted revenue', () => {
    const products = [
      buildProduct({ product_id: 1, product_name: 'Combo Executivo', quantity_total: 4, revenue_total: '100.00' }),
      buildProduct({ product_id: 2, product_name: 'Suco Natural', quantity_total: 2, revenue_total: '20.00' }),
    ]
    const wrapper = mount(TopProductsCard, { props: { products, isLoading: false } })

    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Combo Executivo')
    expect(items[0]!.text()).toContain('4 unid. vendidas')
    expect(items[0]!.text()).toContain('R$')
    expect(items[0]!.text()).toContain('100,00')
  })

  it('falls back to a placeholder icon when a product has no image', () => {
    const wrapper = mount(TopProductsCard, { props: { products: [buildProduct()], isLoading: false } })

    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('lazy-loads the product thumbnail when an image is available', () => {
    const wrapper = mount(TopProductsCard, {
      props: { products: [buildProduct({ image_url: 'https://example.com/combo.jpg' })], isLoading: false },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt')).toBe('Combo Executivo')
  })
})
