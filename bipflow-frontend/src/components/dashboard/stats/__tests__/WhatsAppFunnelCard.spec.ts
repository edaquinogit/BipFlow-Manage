import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WhatsAppFunnelCard from '../WhatsAppFunnelCard.vue'
import type { SaleOrderCustomerInsights } from '@/types/sales'

const buildInsights = (overrides: Partial<SaleOrderCustomerInsights> = {}): SaleOrderCustomerInsights => ({
  period: '30d',
  new_customers: 8,
  returning_customers: 2,
  bot_conversations_count: 10,
  bot_converted_count: 4,
  bot_conversion_rate: '40.00',
  ...overrides,
})

describe('WhatsAppFunnelCard', () => {
  it('shows skeleton placeholders while loading', () => {
    const wrapper = mount(WhatsAppFunnelCard, { props: { insights: null, isLoading: true } })

    expect(wrapper.text()).toContain('Carregando funil do WhatsApp')
  })

  it('renders the WhatsApp funnel when insights are available', () => {
    const wrapper = mount(WhatsAppFunnelCard, {
      props: { insights: buildInsights(), isLoading: false },
    })

    expect(wrapper.text()).toContain('40.0%')
    expect(wrapper.text()).toContain('4 pedidos de 10 interações')
    expect(wrapper.text()).toContain('2 recorrentes')
  })

  it('uses whatsapp click metrics when available', () => {
    const wrapper = mount(WhatsAppFunnelCard, {
      props: {
        insights: buildInsights({
          whatsapp_clicks: 12,
          whatsapp_conversion_rate: '33.33',
          average_whatsapp_response_time_seconds: 90,
        }),
        isLoading: false,
      },
    })

    expect(wrapper.text()).toContain('33.3%')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('1m 30s')
  })

  it('renders fallback values when there are no conversations', () => {
    const wrapper = mount(WhatsAppFunnelCard, {
      props: {
        insights: buildInsights({
          new_customers: 0,
          returning_customers: 0,
          bot_conversations_count: 0,
          bot_converted_count: 0,
          bot_conversion_rate: null,
        }),
        isLoading: false,
      },
    })

    expect(wrapper.text()).toContain('Sem dados')
    expect(wrapper.text()).toContain('0 pedidos de 0 interações')
    expect(wrapper.text()).toContain('0 recorrentes')
  })
})
