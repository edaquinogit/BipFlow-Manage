import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WhatsAppClicksCard from '../WhatsAppClicksCard.vue'
import type { SaleOrderCustomerInsights } from '@/types/sales'

const buildInsights = (overrides: Partial<SaleOrderCustomerInsights> = {}): SaleOrderCustomerInsights => ({
  period: '30d',
  new_customers: 3,
  returning_customers: 1,
  bot_conversations_count: 5,
  bot_converted_count: 2,
  bot_conversion_rate: '40.00',
  ...overrides,
})

describe('WhatsAppClicksCard', () => {
  it('shows skeleton placeholders while loading', () => {
    const wrapper = mount(WhatsAppClicksCard, { props: { insights: null, isLoading: true } })

    expect(wrapper.text()).toContain('Carregando cliques do WhatsApp')
  })

  it('renders default metrics when insights are available', () => {
    const wrapper = mount(WhatsAppClicksCard, {
      props: { insights: buildInsights(), isLoading: false },
    })

    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('2 pedidos registrados')
    expect(wrapper.text()).toContain('40.0%')
  })

  it('prioritizes whatsapp_clicks when available', () => {
    const wrapper = mount(WhatsAppClicksCard, {
      props: {
        insights: buildInsights({ whatsapp_clicks: 10, whatsapp_conversion_rate: '20.00' }),
        isLoading: false,
      },
    })

    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('20.0%')
  })
})
