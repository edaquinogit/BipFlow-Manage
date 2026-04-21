import api from './api'
import type {
  CartCustomer,
  CartItem,
  CheckoutPayload,
  CheckoutResponse,
} from '@/types/product'

function buildCheckoutPayload(items: CartItem[], customer: CartCustomer): CheckoutPayload {
  return {
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
      address: customer.address.trim(),
      neighborhood: customer.neighborhood.trim(),
      city: customer.city.trim(),
      notes: customer.notes.trim(),
    },
  }
}

export const orderService = {
  async checkoutViaWhatsApp(items: CartItem[], customer: CartCustomer): Promise<CheckoutResponse> {
    const payload = buildCheckoutPayload(items, customer)
    const response = await api.post<CheckoutResponse>('v1/checkout/whatsapp/', payload)
    return response.data
  },
}
