import api from './api'
import { getStoredBotSessionId } from './bot.service'
import type {
  CartCustomer,
  CartItem,
  CheckoutPayload,
  CheckoutResponse,
} from '@/types/product'
import { isAxiosError } from '@/types/errors'
import { formatBRL } from '@/utils/formatters'

/**
 * CheckoutWhatsAppView returns a distinct `code` for the two gate failures
 * a customer can still hit even after useCheckoutProfileGate's own check
 * (a stale cached profile check, or a profile missing its address) --
 * surfacing them specifically beats the generic "try again" toast, since
 * both are self-service fixable by the customer.
 */
export function extractCheckoutErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { code?: string; detail?: string } | undefined

    if (data?.code === 'profile_address_incomplete') {
      return 'Complete seu endereco no perfil antes de finalizar uma entrega.'
    }

    if (data?.code === 'customer_profile_required') {
      return 'Crie seu perfil para finalizar o pedido.'
    }

    if (typeof data?.detail === 'string') {
      return data.detail
    }
  }

  return 'Nao foi possivel registrar o pedido agora. Revise os dados e tente novamente.'
}

function buildCheckoutPayload(items: CartItem[], customer: CartCustomer): CheckoutPayload {
  const payload: CheckoutPayload = {
    items: items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    })),
    customer: {
      delivery_method: customer.deliveryMethod,
      payment_method: customer.paymentMethod,
      delivery_region_id: customer.deliveryRegionId,
      notes: customer.notes.trim(),
    },
  }

  const botSessionId = getStoredBotSessionId()
  if (botSessionId) {
    payload.bot_session_id = botSessionId
  }

  return payload
}

function buildWhatsAppHandoffMessage(items: CartItem[], subtotal: number): string {
  const itemLines = items.map((item, index) => {
    const lineTotal = Number(item.product.price) * item.quantity
    const sku = item.product.sku ? ` (${item.product.sku})` : ''

    return `${index + 1}. ${item.product.name}${sku} x${item.quantity} - ${formatBRL(lineTotal)}`
  })

  return [
    'Ola! Quero finalizar este pedido:',
    '',
    ...itemLines,
    '',
    `Subtotal dos produtos: ${formatBRL(subtotal)}`,
    '',
    'Podem me orientar com entrega, pagamento e confirmacao?',
  ].join('\n')
}

function buildWhatsAppHandoffUrl(phoneDigits: string, items: CartItem[], subtotal: number): string {
  const normalizedPhone = phoneDigits.replace(/\D/g, '')
  const message = buildWhatsAppHandoffMessage(items, subtotal)

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

export const orderService = {
  async checkoutViaWhatsApp(items: CartItem[], customer: CartCustomer): Promise<CheckoutResponse> {
    const payload = buildCheckoutPayload(items, customer)
    const response = await api.post<CheckoutResponse>('v1/checkout/whatsapp/', payload)
    return response.data
  },

  buildWhatsAppHandoffMessage,
  buildWhatsAppHandoffUrl,
}
