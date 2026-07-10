import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BulkActionBar from '../BulkActionBar.vue'
import type { Category } from '@/schemas/category.schema'

const categories = [{ id: 1, name: 'Categoria A' }] as Category[]

describe('BulkActionBar', () => {
  it('does not render when nothing is selected', () => {
    const wrapper = mount(BulkActionBar, {
      props: { selectedCount: 0, categories },
    })

    expect(wrapper.find('[data-cy="btn-bulk-print-labels"]').exists()).toBe(false)
  })

  it('shows the labels button once something is selected', () => {
    const wrapper = mount(BulkActionBar, {
      props: { selectedCount: 2, categories },
    })

    expect(wrapper.find('[data-cy="btn-bulk-print-labels"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('2 produtos selecionados')
  })

  it('emits print-labels when the labels button is clicked', async () => {
    const wrapper = mount(BulkActionBar, {
      props: { selectedCount: 3, categories },
    })

    await wrapper.find('[data-cy="btn-bulk-print-labels"]').trigger('click')

    expect(wrapper.emitted('print-labels')).toHaveLength(1)
  })

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mount(BulkActionBar, {
      props: { selectedCount: 1, categories: [] },
    })

    await wrapper.find('button:last-of-type').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
