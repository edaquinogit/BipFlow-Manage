import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SalesAnalyticsSection from '../SalesAnalyticsSection.vue'
import type { SaleOrderBreakdown, SaleOrderTimeseriesPoint } from '@/types/sales'

interface SalesAnalyticsSectionProps {
  period: string
  points: SaleOrderTimeseriesPoint[]
  breakdown: SaleOrderBreakdown | null
  ordersCount: number
  averageTicket: string
  isLoading: boolean
  error: string | null
  updatedAt: Date | null
}

const baseProps: SalesAnalyticsSectionProps = {
  period: '30d',
  points: [],
  breakdown: null,
  ordersCount: 0,
  averageTicket: '0.00',
  isLoading: false,
  error: null,
  updatedAt: null,
}

const mountSection = (props: Partial<SalesAnalyticsSectionProps> = {}) =>
  mount(SalesAnalyticsSection, {
    props: { ...baseProps, ...props },
    global: { stubs: { apexchart: true } },
  })

describe('SalesAnalyticsSection', () => {
  it('bubbles the period switcher change up', async () => {
    const wrapper = mountSection()

    const buttons = wrapper.findAll('button[aria-pressed]')
    await buttons[2]!.trigger('click')

    expect(wrapper.emitted('update:period')?.at(-1)).toEqual(['90d'])
  })

  it('shows an error banner when the fetch failed', () => {
    const wrapper = mountSection({ error: 'Nao foi possivel carregar a analise de vendas agora.' })

    const alert = wrapper.find('[role="alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain('Nao foi possivel carregar a analise de vendas agora.')
  })

  it('does not render an error banner when there is no error', () => {
    const wrapper = mountSection()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('emits refresh when the refresh button is clicked', async () => {
    const wrapper = mountSection()

    await wrapper.find('button[aria-label="Atualizar analise de vendas"]').trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('disables the refresh button while loading', () => {
    const wrapper = mountSection({ isLoading: true })

    expect(wrapper.find('button[aria-label="Atualizar analise de vendas"]').attributes('disabled')).toBeDefined()
  })
})
