import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RevenueTrendCard from '../RevenueTrendCard.vue'
import type { SaleOrderTimeseriesPoint } from '@/types/sales'

const mountCard = (props: {
  points: SaleOrderTimeseriesPoint[]
  ordersCount: number
  averageTicket: string
  isLoading: boolean
}) =>
  mount(RevenueTrendCard, {
    props,
    global: { stubs: { apexchart: true } },
  })

describe('RevenueTrendCard', () => {
  it('shows a loading state', () => {
    const wrapper = mountCard({ points: [], ordersCount: 0, averageTicket: '0.00', isLoading: true })

    expect(wrapper.text()).toContain('Carregando grafico de receita')
  })

  it('shows an empty state when there are no points in the period', () => {
    const wrapper = mountCard({ points: [], ordersCount: 0, averageTicket: '0.00', isLoading: false })

    expect(wrapper.text()).toContain('Nenhuma venda registrada neste periodo')
  })

  it('renders the orders count and the formatted average ticket', () => {
    const wrapper = mountCard({
      points: [{ date: '2026-06-01', revenue: '50.00', orders_count: 1 }],
      ordersCount: 12,
      averageTicket: '45.50',
      isLoading: false,
    })

    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('R$')
    expect(wrapper.text()).toContain('45,50')
  })

  it('renders the trend chart when there are points', () => {
    const wrapper = mountCard({
      points: [{ date: '2026-06-01', revenue: '50.00', orders_count: 1 }],
      ordersCount: 1,
      averageTicket: '50.00',
      isLoading: false,
    })

    expect(wrapper.find('[role="img"]').exists()).toBe(true)
  })
})
