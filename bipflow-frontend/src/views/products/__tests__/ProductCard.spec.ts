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
    expect(wrapper.text()).toContain('2')
  })

  it('emits openDetails when the detail trigger is clicked', async () => {
    const detailButton = wrapper.findAll('button').find((button) => button.text().includes('Detalhe'))

    expect(detailButton).toBeDefined()

    await detailButton!.trigger('click')

    expect(wrapper.emitted('openDetails')).toHaveLength(1)
    expect(wrapper.emitted('openDetails')?.[0]).toEqual([mockProduct])
  })

  it('increments and decrements the selected quantity', async () => {
    const buttons = wrapper.findAll('button')
    const decreaseButton = buttons.find((button) => button.attributes('aria-label') === 'Diminuir quantidade')
    const increaseButton = buttons.find((button) => button.attributes('aria-label') === 'Aumentar quantidade')

    expect(decreaseButton).toBeDefined()
    expect(increaseButton).toBeDefined()
    expect(wrapper.text()).toContain('1')

    await increaseButton!.trigger('click')
    expect(wrapper.text()).toContain('2')

    await decreaseButton!.trigger('click')
    expect(wrapper.text()).toContain('1')
  })

  it('emits addToCart with the selected quantity', async () => {
    const buttons = wrapper.findAll('button')
    const increaseButton = buttons.find((button) => button.attributes('aria-label') === 'Aumentar quantidade')
    const addButton = buttons.find((button) => button.text().includes('Adicionar'))

    expect(increaseButton).toBeDefined()
    expect(addButton).toBeDefined()

    await increaseButton!.trigger('click')
    await addButton!.trigger('click')

    expect(wrapper.emitted('addToCart')).toHaveLength(1)
    expect(wrapper.emitted('addToCart')?.[0]).toEqual([mockProduct, 2])
  })

  it('adds the first color variant with available stock from the catalog card', async () => {
    const productWithVariants = {
      ...mockProduct,
      variants: [
        {
          id: 10,
          name: 'Preto',
          color_hex: '#000000',
          stock_quantity: 0,
          image: 'https://example.com/preto.jpg',
          is_active: true,
          position: 0,
        },
        {
          id: 11,
          name: 'Azul',
          color_hex: '#3366FF',
          stock_quantity: 2,
          image: 'https://example.com/azul.jpg',
          is_active: true,
          position: 1,
        },
      ],
    }

    await wrapper.setProps({ product: productWithVariants })

    const addButton = wrapper.find('[data-cy="add-to-cart-button"]')
    await addButton.trigger('click')

    expect(wrapper.text()).toContain('2 nesta cor')
    expect(wrapper.emitted('addToCart')?.at(-1)).toEqual([
      productWithVariants,
      1,
      expect.objectContaining({ id: 11, name: 'Azul' }),
    ])
  })

  it('disables add to cart when product is unavailable', async () => {
    await wrapper.setProps({
      product: { ...mockProduct, is_available: false }
    })

    const disabledButtons = wrapper.findAll('button').filter((button) =>
      button.attributes('disabled') !== undefined
    )
    expect(disabledButtons.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('Fora de estoque')
    expect(wrapper.text()).toContain('Indisponivel')
  })

  it('keeps lazy loading enabled for product images', () => {
    const img = wrapper.find('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt')).toBe('Imagem do produto Test Product')
  })

  it('shows "Disponivel" when stock is comfortably above the default threshold', () => {
    expect(wrapper.text()).toContain('Disponivel')
  })

  it('shows the remaining count when stock is at or below the default threshold (5)', async () => {
    await wrapper.setProps({ product: { ...mockProduct, stock_quantity: 5 } })

    expect(wrapper.text()).toContain('5 restantes')
  })

  it('uses the product\'s own low_stock_threshold instead of the default', async () => {
    await wrapper.setProps({ product: { ...mockProduct, stock_quantity: 15, low_stock_threshold: 20 } })

    expect(wrapper.text()).toContain('15 restantes')
  })
})
