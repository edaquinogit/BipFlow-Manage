import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchAndFilterBar from '../SearchAndFilterBar.vue'
import { createDefaultFilterState } from '@/types/filters'

vi.mock('@/composables/useCategories', () => ({
  useCategories: () => ({
    addCategory: vi.fn(),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/services/logger', () => ({
  Logger: {
    error: vi.fn(),
  },
}))

describe('SearchAndFilterBar', () => {
  it('preserves a trailing space in the search input while typing', async () => {
    const wrapper = mount(SearchAndFilterBar, {
      props: {
        filters: createDefaultFilterState(),
        categories: [],
      },
    })

    await wrapper.find('[data-cy="search-input"]').setValue('camisa ')

    expect((wrapper.find('[data-cy="search-input"]').element as HTMLInputElement).value).toBe('camisa ')
    expect(wrapper.emitted('updateFilters')?.at(-1)).toEqual([
      {
        search: 'camisa ',
        page: 1,
      },
    ])
  })
})
