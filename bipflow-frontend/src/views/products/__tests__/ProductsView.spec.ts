import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsView from '../ProductsView.vue'
import ProductCard from '../ProductCard.vue'
import ProductFilters from '../ProductFilters.vue'
import ProductPagination from '../ProductPagination.vue'
import { useProductSearch } from '@/composables/useProductSearch'

// Mock the composable
vi.mock('@/composables/useProductSearch', () => ({
  useProductSearch: vi.fn()
}))

describe('ProductsView', () => {
  let wrapper: ReturnType<typeof mount>
  let mockUseProductSearch: any

  const mockProducts = [
    {
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
  ]

  const defaultMockReturn = {
    products: mockProducts,
    isLoading: false,
    error: null,
    page: 1,
    totalCount: 1,
    totalPages: 1,
    filters: {
      search: '',
      categoryId: undefined,
      priceMin: undefined,
      priceMax: undefined,
      inStockOnly: false
    },
    hasNextPage: false,
    hasPreviousPage: false,
    showingRange: 'Exibindo 1-1 de 1 produtos',
    fetchProducts: vi.fn(),
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
    goToPage: vi.fn(),
    nextPage: vi.fn(),
    previousPage: vi.fn()
  }

  const mountView = (): ReturnType<typeof mount> => {
    return mount(ProductsView, {
      global: {
        stubs: {
          ProductCard: true,
          ProductFilters: true,
          ProductPagination: true
        }
      }
    })
  }

  beforeEach(() => {
    mockUseProductSearch = vi.fn().mockReturnValue(defaultMockReturn)
    vi.mocked(useProductSearch).mockImplementation(mockUseProductSearch)
    wrapper = mountView()
  })

  describe('Initial Rendering', () => {
    it('should render the main structure', () => {
      expect(wrapper.find('header').exists()).toBe(true)
      expect(wrapper.find('main').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Produtos')
    })

    it('should render product components', () => {
      expect(wrapper.findComponent(ProductFilters).exists()).toBe(true)
      expect(wrapper.findComponent(ProductCard).exists()).toBe(true)
    })

    it('should display showing range when not loading', () => {
      expect(wrapper.text()).toContain('Exibindo 1-1 de 1 produtos')
    })
  })

  describe('Loading State', () => {
    it('should show skeleton loaders when loading and no products', async () => {
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        products: []
      })
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      const skeletons = wrapper.findAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('should not show skeletons when loading but has products', async () => {
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        products: mockProducts
      })
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent(ProductCard).exists()).toBe(true)
    })
  })

  describe('Error State', () => {
    it('should show error message when there is an error and no products', async () => {
      const errorMessage = 'Failed to load products'
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        error: errorMessage,
        products: []
      })
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Erro ao carregar produtos')
      expect(wrapper.text()).toContain(errorMessage)
      expect(wrapper.find('button').text()).toContain('Tentar novamente')
    })

    it('should call fetchProducts when retry button is clicked', async () => {
      const fetchProductsMock = vi.fn()
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        error: 'Error',
        products: [],
        fetchProducts: fetchProductsMock
      })
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      const retryButton = wrapper.find('button[aria-label="Tentar novamente"]')
      await retryButton.trigger('click')

      expect(fetchProductsMock).toHaveBeenCalled()
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no products and not loading', async () => {
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        products: [],
        isLoading: false,
        error: null
      })
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Nenhum produto encontrado')
      expect(wrapper.find('button').text()).toContain('Limpar filtros')
    })
  })

  describe('Pagination', () => {
    it('should render pagination when there are multiple pages', async () => {
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        totalPages: 3,
        hasNextPage: true
      })
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent(ProductPagination).exists()).toBe(true)
    })

    it('should not render pagination for single page', async () => {
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        totalPages: 1
      })
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent(ProductPagination).exists()).toBe(false)
    })
  })

  describe('Filter Integration', () => {
    it('should call updateFilters when filters are updated', async () => {
      mockUseProductSearch.mockReturnValue(defaultMockReturn)
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      const filtersComponent = wrapper.findComponent(ProductFilters)
      await filtersComponent.vm.$emit('update-filters', { search: 'test search' })

      expect(defaultMockReturn.updateFilters).toHaveBeenCalledWith({ search: 'test search' })
    })

    it('should call clearFilters when clear filters is triggered', async () => {
      mockUseProductSearch.mockReturnValue(defaultMockReturn)
      wrapper = mountView()

      await wrapper.vm.$nextTick()

      const filtersComponent = wrapper.findComponent(ProductFilters)
      await filtersComponent.vm.$emit('clear-filters')

      expect(defaultMockReturn.clearFilters).toHaveBeenCalled()
    })
  })

  describe('Pagination Events', () => {
    beforeEach(async () => {
      mockUseProductSearch.mockReturnValue({
        ...defaultMockReturn,
        totalPages: 3,
        hasNextPage: true
      })
      wrapper = mountView()
      await wrapper.vm.$nextTick()
    })

    it('should call goToPage when pagination emits go-to-page', async () => {
      const paginationComponent = wrapper.findComponent(ProductPagination)
      await paginationComponent.vm.$emit('go-to-page', 2)

      expect(defaultMockReturn.goToPage).toHaveBeenCalledWith(2)
    })

    it('should call nextPage when pagination emits next-page', async () => {
      const paginationComponent = wrapper.findComponent(ProductPagination)
      await paginationComponent.vm.$emit('next-page')

      expect(defaultMockReturn.nextPage).toHaveBeenCalled()
    })

    it('should call previousPage when pagination emits previous-page', async () => {
      const paginationComponent = wrapper.findComponent(ProductPagination)
      await paginationComponent.vm.$emit('previous-page')

      expect(defaultMockReturn.previousPage).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      const h1 = wrapper.find('h1')
      expect(h1.exists()).toBe(true)
      expect(h1.text()).toBe('Produtos')
    })

    it('should have proper ARIA labels', () => {
      const main = wrapper.find('main')
      expect(main.attributes('aria-label')).toBeUndefined() // Main doesn't need label

      // Check that buttons have aria-labels where needed
      const buttons = wrapper.findAll('button')
      buttons.forEach(button => {
        if (button.text().includes('Tentar novamente')) {
          expect(button.attributes('aria-label')).toBe('Tentar novamente')
        }
      })
    })
  })
})
