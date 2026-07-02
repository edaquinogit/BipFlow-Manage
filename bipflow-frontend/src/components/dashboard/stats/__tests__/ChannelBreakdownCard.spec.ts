import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChannelBreakdownCard from '../ChannelBreakdownCard.vue'
import type { ChannelBreakdown } from '@/types/sales'

const mountCard = (props: { byChannel: ChannelBreakdown[]; isLoading: boolean }) =>
  mount(ChannelBreakdownCard, { props })

describe('ChannelBreakdownCard (Etapa 5 of the QR-code stock-exit evolution)', () => {
  it('shows a loading state', () => {
    const wrapper = mountCard({ byChannel: [], isLoading: true })

    expect(wrapper.text()).toContain('Carregando vendas por canal')
  })

  it('shows an empty state when there is no channel data in the period', () => {
    const wrapper = mountCard({ byChannel: [], isLoading: false })

    expect(wrapper.text()).toContain('Nenhuma venda registrada neste periodo')
  })

  it('renders each channel with its translated label, revenue and order count', () => {
    const wrapper = mountCard({
      byChannel: [
        { channel: 'loja_fisica', revenue_total: '85.00', orders_count: 2 },
        { channel: 'virtual', revenue_total: '40.00', orders_count: 1 },
      ],
      isLoading: false,
    })

    expect(wrapper.text()).toContain('Loja fisica')
    expect(wrapper.text()).toContain('Virtual')
    expect(wrapper.text()).toContain('R$')
    expect(wrapper.text()).toContain('85,00')
    expect(wrapper.text()).toContain('2 pedidos')
    expect(wrapper.text()).toContain('1 pedido')
  })
})
