import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StockAlertDrawer from '../StockAlertDrawer.vue'

const routerLinkStub = { template: '<a><slot /></a>' }

const mountDrawer = (props: Partial<InstanceType<typeof StockAlertDrawer>['$props']> = {}) =>
  mount(StockAlertDrawer, {
    props: {
      isOpen: true,
      outOfStockProducts: [],
      lowStockProducts: [],
      isLoading: false,
      ...props,
    },
    global: { stubs: { RouterLink: routerLinkStub } },
  })

describe('StockAlertDrawer', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountDrawer({ isOpen: false })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('shows the positive empty state when there are no alerts', () => {
    const wrapper = mountDrawer()

    expect(wrapper.text()).toContain('Nenhum alerta agora')
  })

  it('shows loading skeletons while products are still loading', () => {
    const wrapper = mountDrawer({ isLoading: true })

    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nenhum alerta agora')
  })

  it('lists out-of-stock products first, then low-stock products', () => {
    const wrapper = mountDrawer({
      outOfStockProducts: [
        { id: 1, name: 'Zeroed Product', sku: 'SKU-1', stock_quantity: 0, is_available: false } as any,
      ],
      lowStockProducts: [
        { id: 2, name: 'Low Product', sku: 'SKU-2', stock_quantity: 3, is_available: true } as any,
      ],
    })

    const text = wrapper.text()
    expect(text).toContain('2 produtos em alerta')
    expect(text).toContain('Sem estoque (1)')
    expect(text).toContain('Estoque baixo (1)')
    expect(text).toContain('Zeroed Product')
    expect(text).toContain('Zerado')
    expect(text).toContain('Low Product')
    expect(text).toContain('3 un.')
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountDrawer()

    await wrapper.find('[aria-label="Fechar alertas de estoque"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close when Escape is pressed while open', async () => {
    const wrapper = mountDrawer()

    await window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
