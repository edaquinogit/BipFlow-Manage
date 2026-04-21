import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../ProductCard.vue'

describe('ProductCard', () => {
  const mockProduct = {
    id: 1,
    name: 'Test Product',
    slug: 'test-product',
    price: '99.90',
    category: { id: 1, name: 'Test Category', slug: 'test-category' },
    image: 'https://example.com/image.jpg',
    stock_quantity: 10,
    is_available: true,
    created_at: '2024-01-01T00:00:00Z'
  }

  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    wrapper = mount(ProductCard, {
      props: {
        product: mockProduct,
        cartQuantity: 2,
      }
    })
  })

  it('renders core product data', () => {
    expect(wrapper.text()).toContain('Test Product')
    expect(wrapper.text()).toContain('Test Category')
    expect(wrapper.text()).toContain('R$')
    expect(wrapper.text()).toContain('99,90')
  })

  it('shows cart badge when product is already in cart', () => {
    expect(wrapper.text()).toContain('2 no carrinho')
  })

  it('increments and decrements the selected quantity', async () => {
    const buttons = wrapper.findAll('button')
    const decreaseButton = buttons[0]
    const increaseButton = buttons[1]

    expect(wrapper.text()).toContain('1')

    await increaseButton.trigger('click')
    expect(wrapper.text()).toContain('2')

    await decreaseButton.trigger('click')
    expect(wrapper.text()).toContain('1')
  })

  it('emits addToCart with the selected quantity', async () => {
    const buttons = wrapper.findAll('button')
    const increaseButton = buttons[1]
    const addButton = buttons[2]

    await increaseButton.trigger('click')
    await addButton.trigger('click')

    expect(wrapper.emitted('addToCart')).toHaveLength(1)
    expect(wrapper.emitted('addToCart')?.[0]).toEqual([mockProduct, 2])
  })

  it('disables add to cart when product is unavailable', async () => {
    await wrapper.setProps({
      product: { ...mockProduct, is_available: false }
    })

    const addButton = wrapper.findAll('button')[2]
    expect(addButton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Fora de estoque')
  })

  it('keeps lazy loading enabled for product images', () => {
    const img = wrapper.find('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt')).toBe('Imagem do produto Test Product')
  })
})
