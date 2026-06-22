import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SalesAnalyticsSection from '../SalesAnalyticsSection.vue'
import type {
  SaleOrderBreakdown,
  SaleOrderCustomerInsights,
  SaleOrderDateRange,
  SaleOrderTimeseriesPoint,
} from '@/types/sales'

interface SalesAnalyticsSectionProps {
  period: string
  points: SaleOrderTimeseriesPoint[]
  breakdown: SaleOrderBreakdown | null
  customerInsights: SaleOrderCustomerInsights | null
  ordersCount: number
  averageTicket: string
  comparisonSamePeriodLastYear: string | null
  customRange: SaleOrderDateRange | null
  isLoading: boolean
  error: string | null
  updatedAt: Date | null
}

const baseProps: SalesAnalyticsSectionProps = {
  period: '30d',
  points: [],
  breakdown: null,
  customerInsights: null,
  ordersCount: 0,
  averageTicket: '0.00',
  comparisonSamePeriodLastYear: null,
  customRange: null,
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

  it('emits export when the CSV button is clicked', async () => {
    const wrapper = mountSection()

    const exportButton = wrapper.findAll('button').find((button) => button.text().includes('CSV'))
    await exportButton!.trigger('click')

    expect(wrapper.emitted('export')).toHaveLength(1)
  })

  it('hides the custom range inputs unless "custom" is the active period', () => {
    const wrapper = mountSection({ period: '30d' })

    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
  })

  it('emits update:custom-range once both dates are filled in', async () => {
    const wrapper = mountSection({ period: 'custom' })

    const dateInputs = wrapper.findAll('input[type="date"]')
    expect(dateInputs).toHaveLength(2)

    await dateInputs[0]!.setValue('2026-06-01')
    await dateInputs[1]!.setValue('2026-06-10')

    expect(wrapper.emitted('update:custom-range')?.at(-1)).toEqual([
      { start: '2026-06-01', end: '2026-06-10' },
    ])
  })

  it('hints that dates are needed when "custom" is active but no range was applied yet', () => {
    const wrapper = mountSection({ period: 'custom', customRange: null })

    expect(wrapper.text()).toContain('Selecione as duas datas')
  })

  it('warns instead of emitting when the end date is before the start date', async () => {
    const wrapper = mountSection({ period: 'custom' })

    const dateInputs = wrapper.findAll('input[type="date"]')
    await dateInputs[0]!.setValue('2026-06-10')
    await dateInputs[1]!.setValue('2026-06-01')

    expect(wrapper.text()).toContain('data final deve ser igual ou posterior')
    expect(wrapper.emitted('update:custom-range')).toBeUndefined()
  })

  it('clears the date inputs when the applied custom range is reset', async () => {
    const wrapper = mountSection({ period: 'custom', customRange: { start: '2026-06-01', end: '2026-06-10' } })

    const dateInputsBefore = wrapper.findAll('input[type="date"]')
    expect((dateInputsBefore[0]!.element as HTMLInputElement).value).toBe('2026-06-01')

    await wrapper.setProps({ customRange: null })

    const dateInputsAfter = wrapper.findAll('input[type="date"]')
    expect((dateInputsAfter[0]!.element as HTMLInputElement).value).toBe('')
    expect((dateInputsAfter[1]!.element as HTMLInputElement).value).toBe('')
  })
})
