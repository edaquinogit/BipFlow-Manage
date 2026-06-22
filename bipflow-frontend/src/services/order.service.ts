import api from './api'
import { getStoredBotSessionId } from './bot.service'
import type {
  CartCustomer,
  CartItem,
  CheckoutPayload,
  CheckoutResponse,
} from '@/types/product'
import { formatBRL } from '@/utils/formatters'

function buildCheckoutPayload(items: CartItem[], customer: CartCustomer): CheckoutPayload {
  const payload: CheckoutPayload = {
    items: items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
    })),
    customer: {
      full_name: customer.fullName.trim(),
      phone: customer.phone.trim(),
      email: customer.email.trim(),
      delivery_method: customer.deliveryMethod,
      payment_method: customer.paymentMethod,
      delivery_region_id: customer.deliveryRegionId,
      address: customer.address.trim(),
      neighborhood: customer.neighborhood.trim(),
      city: customer.city.trim(),
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
