import { computed, ref, watch } from 'vue'
import type { CartCustomer, CartItem, Product } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

const CART_ITEMS_STORAGE_KEY = 'bipflow_public_cart_items'
const CART_CUSTOMER_STORAGE_KEY = 'bipflow_public_cart_customer'

const defaultCustomer: CartCustomer = {
  fullName: '',
  phone: '',
  email: '',
  deliveryMethod: 'delivery',
  paymentMethod: 'pix',
  address: '',
  neighborhood: '',
  city: '',
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

function loadPersistedState(): void {
  if (!canUseBrowserStorage() || hasHydrated.value) {
    return
  }

  try {
    const storedItems = window.localStorage.getItem(CART_ITEMS_STORAGE_KEY)
    const storedCustomer = window.localStorage.getItem(CART_CUSTOMER_STORAGE_KEY)

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

    window.localStorage.setItem(CART_ITEMS_STORAGE_KEY, JSON.stringify(nextItems))
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
      CART_CUSTOMER_STORAGE_KEY,
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
    customer.value.deliveryMethod === 'delivery' && items.value.length > 0 ? 12 : 0
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

  const buildOrderSummary = (): string => {
    const lines = [
      'Pedido BipFlow',
      '',
      ...items.value.map((item, index) => {
        const lineTotal = parsePrice(item.product.price) * item.quantity
        return `${index + 1}. ${item.product.name} x${item.quantity} - ${formatBRL(lineTotal)}`
      }),
      '',
      `Subtotal: ${formatBRL(subtotal.value)}`,
      `Entrega: ${formatBRL(deliveryFee.value)}`,
      `Total: ${formatBRL(total.value)}`,
      '',
      `Cliente: ${customer.value.fullName || 'Nao informado'}`,
      `Telefone: ${customer.value.phone || 'Nao informado'}`,
      `Email: ${customer.value.email || 'Nao informado'}`,
      `Entrega: ${customer.value.deliveryMethod === 'delivery' ? 'Delivery' : 'Retirada'}`,
      `Pagamento: ${customer.value.paymentMethod.toUpperCase()}`,
    ]

    if (customer.value.deliveryMethod === 'delivery') {
      lines.push(
        `Endereco: ${customer.value.address || 'Nao informado'}`,
        `Bairro: ${customer.value.neighborhood || 'Nao informado'}`,
        `Cidade: ${customer.value.city || 'Nao informado'}`
      )
    }

    if (customer.value.notes.trim()) {
      lines.push(`Observacoes: ${customer.value.notes.trim()}`)
    }

    return lines.join('\n')
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
    buildOrderSummary,
  }
}
