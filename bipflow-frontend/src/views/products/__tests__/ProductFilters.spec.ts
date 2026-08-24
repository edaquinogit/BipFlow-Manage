import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFilters from '../ProductFilters.vue'
import type { ProductFilters as ProductFiltersState } from '@/types/product'

describe('ProductFilters', () => {
  it('emits the search text with its trailing space while typing', async () => {
    const filters: ProductFiltersState = {
      search: '',
      categoryId: undefined,
      priceMin: undefined,
      priceMax: undefined,
      inStockOnly: false,
    }

    const wrapper = mount(ProductFilters, {
      props: {
        filters,
        categories: [],
      },
    })

    await wrapper.find('input[aria-label="Buscar produtos por nome"]').setValue('camisa ')

    expect(wrapper.emitted('updateFilters')?.at(-1)).toEqual([
      {
        search: 'camisa ',
      },
    ])
  })
})
