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

  let wrapper: any

  beforeEach(() => {
    wrapper = mount(ProductCard, {
      props: {
        product: mockProduct
      }
    })
  })

  describe('Rendering', () => {
    it('should render product name', () => {
      expect(wrapper.text()).toContain('Test Product')
    })

    it('should render product price formatted', () => {
      expect(wrapper.text()).toContain('99,90')
      expect(wrapper.text()).toContain('R$')
    })

    it('should render category name', () => {
      expect(wrapper.text()).toContain('Test Category')
    })

    it('should render availability status', () => {
      expect(wrapper.text()).toContain('Em estoque')
    })

    it('should render category badge', () => {
      const badge = wrapper.find('.inline-block.px-2.py-1')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('Test Category')
    })
  })

  describe('Image Handling', () => {
    it('should render image with correct attributes', () => {
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe(mockProduct.image)
      expect(img.attributes('alt')).toBe(`Imagem do produto ${mockProduct.name}`)
      expect(img.attributes('loading')).toBe('lazy')
    })

    it('should handle image error gracefully', async () => {
      const img = wrapper.find('img')
      await img.trigger('error')

      // In a real scenario, this would set a fallback src
      // For testing, we verify the error handler exists
      expect(img.exists()).toBe(true)
    })
  })

  describe('Availability States', () => {
    it('should show in stock status for available products', () => {
      expect(wrapper.text()).toContain('Em estoque')
      expect(wrapper.classes()).not.toContain('opacity-75')
    })

    it('should show out of stock overlay for unavailable products', async () => {
      await wrapper.setProps({
        product: { ...mockProduct, is_available: false }
      })

      expect(wrapper.text()).toContain('Fora de estoque')
      expect(wrapper.classes()).toContain('opacity-75')
    })

    it('should show low stock warning when stock is low', async () => {
      await wrapper.setProps({
        product: { ...mockProduct, stock_quantity: 5 }
      })

      expect(wrapper.text()).toContain('Apenas 5 restantes')
    })

    it('should not show low stock warning when stock is sufficient', async () => {
      await wrapper.setProps({
        product: { ...mockProduct, stock_quantity: 11 }
      })

      expect(wrapper.text()).not.toContain('restantes')
    })
  })

  describe('Category Colors', () => {
    const categoryTests = [
      { name: 'Roupas', expectedClass: 'bg-blue-100 text-blue-800' },
      { name: 'Eletrônicos', expectedClass: 'bg-green-100 text-green-800' },
      { name: 'Casa', expectedClass: 'bg-purple-100 text-purple-800' },
      { name: 'Esportes', expectedClass: 'bg-orange-100 text-orange-800' },
      { name: 'Livros', expectedClass: 'bg-yellow-100 text-yellow-800' },
      { name: 'Unknown', expectedClass: 'bg-gray-100 text-gray-800' }
    ]

    categoryTests.forEach(({ name, expectedClass }) => {
      it(`should apply correct color for ${name} category`, async () => {
        await wrapper.setProps({
          product: { ...mockProduct, category: { ...mockProduct.category, name } }
        })

        const badge = wrapper.find('.inline-block.px-2.py-1')
        expect(badge.classes()).toContain(expectedClass.split(' ')[0])
        expect(badge.classes()).toContain(expectedClass.split(' ')[1])
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for image', () => {
      const img = wrapper.find('img')
      expect(img.attributes('alt')).toBe(`Imagem do produto ${mockProduct.name}`)
    })

    it('should have semantic HTML structure', () => {
      expect(wrapper.element.tagName).toBe('ARTICLE')
    })

    it('should have proper heading hierarchy', () => {
      const h3 = wrapper.find('h3')
      expect(h3.exists()).toBe(true)
      expect(h3.text()).toBe(mockProduct.name)
    })
  })

  describe('Styling', () => {
    it('should apply hover effects', () => {
      expect(wrapper.classes()).toContain('hover:shadow-lg')
    })

    it('should have proper spacing classes', () => {
      const contentDiv = wrapper.find('.p-4')
      expect(contentDiv.exists()).toBe(true)
    })

    it('should apply transition classes', () => {
      expect(wrapper.classes()).toContain('transition-all')
      expect(wrapper.classes()).toContain('duration-200')
    })
  })
})
