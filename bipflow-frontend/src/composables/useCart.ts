import { computed, ref, watch } from 'vue'
import type { CartCustomer, CartItem, Product, ProductVariant } from '@/types/product'
import { getSelectedStoreSlug, subscribeStoreScopeChange } from '@/services/store-scope'

// Etapa 3 of the multi-tenant evolution: the cart key is scoped per store so
// a delivery region or item picked while browsing one storefront never
// bleeds into another's. Pre-Etapa-3 carts lived under these flat keys;
// migrateLegacyCart() moves that data into the first resolved per-store key
// on read, once, so existing shoppers do not lose an in-progress cart.
const LEGACY_ITEMS_STORAGE_KEY = 'bipflow_public_cart_items'
const LEGACY_CUSTOMER_STORAGE_KEY = 'bipflow_public_cart_customer'

// The customer key carries PII (name/phone/email/address) typed in during
// checkout. It has no server-side expiry of its own, so this caps how long
// it sits in localStorage on a shared/borrowed device -- a stale entry past
// the TTL is treated the same as if it were never there (defaultCustomer).
const CART_CUSTOMER_STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const CART_CUSTOMER_KEY_PATTERN = /^bipflow_cart_.*_customer(_savedAt)?$/

function normalizedStorageSlug(slug: string | null = getSelectedStoreSlug()): string {
  return slug || 'default'
}

function storeScopedStorageKey(
  suffix: 'items' | 'customer',
  slug = normalizedStorageSlug()
): string {
  return `bipflow_cart_${slug}_${suffix}`
}

function customerSavedAtKey(customerKey: string): string {
  return `${customerKey}_savedAt`
}

/**
 * Removes every store's persisted cart customer PII (and its TTL stamp)
 * from localStorage -- called on logout so a shared/borrowed device doesn't
 * keep a former session's name/phone/address around indefinitely. Cart
 * *items* are deliberately left alone: they're not PII and clearing them
 * on logout would just be a worse guest-checkout UX for no security benefit.
 */
