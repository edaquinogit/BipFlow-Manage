import { computed, ref, watch } from 'vue'
import type { CartCustomer, CartItem, Product } from '@/types/product'
import { getSelectedStoreSlug } from '@/services/store-scope'

// Etapa 3 of the multi-tenant evolution: the cart key is scoped per store so
// a delivery region or item picked while browsing one storefront never
// bleeds into another's. Pre-Etapa-3 carts lived under these flat keys;
// migrateLegacyCart() moves that data into the first resolved per-store key
// on read, once, so existing shoppers do not lose an in-progress cart.
const LEGACY_ITEMS_STORAGE_KEY = 'bipflow_public_cart_items'
const LEGACY_CUSTOMER_STORAGE_KEY = 'bipflow_public_cart_customer'

function storeScopedStorageKey(suffix: 'items' | 'customer'): string {
  const slug = getSelectedStoreSlug() || 'default'
  return `bipflow_cart_${slug}_${suffix}`
}

const defaultCustomer: CartCustomer = {
  deliveryMethod: 'delivery',
  paymentMethod: 'pix',
  deliveryRegionId: null,
  deliveryRegionName: '',
  deliveryRegionFee: 0,
  notes: '',
}

const items = ref<CartItem[]>([])
const customer = ref<CartCustomer>({ ...defaultCustomer })
const hasHydrated = ref(false)

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function clampQuantity(product: Product, quantity: number): number {
  const maxQuantity = Math.max(product.stock_quantity, 1)
  return Math.min(Math.max(Math.trunc(quantity), 1), maxQuantity)
}

function parsePrice(price: string | number): number {
  const numericPrice = typeof price === 'string' ? Number.parseFloat(price) : price
  return Number.isFinite(numericPrice) ? numericPrice : 0
}

function migrateLegacyCartOnce(itemsKey: string, customerKey: string): void {
  const hasLegacyItems = window.localStorage.getItem(LEGACY_ITEMS_STORAGE_KEY) !== null
  const hasLegacyCustomer = window.localStorage.getItem(LEGACY_CUSTOMER_STORAGE_KEY) !== null

  if (!hasLegacyItems && !hasLegacyCustomer) {
    return
  }

  if (hasLegacyItems && window.localStorage.getItem(itemsKey) === null) {
    window.localStorage.setItem(itemsKey, window.localStorage.getItem(LEGACY_ITEMS_STORAGE_KEY)!)
  }

  if (hasLegacyCustomer && window.localStorage.getItem(customerKey) === null) {
    window.localStorage.setItem(
      customerKey,
      window.localStorage.getItem(LEGACY_CUSTOMER_STORAGE_KEY)!
    )
  }

  window.localStorage.removeItem(LEGACY_ITEMS_STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_CUSTOMER_STORAGE_KEY)
}

function loadPersistedState(): void {
  if (!canUseBrowserStorage() || hasHydrated.value) {
    return
  }

  const itemsKey = storeScopedStorageKey('items')
  const customerKey = storeScopedStorageKey('customer')

  migrateLegacyCartOnce(itemsKey, customerKey)

  try {
    const storedItems = window.localStorage.getItem(itemsKey)
    const storedCustomer = window.localStorage.getItem(customerKey)

    if (storedItems) {
      const parsedItems = JSON.parse(storedItems) as CartItem[]
      items.value = Array.isArray(parsedItems) ? parsedItems : []
    }

    if (storedCustomer) {
      const parsedCustomer = JSON.parse(storedCustomer) as Partial<CartCustomer>
      customer.value = {
        ...defaultCustomer,
        ...parsedCustomer,
      }
    }
  } catch {
    items.value = []
    customer.value = { ...defaultCustomer }
  } finally {
    hasHydrated.value = true
  }
}

watch(
  items,
  (nextItems) => {
    if (!canUseBrowserStorage() || !hasHydrated.value) {
      return
    }

    window.localStorage.setItem(storeScopedStorageKey('items'), JSON.stringify(nextItems))
  },
  { deep: true }
)

watch(
  customer,
  (nextCustomer) => {
    if (!canUseBrowserStorage() || !hasHydrated.value) {
      return
    }

    window.localStorage.setItem(
      storeScopedStorageKey('customer'),
      JSON.stringify(nextCustomer)
    )
  },
  { deep: true }
)

export function useCart() {
  loadPersistedState()

  const itemCount = computed(() =>
    items.value.reduce((total, item) => total + item.quantity, 0)
  )

  const uniqueItemCount = computed(() => items.value.length)

  const subtotal = computed(() =>
    items.value.reduce(
      (total, item) => total + parsePrice(item.product.price) * item.quantity,
      0
    )
  )

  const isEmpty = computed(() => items.value.length === 0)

  const deliveryFee = computed(() =>
    customer.value.deliveryMethod === 'delivery' && items.value.length > 0
      ? Number(customer.value.deliveryRegionFee ?? 0)
      : 0
  )

  const total = computed(() => subtotal.value + deliveryFee.value)

  const addItem = (product: Product, quantity = 1): void => {
    if (!product.is_available || product.stock_quantity <= 0) {
      return
    }

    const existingItem = items.value.find((item) => item.product.id === product.id)

    if (existingItem) {
      existingItem.quantity = clampQuantity(
        product,
        existingItem.quantity + quantity
      )
      return
    }

    items.value = [
      ...items.value,
      {
        product,
        quantity: clampQuantity(product, quantity),
      },
    ]
  }

  const removeItem = (productId: number): void => {
    items.value = items.value.filter((item) => item.product.id !== productId)
  }

  const updateQuantity = (productId: number, quantity: number): void => {
    const targetItem = items.value.find((item) => item.product.id === productId)

    if (!targetItem) {
      return
    }

    if (quantity <= 0) {
      removeItem(productId)
      return
    }

    targetItem.quantity = clampQuantity(targetItem.product, quantity)
  }

  const clearCart = (): void => {
    items.value = []
  }

  const updateCustomer = (patch: Partial<CartCustomer>): void => {
    customer.value = {
      ...customer.value,
      ...patch,
    }
  }

  const resetCustomer = (): void => {
    customer.value = { ...defaultCustomer }
  }

  const getProductQuantity = (productId: number): number => {
    return items.value.find((item) => item.product.id === productId)?.quantity ?? 0
  }

  return {
    items,
    customer,
    itemCount,
    uniqueItemCount,
    subtotal,
    deliveryFee,
    total,
    isEmpty,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    updateCustomer,
    resetCustomer,
    getProductQuantity,
  }
}
