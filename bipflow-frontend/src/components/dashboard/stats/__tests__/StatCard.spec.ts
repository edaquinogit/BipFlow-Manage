import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
import StatCard from '../StatCard.vue'

describe('StatCard', () => {
  it('renders as a non-interactive group by default', () => {
    const wrapper = mount(StatCard, {
      props: { label: 'Itens em estoque', value: 42, icon: ShoppingBagIcon },
    })

    expect(wrapper.element.tagName).toBe('DIV')
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.attributes('aria-label')).toBe('Itens em estoque: 42')
  })

  it('renders as a button and emits click when clickable', async () => {
    const wrapper = mount(StatCard, {
      props: { label: 'Alertas criticos', value: 3, icon: ShoppingBagIcon, clickable: true },
    })

    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('role')).toBeUndefined()

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('does not emit click when not clickable', async () => {
    const wrapper = mount(StatCard, {
      props: { label: 'Itens em estoque', value: 42, icon: ShoppingBagIcon },
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
