import { describe, it, expect } from 'vitest'
import {
  getDeliveryMethodLabel,
  getPaymentLabel,
  getSaleStatusLabel,
  SALE_STATUS_OPTIONS,
  SALE_TIMELINE_STEPS,
} from '../saleOrder'

describe('getSaleStatusLabel', () => {
  it('has a label for every status referenced by SALE_STATUS_OPTIONS', () => {
    for (const option of SALE_STATUS_OPTIONS) {
      expect(getSaleStatusLabel(option.value)).toBe(option.label)
    }
  })
})

describe('getPaymentLabel', () => {
  it('maps every payment method to a Portuguese label', () => {
    expect(getPaymentLabel('pix')).toBe('Pix')
    expect(getPaymentLabel('card')).toBe('Cartao')
    expect(getPaymentLabel('cash')).toBe('Dinheiro')
  })
})

describe('getDeliveryMethodLabel', () => {
  it('maps delivery to Delivery and pickup to Retirada', () => {
    expect(getDeliveryMethodLabel('delivery')).toBe('Delivery')
    expect(getDeliveryMethodLabel('pickup')).toBe('Retirada')
  })
})

describe('SALE_TIMELINE_STEPS', () => {
  it('only lists the non-cancelled statuses, in order', () => {
    expect(SALE_TIMELINE_STEPS.map((step) => step.value)).toEqual(['prepared', 'sent'])
  })
})
