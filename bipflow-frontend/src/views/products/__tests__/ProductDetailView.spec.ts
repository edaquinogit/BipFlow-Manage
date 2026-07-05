import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import ProductDetailView from '../ProductDetailView.vue'
import { useCart } from '@/composables/useCart'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useToast } from '@/composables/useToast'
import { deliveryRegionService } from '@/services/delivery-region.service'
import { Logger } from '@/services/logger'
import { orderService } from '@/services/order.service'
import productService from '@/services/product.service'
import { storeSettingsService } from '@/services/store-settings.service'
import { useRoute, useRouter } from 'vue-router'

vi.mock('@/composables/useCart', () => ({
  useCart: vi.fn(),
}))

vi.mock('@/composables/useCurrentStore', () => ({
  useCurrentStore: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(),
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

vi.mock('@/services/order.service', () => ({
  orderService: {
    checkoutViaWhatsApp: vi.fn(),
  },
}))

vi.mock('@/services/product.service', () => ({
  default: {
    getPublicBySlug: vi.fn(),
    getPublicByCode: vi.fn(),
  },
}))

vi.mock('@/services/logger', () => ({
  Logger: {
    warn: vi.fn(),
  },
}))

vi.mock('@/services/store-scope', () => ({
  setSelectedStoreSlug: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}))

const CartDrawerStub = defineComponent({
  name: 'CartDrawer',
  template: '<div class="cart-drawer-stub"></div>',
})

const FloatingCartButtonStub = defineComponent({
  name: 'FloatingCartButton',
  template: '<div class="floating-cart-button-stub"></div>',
})

describe('ProductDetailView', () => {
  let wrapper: ReturnType<typeof mount>

  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }

  const productDetail = {
    id: 7,
    name: 'Premium Burger',
    slug: 'premium-burger',
    sku: 'PB-001',
    description: 'Blend especial com queijo e molho da casa.',
    price: '42.50',
    size: 'Grande',
    category: { id: 3, name: 'Lanches', slug: 'lanches' },
    image: 'https://example.com/product.jpg',
    images: ['https://example.com/product.jpg'],
    stock_quantity: 9,
    is_available: true,
    created_at: '2024-01-01T00:00:00Z',
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

  const currentStoreState = {
    selectedStore: ref({
      id: 1,
      name: 'Loja Principal',
      slug: 'default',
      logo_url: 'https://example.com/logo.png',
      tagline: 'Catalogo online',
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

  const mountView = () => mount(ProductDetailView, {
    global: {
      stubs: {
        CartDrawer: CartDrawerStub,
        FloatingCartButton: FloatingCartButtonStub,
      },
    },
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/l/default/produtos/premium-burger')

    vi.mocked(useToast).mockReturnValue(toastMock as any)
    vi.mocked(useCart).mockReturnValue(cartState as any)
    vi.mocked(useCurrentStore).mockReturnValue(currentStoreState as any)
    vi.mocked(useRoute).mockReturnValue({
      params: {
        storeSlug: 'default',
        slug: 'premium-burger',
      },
    } as any)
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(() => Promise.resolve()),
    } as any)
    vi.mocked(productService.getPublicBySlug).mockResolvedValue(productDetail as any)
    vi.mocked(productService.getPublicByCode).mockResolvedValue(productDetail as any)
    vi.mocked(deliveryRegionService.getActive).mockResolvedValue([])
    vi.mocked(storeSettingsService.getPublic).mockResolvedValue({
      whatsapp_phone_digits: '5579999999999',
      is_whatsapp_configured: true,
    } as any)
    vi.mocked(orderService.checkoutViaWhatsApp).mockResolvedValue({} as any)

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(),
      },
      configurable: true,
    })

    wrapper = mountView()
    await flushPromises()
    await nextTick()
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  it('renders a share button inside the product detail card', () => {
    expect(wrapper.find('[aria-label="Compartilhar produto"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Premium Burger')
  })

  it('uses the native share sheet when navigator.share is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
      writable: true,
    })

    await wrapper.find('[aria-label="Compartilhar produto"]').trigger('click')

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Premium Burger',
      url: expect.stringContaining('/l/default/produtos/premium-burger'),
    }))
  })

  it('falls back to copying the public product link when native share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    await wrapper.find('[aria-label="Compartilhar produto"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/l/default/produtos/premium-burger'))
    expect(toastMock.success).toHaveBeenCalledWith('Link do produto copiado.')
    expect(wrapper.find('[aria-label="Link do produto copiado"]').exists()).toBe(true)
  })

  it('falls back to copying the public product link when native share fails', async () => {
    const share = vi.fn().mockRejectedValue(new Error('share_failed'))
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    await wrapper.find('[aria-label="Compartilhar produto"]').trigger('click')
    await flushPromises()

    expect(share).toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/l/default/produtos/premium-burger'))
    expect(Logger.warn).toHaveBeenCalled()
  })
})
