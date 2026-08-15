import { describe, expect, it } from 'vitest'
import {
  buildCardInstallmentOptions,
  getEffectiveMaxInstallments,
} from '../paymentInstallments'

describe('paymentInstallments', () => {
  const gateway = {
    card_max_installments: 4,
    card_monthly_interest_rate: '2.00',
    card_min_installment_amount: '10.00',
  }

  it('caps installments by configured max and minimum installment amount', () => {
    expect(getEffectiveMaxInstallments(120, gateway)).toBe(4)
    expect(getEffectiveMaxInstallments(20, { ...gateway, card_max_installments: 6 })).toBe(2)
  })

  it('builds installment options with compound monthly interest', () => {
    const options = buildCardInstallmentOptions(120, gateway)

    expect(options).toHaveLength(4)
    expect(options[2]).toMatchObject({
      installments: 3,
      installmentAmount: 41.62,
      total: 124.85,
      monthlyInterestRate: 2,
    })
  })
})
