import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import ProductsView from '../ProductsView.vue'
import { useProductSearch } from '@/composables/useProductSearch'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { categoryService } from '@/services/category.service'
import { useRoute, useRouter } from 'vue-router'

vi.mock('@/composables/useProductSearch', () => ({
  useProductSearch: vi.fn()
}))

vi.mock('@/composables/useCart', () => ({
  useCart: vi.fn()
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn()
}))

vi.mock('@/services/category.service', () => ({
  categoryService: {
    getAll: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}))

const ProductCardStub = defineComponent({
  name: 'ProductCard',
  props: {
    product: { type: Object, required: true },
    cartQuantity: { type: Number, default: 0 },
  },
  emits: ['add-to-cart', 'open-details'],
  template: '<div class="product-card-stub">{{ product.name }}</div>',
})

const ProductFiltersStub = defineComponent({
  name: 'ProductFilters',
  props: {
    filters: { type: Object, required: true },
    categories: { type: Array, required: true },
  },
  emits: ['update-filters', 'clear-filters'],
  template: '<div class="product-filters-stub"></div>',
})

const ProductPaginationStub = defineComponent({
  name: 'ProductPagination',
  props: {
    currentPage: { type: Number, required: true },
    totalPages: { type: Number, required: true },
    hasPreviousPage: { type: Boolean, required: true },
    hasNextPage: { type: Boolean, required: true },
    showingRange: { type: String, required: true },
  },
  emits: ['go-to-page', 'next-page', 'previous-page'],
  template: '<div class="product-pagination-stub"></div>',
})

const CartDrawerStub = defineComponent({
  name: 'CartDrawer',
  props: {
    isOpen: { type: Boolean, required: true },
    items: { type: Array, required: true },
    customer: { type: Object, required: true },
    itemCount: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  emits: ['close', 'clear-cart', 'remove-item', 'update-quantity', 'update-customer', 'copy-order'],
  template: '<div class="cart-drawer-stub"></div>',
})

describe('ProductsView', () => {
  let wrapper: ReturnType<typeof mount>
  const routerPush = vi.fn()
  const routerReplace = vi.fn(() => Promise.resolve())

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

  const searchState = {
    products: ref(mockProducts),
    isLoading: ref(false),
    isInitialLoading: ref(false),
    isLoadingMore: ref(false),
    error: ref<string | null>(null),
    page: ref(1),
    totalPages: ref(1),
    filters: ref({
      search: '',
      categoryId: undefined,
      priceMin: undefined,
      priceMax: undefined,
      inStockOnly: false
    }),
    hasNextPage: ref(false),
    hasPreviousPage: ref(false),
    showingRange: ref('Exibindo 1-1 de 1 produtos'),
    fetchProducts: vi.fn(),
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
    goToPage: vi.fn(),
    nextPage: vi.fn(),
    previousPage: vi.fn()
  }

  const cartState = {
    items: ref([]),
    customer: ref({
      fullName: '',
      phone: '',
      email: '',
      deliveryMethod: 'delivery',
      paymentMethod: 'pix',
      address: '',
      neighborhood: '',
      city: '',
      notes: '',
    }),
    itemCount: ref(0),
    uniqueItemCount: ref(0),
    subtotal: ref(0),
    deliveryFee: ref(12),
    total: ref(12),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    updateCustomer: vi.fn(),
    getProductQuantity: vi.fn(() => 0),
    buildOrderSummary: vi.fn(() => 'Pedido BipFlow'),
  }

  const toastMock = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }

  const mountView = () =>
    mount(ProductsView, {
      global: {
        stubs: {
          ProductCard: ProductCardStub,
          ProductFilters: ProductFiltersStub,
          ProductPagination: ProductPaginationStub,
          CartDrawer: CartDrawerStub,
        },
      },
    })

  beforeEach(async () => {
    vi.clearAllMocks()

    vi.mocked(useProductSearch).mockReturnValue(searchState as any)
    vi.mocked(useCart).mockReturnValue(cartState as any)
    vi.mocked(useToast).mockReturnValue(toastMock as any)
    vi.mocked(useRoute).mockReturnValue({
      query: {},
    } as any)
    vi.mocked(useRouter).mockReturnValue({
      push: routerPush,
      replace: routerReplace,
    } as any)
    vi.mocked(categoryService.getAll).mockResolvedValue([
      { id: 1, name: 'Test Category', slug: 'test-category', description: '' },
    ] as any)

    wrapper = mountView()
    await nextTick()
  })

  it('navigates to product details when a card requests it', async () => {
    const cardComponent = wrapper.findComponent(ProductCardStub)
    await cardComponent.vm.$emit('open-details', mockProducts[0])

    expect(routerPush).toHaveBeenCalledWith({
      name: 'public.product-details',
      params: { slug: 'test-product' },
    })
  })

  it('renders catalog header and products', () => {
    expect(wrapper.find('h1').text()).toContain('Produtos para escolher rapido')
    expect(wrapper.find('.product-card-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('Exibindo 1-1 de 1 produtos')
  })

  it('renders category shortcuts and cart drawer components', () => {
    expect(wrapper.text()).toContain('Todas as categorias')
    expect(wrapper.find('.cart-drawer-stub').exists()).toBe(true)
  })

  it('updates filters when quick category is clicked', async () => {
    const buttons = wrapper.findAll('button')
    const categoryButton = buttons.find((button) => button.text() === 'Test Category')

    expect(categoryButton).toBeDefined()

    await categoryButton!.trigger('click')

    expect(searchState.updateFilters).toHaveBeenCalledWith({ categoryId: 1 })
  })

  it('adds product to cart and shows toast feedback', async () => {
    const cardComponent = wrapper.findComponent(ProductCardStub)
    await cardComponent.vm.$emit('add-to-cart', mockProducts[0], 2)

    expect(cartState.addItem).toHaveBeenCalledWith(mockProducts[0], 2)
    expect(toastMock.success).toHaveBeenCalled()
  })

  it('renders empty state when no products are available', async () => {
    searchState.products.value = []
    await nextTick()

    expect(wrapper.text()).toContain('Nenhum produto encontrado')
  })
})
