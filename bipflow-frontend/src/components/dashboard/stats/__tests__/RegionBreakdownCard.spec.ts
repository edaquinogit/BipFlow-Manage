import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionBreakdownCard from '../RegionBreakdownCard.vue'
import type { RegionBreakdown } from '@/types/sales'

const buildRegion = (overrides: Partial<RegionBreakdown> = {}): RegionBreakdown => ({
  region: 'Centro',
  revenue_total: '100.00',
  orders_count: 4,
  ...overrides,
})

describe('RegionBreakdownCard', () => {
  it('shows skeleton placeholders while loading', () => {
    const wrapper = mount(RegionBreakdownCard, { props: { regions: [], isLoading: true } })

    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.text()).toContain('Carregando vendas por regiao')
  })

  it('shows an empty state when there are no sales in the period', () => {
    const wrapper = mount(RegionBreakdownCard, { props: { regions: [], isLoading: false } })

    expect(wrapper.text()).toContain('Nenhuma venda registrada neste periodo')
  })

  it('renders one entry per region with formatted revenue and order count', () => {
    const regions = [
      buildRegion({ region: 'Retirada na loja', revenue_total: '100.00', orders_count: 4 }),
      buildRegion({ region: 'Sem regiao', revenue_total: '20.00', orders_count: 1 }),
    ]
    const wrapper = mount(RegionBreakdownCard, { props: { regions, isLoading: false } })

    const items = wrapper.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Retirada na loja')
    expect(items[0]!.text()).toContain('4 pedidos')
    expect(items[0]!.text()).toContain('R$')
    expect(items[0]!.text()).toContain('100,00')
    expect(items[1]!.text()).toContain('1 pedido')
  })
})