export function clearAllPersistedCartCustomerData(): void {
  if (!canUseBrowserStorage()) {
    return
  }

  const keysToRemove: string[] = []
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (key && CART_CUSTOMER_KEY_PATTERN.test(key)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
  window.localStorage.removeItem(LEGACY_CUSTOMER_STORAGE_KEY)
}

const defaultCustomer: CartCustomer = {
  deliveryMethod: 'delivery',
  paymentMethod: 'pix',
  deliveryRegionId: null,
  deliveryRegionName: '',
  deliveryRegionFee: 0,
  notes: '',
  fullName: '',
  phone: '',
  email: '',
  address: '',
  neighborhood: '',
  city: '',
}

const items = ref<CartItem[]>([])
const customer = ref<CartCustomer>({ ...defaultCustomer })
const hasHydrated = ref(false)
let hydratedStorageSlug: string | null = null
let isHydratingPersistedState = false
let skipNextItemsPersistence = false
let skipNextCustomerPersistence = false

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function availableStockForLine(product: Product, variant?: ProductVariant | null): number {
  const productStock = Number(product.stock_quantity)
  const normalizedProductStock = Number.isFinite(productStock) ? Math.max(0, Math.trunc(productStock)) : 0
  const rawVariantStock = variant?.stock_quantity

  if (typeof rawVariantStock !== 'number' || !Number.isFinite(rawVariantStock)) {
    return normalizedProductStock
  }

  return Math.min(normalizedProductStock, Math.max(0, Math.trunc(rawVariantStock)))
}

function clampQuantity(product: Product, quantity: number, variant?: ProductVariant | null): number {
  const maxQuantity = Math.max(availableStockForLine(product, variant), 1)
  return Math.min(Math.max(Math.trunc(quantity), 1), maxQuantity)
}

function parsePrice(price: string | number): number {
  const numericPrice = typeof price === 'string' ? Number.parseFloat(price) : price
  return Number.isFinite(numericPrice) ? numericPrice : 0
}

function normalizeVariantId(variantId?: number | null): number | null {
  return typeof variantId === 'number' && Number.isFinite(variantId) ? variantId : null
}

function itemVariantId(item: CartItem): number | null {
  return item.variant?.id ?? null
}

export function getCartItemKey(productId: number, variantId?: number | null): string {
  return `${productId}:${normalizeVariantId(variantId) ?? 'default'}`
}

function matchesCartLine(
  item: CartItem,
  productId: number,
  variantId?: number | null,
): boolean {
  if (item.product.id !== productId) {
    return false
  }

  if (variantId === undefined) {
    return true
  }

  return itemVariantId(item) === normalizeVariantId(variantId)
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

function persistState(slug = hydratedStorageSlug ?? normalizedStorageSlug()): void {
  if (!canUseBrowserStorage()) {
    return
  }

  const customerKey = storeScopedStorageKey('customer', slug)
  const nextCustomerJson = JSON.stringify(customer.value)
  const hasCustomerChanged = window.localStorage.getItem(customerKey) !== nextCustomerJson

  window.localStorage.setItem(storeScopedStorageKey('items', slug), JSON.stringify(items.value))
  window.localStorage.setItem(customerKey, nextCustomerJson)

  // Only refresh the TTL timestamp when the customer data actually changed.
  // This is called on every store-scope switch to flush pending reactive
  // writes; bumping the timestamp unconditionally here would keep resetting
  // the TTL clock for a customer's untouched PII forever, as long as they
  // keep switching stores -- defeating CART_CUSTOMER_STORAGE_TTL_MS.
  if (hasCustomerChanged) {
    window.localStorage.setItem(customerSavedAtKey(customerKey), String(Date.now()))
  }
}

function loadPersistedState({ force = false }: { force?: boolean } = {}): void {
  const nextStorageSlug = normalizedStorageSlug()

  if (!canUseBrowserStorage()) {
    hydratedStorageSlug = nextStorageSlug
    hasHydrated.value = true
    return
  }

  if (hasHydrated.value && hydratedStorageSlug === nextStorageSlug && !force) {
    return
  }

  const itemsKey = storeScopedStorageKey('items', nextStorageSlug)
  const customerKey = storeScopedStorageKey('customer', nextStorageSlug)

  migrateLegacyCartOnce(itemsKey, customerKey)

  isHydratingPersistedState = true
  skipNextItemsPersistence = true
  skipNextCustomerPersistence = true
  try {
    const storedItems = window.localStorage.getItem(itemsKey)
    const storedCustomer = window.localStorage.getItem(customerKey)
    const savedAtKey = customerSavedAtKey(customerKey)
    const savedAt = Number(window.localStorage.getItem(savedAtKey))
    const isCustomerExpired =
      !savedAt || Number.isNaN(savedAt) || Date.now() - savedAt > CART_CUSTOMER_STORAGE_TTL_MS

    items.value = []
    customer.value = { ...defaultCustomer }

    if (storedItems) {
      const parsedItems = JSON.parse(storedItems) as CartItem[]
      items.value = Array.isArray(parsedItems) ? parsedItems : []
    }

    if (storedCustomer && !isCustomerExpired) {
      const parsedCustomer = JSON.parse(storedCustomer) as Partial<CartCustomer>
      customer.value = {
        ...defaultCustomer,
        ...parsedCustomer,
      }
    } else if (storedCustomer) {
      // Past its TTL (or missing a timestamp -- legacy data written before
      // this check existed): drop it rather than trust stale PII.
      window.localStorage.removeItem(customerKey)
      window.localStorage.removeItem(savedAtKey)
    }
  } catch {
    items.value = []
    customer.value = { ...defaultCustomer }
  } finally {
    hydratedStorageSlug = nextStorageSlug
    hasHydrated.value = true
    isHydratingPersistedState = false
  }
}

subscribeStoreScopeChange(() => {
  if (!hasHydrated.value) {
    return
  }

  persistState()
  loadPersistedState({ force: true })
})

watch(
  items,
  (nextItems) => {
    if (skipNextItemsPersistence) {
      skipNextItemsPersistence = false
      return
    }

    if (!canUseBrowserStorage() || !hasHydrated.value || isHydratingPersistedState) {
      return
    }

    window.localStorage.setItem(
      storeScopedStorageKey('items', hydratedStorageSlug ?? normalizedStorageSlug()),
      JSON.stringify(nextItems)
    )
  },
  { deep: true }
)

watch(
  customer,
  (nextCustomer) => {
    if (skipNextCustomerPersistence) {
      skipNextCustomerPersistence = false
      return
    }

    if (!canUseBrowserStorage() || !hasHydrated.value || isHydratingPersistedState) {
      return
    }

    const customerKey = storeScopedStorageKey(
      'customer',
      hydratedStorageSlug ?? normalizedStorageSlug()
    )
    window.localStorage.setItem(customerKey, JSON.stringify(nextCustomer))
    window.localStorage.setItem(customerSavedAtKey(customerKey), String(Date.now()))
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

  const addItem = (product: Product, quantity = 1, variant: ProductVariant | null = null): void => {
    if (!product.is_available || availableStockForLine(product, variant) <= 0) {
      return
    }

    const variantId = variant?.id ?? null
    const existingItem = items.value.find((item) =>
      matchesCartLine(item, product.id, variantId)
    )

    if (existingItem) {
      existingItem.quantity = clampQuantity(
        product,
        existingItem.quantity + quantity,
        variant,
      )
      return
    }

    items.value = [
      ...items.value,
      {
        product,
        variant,
        quantity: clampQuantity(product, quantity, variant),
      },
    ]
  }

  const removeItem = (productId: number, variantId?: number | null): void => {
    items.value = items.value.filter((item) => !matchesCartLine(item, productId, variantId))
  }

  const updateQuantity = (productId: number, quantity: number, variantId?: number | null): void => {
    const targetItem = items.value.find((item) =>
      matchesCartLine(item, productId, variantId)
    )

    if (!targetItem) {
      return
    }

    if (quantity <= 0) {
      removeItem(productId, variantId)
      return
    }

    targetItem.quantity = clampQuantity(targetItem.product, quantity, targetItem.variant)
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

  const getProductQuantity = (productId: number, variantId?: number | null): number => {
    return items.value.reduce((total, item) => {
      if (!matchesCartLine(item, productId, variantId)) {
        return total
      }

      return total + item.quantity
    }, 0)
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
