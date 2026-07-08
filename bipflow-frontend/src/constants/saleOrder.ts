import type { SaleOrder, SaleOrderChannel, SaleOrderStatus } from '@/types/sales';

export const SALE_STATUS_OPTIONS: { value: SaleOrderStatus; label: string }[] = [
  { value: 'prepared', label: 'Novo' },
  { value: 'sent', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];

const SALE_STATUS_LABELS: Record<SaleOrderStatus, string> = {
  prepared: 'Novo',
  sent: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export function getSaleStatusLabel(status: SaleOrderStatus): string {
  return SALE_STATUS_LABELS[status];
}

// Etapa 0 of the pedidos/NF/envio evolution found this map duplicated
// (DashboardOrdersView.vue and PaymentBreakdownCard.vue each kept their own
// copy) with no single source enforcing that a new status gets added to
// every screen that shows a badge -- centralized here so that gap can't
// recur silently.
const SALE_STATUS_BADGE_CLASS: Record<SaleOrderStatus, string> = {
  prepared: 'border-amber-200 bg-amber-50 text-amber-800',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  delivered: 'border-sky-200 bg-sky-50 text-sky-800',
  cancelled: 'border-[#D81B60]/20 bg-[#FCE7F3] text-[#7A143D]',
};

export function getSaleStatusBadgeClass(status: SaleOrderStatus): string {
  return SALE_STATUS_BADGE_CLASS[status];
}

// Etapa 1 of the pedidos/NF/envio evolution: the 3rd timeline step
// (Novo -> Enviado -> Entregue).
export const SALE_TIMELINE_STEPS: { value: Exclude<SaleOrderStatus, 'cancelled'>; label: string }[] = [
  { value: 'prepared', label: 'Novo' },
  { value: 'sent', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
];

const PAYMENT_METHOD_LABELS: Record<SaleOrder['payment_method'], string> = {
  pix: 'Pix',
  card: 'Cartao',
  cash: 'Dinheiro',
};

export function getPaymentLabel(paymentMethod: SaleOrder['payment_method']): string {
  return PAYMENT_METHOD_LABELS[paymentMethod];
}

export function getDeliveryMethodLabel(deliveryMethod: SaleOrder['delivery_method']): string {
  return deliveryMethod === 'delivery' ? 'Delivery' : 'Retirada';
}

// Etapa 3/5 of the QR-code stock-exit evolution.
const CHANNEL_LABELS: Record<SaleOrderChannel, string> = {
  virtual: 'Virtual',
  loja_fisica: 'Loja fisica',
};

export function getChannelLabel(channel: SaleOrderChannel): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

// Etapa 0 of the pedidos/NF/envio evolution: the backend already supported
// ?channel= on the orders list (Etapa 5 of the QR-code stock-exit
// evolution), but no screen exposed it as a filter until now.
export const CHANNEL_FILTER_OPTIONS: { value: SaleOrderChannel; label: string }[] = [
  { value: 'virtual', label: 'Virtual' },
  { value: 'loja_fisica', label: 'Loja fisica' },
];
