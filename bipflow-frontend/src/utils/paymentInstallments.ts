import type { PublicPaymentGatewaySettings } from '@/types/store-settings'
import type { StorePaymentSettings } from '@/types/store'
import { formatBRL } from '@/utils/formatters'

export interface PaymentGatewayLike {
  card_max_installments: number
  card_monthly_interest_rate: string | number
  card_min_installment_amount: string | number
}

export interface InstallmentOption {
  installments: number
  installmentAmount: number
  total: number
  monthlyInterestRate: number
  label: string
}

export const DEFAULT_PUBLIC_PAYMENT_GATEWAY: PublicPaymentGatewaySettings = {
  pix_payment_link_url: '',
  card_payment_link_url: '',
  is_pix_link_configured: false,
  is_card_link_configured: false,
  card_max_installments: 1,
  card_monthly_interest_rate: '0.00',
  card_min_installment_amount: '5.00',
}

export const DEFAULT_STORE_PAYMENT_SETTINGS: StorePaymentSettings = {
  payment_pix_link_url: '',
  payment_card_link_url: '',
  card_max_installments: 1,
  card_monthly_interest_rate: '0.00',
  card_min_installment_amount: '5.00',
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function parsePositiveNumber(value: string | number, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getEffectiveMaxInstallments(total: number, gateway: PaymentGatewayLike): number {
  const maxInstallments = Math.min(Math.max(Math.trunc(gateway.card_max_installments || 1), 1), 24)
  const minInstallmentAmount = parsePositiveNumber(gateway.card_min_installment_amount, 5)
  if (total <= 0) {
    return 1
  }

  const byMinimum = Math.floor(total / minInstallmentAmount)
  return Math.max(1, Math.min(maxInstallments, byMinimum || 1))
}

export function buildCardInstallmentOptions(
  total: number,
  gateway: PaymentGatewayLike,
): InstallmentOption[] {
  const effectiveMax = getEffectiveMaxInstallments(total, gateway)
  const monthlyInterestRate = Math.max(Number(gateway.card_monthly_interest_rate || 0), 0)

  return Array.from({ length: effectiveMax }, (_, index) => {
    const installments = index + 1
    const multiplier =
      installments > 1 && monthlyInterestRate > 0
        ? Math.pow(1 + monthlyInterestRate / 100, installments - 1)
        : 1
    const installmentTotal = money(total * multiplier)
    const installmentAmount = money(installmentTotal / installments)
    const baseLabel = `${installments}x de ${formatBRL(installmentAmount)}`
    const label =
      installmentTotal !== money(total)
        ? `${baseLabel} (total ${formatBRL(installmentTotal)})`
        : baseLabel

    return {
      installments,
      installmentAmount,
      total: installmentTotal,
      monthlyInterestRate,
      label,
    }
  })
}
