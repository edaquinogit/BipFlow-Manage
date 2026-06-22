import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PeriodSwitcher from '../PeriodSwitcher.vue'

describe('PeriodSwitcher', () => {
  const options = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
  ]

  it('renders every option', () => {
    const wrapper = mount(PeriodSwitcher, { props: { modelValue: '30d', options } })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons.map((button) => button.text())).toEqual(['7D', '30D', '90D'])
  })

  it('marks only the active option as pressed', () => {
    const wrapper = mount(PeriodSwitcher, { props: { modelValue: '30d', options } })

    const buttons = wrapper.findAll('button')
    expect(buttons[1]!.attributes('aria-pressed')).toBe('true')
    expect(buttons[0]!.attributes('aria-pressed')).toBe('false')
    expect(buttons[2]!.attributes('aria-pressed')).toBe('false')
  })

  it('emits update:modelValue with the clicked option value', async () => {
    const wrapper = mount(PeriodSwitcher, { props: { modelValue: '30d', options } })

    await wrapper.findAll('button')[2]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['90d'])
  })
})
