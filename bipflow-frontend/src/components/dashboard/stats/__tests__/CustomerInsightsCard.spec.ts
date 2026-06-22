import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerInsightsCard from '../CustomerInsightsCard.vue'
import type { SaleOrderCustomerInsights } from '@/types/sales'

const buildInsights = (overrides: Partial<SaleOrderCustomerInsights> = {}): SaleOrderCustomerInsights => ({
  period: '30d',
  new_customers: 3,
  returning_customers: 1,
  bot_conversations_count: 4,
  bot_converted_count: 2,
  bot_conversion_rate: '50.00',
  ...overrides,
})

describe('CustomerInsightsCard', () => {
  it('shows skeleton placeholders while loading', () => {
    const wrapper = mount(CustomerInsightsCard, { props: { insights: null, isLoading: true } })

    expect(wrapper.text()).toContain('Carregando conversao e clientes')
  })

  it('shows "Sem dados" when there are no bot conversations in the period', () => {
    const wrapper = mount(CustomerInsightsCard, {
      props: {
        insights: buildInsights({ bot_conversations_count: 0, bot_converted_count: 0, bot_conversion_rate: null }),
        isLoading: false,
      },
    })

    expect(wrapper.text()).toContain('Sem dados')
  })

  it('renders the conversion rate and conversation counts', () => {
    const wrapper = mount(CustomerInsightsCard, { props: { insights: buildInsights(), isLoading: false } })

    expect(wrapper.text()).toContain('50.0%')
    expect(wrapper.text()).toContain('2 de 4 conversas')
  })

  it('renders the returning-customer share and counts', () => {
    const wrapper = mount(CustomerInsightsCard, {
      props: { insights: buildInsights({ new_customers: 3, returning_customers: 1 }), isLoading: false },
    })

    expect(wrapper.text()).toContain('25%')
    expect(wrapper.text()).toContain('3 novos - 1 recorrentes')
  })

  it('falls back to a zero share when there are no customers in the period', () => {
    const wrapper = mount(CustomerInsightsCard, {
      props: { insights: buildInsights({ new_customers: 0, returning_customers: 0 }), isLoading: false },
    })

    expect(wrapper.text()).toContain('0 novos - 0 recorrentes')
  })
})
