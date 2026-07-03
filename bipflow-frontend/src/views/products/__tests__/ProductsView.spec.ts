import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import ProductsView from '../ProductsView.vue'
import { useProductSearch } from '@/composables/useProductSearch'
import { useCart } from '@/composables/useCart'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useToast } from '@/composables/useToast'
import { categoryService } from '@/services/category.service'
import { deliveryRegionService } from '@/services/delivery-region.service'
import { storeSettingsService } from '@/services/store-settings.service'
import { useRoute, useRouter } from 'vue-router'

vi.mock('@/composables/useProductSearch', () => ({
  useProductSearch: vi.fn()
}))

vi.mock('@/composables/useCart', () => ({
  useCart: vi.fn()
}))

vi.mock('@/composables/useCurrentStore', () => ({
  useCurrentStore: vi.fn()
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn()
}))

vi.mock('@/services/category.service', () => ({
  categoryService: {
    getAll: vi.fn(),
  },
}))

vi.mock('@/services/delivery-region.service', () => ({
  deliveryRegionService: {
    getActive: vi.fn(),
  },
}))

vi.mock('@/services/store-settings.service', () => ({
  storeSettingsService: {
    getPublic: vi.fn(),
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
    itemCount: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
    customer: { type: Object, required: true },
    deliveryRegions: { type: Array, required: true },
    isDeliveryRegionsLoading: { type: Boolean, default: false },
    isSubmitting: { type: Boolean, default: false },
    isWhatsAppConfigured: { type: Boolean, required: true },
  },
  emits: ['close', 'clear-cart', 'remove-item', 'update-quantity', 'update-customer', 'submit-order'],
  template: '<div class="cart-drawer-stub"></div>',
})

describe('ProductsView', () => {
  let wrapper: ReturnType<typeof mount>
  const routerPush = vi.fn()
  const routerReplace = vi.fn(() => Promise.resolve())
  const windowOpen = vi.fn()

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
      deliveryRegionId: null,
      deliveryRegionName: '',
      deliveryRegionFee: 0,
      address: '',
      neighborhood: '',
      city: '',
      notes: '',
    }),
    itemCount: ref(0),
    uniqueItemCount: ref(0),
    subtotal: ref(0),
    deliveryFee: ref(0),
    total: ref(0),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    updateCustomer: vi.fn(),
    resetCustomer: vi.fn(),
    getProductQuantity: vi.fn(() => 0),
  }

  const toastMock = {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }

  const currentStoreState = {
    selectedStore: ref({
      id: 1,
      name: 'Loja Principal',
      slug: 'default',
      logo_url: 'https://example.com/logo.png',
      tagline: 'Catalogo premium',
      whatsapp_phone: '5579999999999',
      theme: {
        primary: '#111111',
        accent: '#D81B60',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        text: '#05050A',
        muted: '#6B7280',
      },
      is_active: true,
      status: 'active',
    }),
    fetchCurrentStore: vi.fn(),
  }

  const mountView = () =>
    mount(ProductsView, {
      global: {
        stubs: {
          ProductCard: ProductCardStub,
          ProductPagination: ProductPaginationStub,
          CartDrawer: CartDrawerStub,
        },
      },
    })

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('open', windowOpen)

    searchState.products.value = mockProducts
    cartState.itemCount.value = 0

    vi.mocked(useProductSearch).mockReturnValue(searchState as any)
    vi.mocked(useCart).mockReturnValue(cartState as any)
    vi.mocked(useCurrentStore).mockReturnValue(currentStoreState as any)
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
    vi.mocked(deliveryRegionService.getActive).mockResolvedValue([
      {
        id: 1,
        name: 'Centro',
        city: 'Salvador',
        neighborhoods: '',
        delivery_fee: '12.00',
        is_active: true,
      },
    ])
    vi.mocked(storeSettingsService.getPublic).mockResolvedValue({
      whatsapp_phone_digits: '5579999999999',
      is_whatsapp_configured: true,
    })
    wrapper = mountView()
    await flushPromises()
    await nextTick()
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
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
    expect(wrapper.text()).toContain('Catalogo premium')
    expect(wrapper.text()).toContain('Loja Principal')
    expect(wrapper.find('.product-card-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('Exibindo 1-1 de 1 produtos')
  })

  it('renders category shortcuts and cart drawer components', async () => {
    await wrapper.find('[aria-label="Abrir filtros"]').trigger('click')

    expect(wrapper.text()).toContain('Todas')
    expect(wrapper.find('.cart-drawer-stub').exists()).toBe(true)
  })

  it('shows the floating cart action after an item is added', async () => {
    expect(wrapper.find('[aria-label="Abrir carrinho com 1 item"]').exists()).toBe(false)

    cartState.itemCount.value = 1
    await nextTick()

    const floatingCartButton = wrapper.find('[aria-label="Abrir carrinho com 1 item"]')
    expect(floatingCartButton.exists()).toBe(true)

    await floatingCartButton.trigger('click')

    expect(wrapper.findComponent(CartDrawerStub).props('isOpen')).toBe(true)
  })

  it('updates filters when quick category is clicked', async () => {
    await wrapper.find('[aria-label="Abrir filtros"]').trigger('click')

    const buttons = wrapper.findAll('button')
    const categoryButton = buttons.find((button) => button.text() === 'Test Category')

    expect(categoryButton).toBeDefined()

    await categoryButton!.trigger('click')

    expect(searchState.updateFilters).toHaveBeenCalledWith({ categoryId: 1 })
  })

  it('updates filters when the in-stock checkbox is toggled', async () => {
    await wrapper.find('[aria-label="Abrir filtros"]').trigger('click')

    const stockCheckbox = wrapper.find('input[type="checkbox"]')
    expect(stockCheckbox.exists()).toBe(true)

    await stockCheckbox.setValue(true)

    expect(searchState.updateFilters).toHaveBeenCalledWith({ inStockOnly: true })
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
