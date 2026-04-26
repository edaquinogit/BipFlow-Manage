import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ValuationSection from '../ValuationSection.vue'

describe('ValuationSection', () => {
  it('emits numeric zero when the price input is cleared', async () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 12.5,
        stock: 4,
        size: '',
        errors: {},
      },
    })

    await wrapper.find('[data-cy="input-product-price"]').setValue('')

    expect(wrapper.emitted('update:price')?.at(-1)).toEqual([0])
  })

  it('emits an integer when stock receives a decimal value', async () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 12.5,
        stock: 4,
        size: '',
        errors: {},
      },
    })

    await wrapper.find('[data-cy="input-product-stock"]').setValue('7.9')

    expect(wrapper.emitted('update:stock')?.at(-1)).toEqual([7])
  })
})
