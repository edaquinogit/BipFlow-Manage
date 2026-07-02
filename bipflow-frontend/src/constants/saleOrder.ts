import type { SaleOrder, SaleOrderChannel, SaleOrderStatus } from '@/types/sales';

export const SALE_STATUS_OPTIONS: { value: SaleOrderStatus; label: string }[] = [
  { value: 'prepared', label: 'Novo' },
  { value: 'sent', label: 'Enviado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const SALE_STATUS_LABELS: Record<SaleOrderStatus, string> = {
  prepared: 'Novo',
  sent: 'Enviado',
  cancelled: 'Cancelado',
};

export function getSaleStatusLabel(status: SaleOrderStatus): string {
  return SALE_STATUS_LABELS[status];
}

export const SALE_TIMELINE_STEPS: { value: Exclude<SaleOrderStatus, 'cancelled'>; label: string }[] = [
  { value: 'prepared', label: 'Novo' },
  { value: 'sent', label: 'Enviado' },
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
