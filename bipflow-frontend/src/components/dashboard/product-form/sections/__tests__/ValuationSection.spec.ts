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

  it('keeps the stock input editable for a new product', () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 0,
        stock: 0,
        size: '',
        errors: {},
        isExistingProduct: false,
      },
    })

    expect(
      (wrapper.find('[data-cy="input-product-stock"]').element as HTMLInputElement).disabled
    ).toBe(false)
  })

  it('locks the stock input and shows a hint when editing an existing product', () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 12.5,
        stock: 4,
        size: '',
        errors: {},
        isExistingProduct: true,
      },
    })

    expect(
      (wrapper.find('[data-cy="input-product-stock"]').element as HTMLInputElement).disabled
    ).toBe(true)
    expect(wrapper.text()).toContain('Movimentar estoque')
  })

  it('emits null (not 0) when the low-stock threshold input is cleared', async () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 12.5,
        stock: 4,
        lowStockThreshold: 8,
        size: '',
        errors: {},
      },
    })

    await wrapper.find('[data-cy="input-product-low-stock-threshold"]').setValue('')

    expect(wrapper.emitted('update:lowStockThreshold')?.at(-1)).toEqual([null])
  })

  it('emits an explicit 0 when the low-stock threshold is set to zero', async () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 12.5,
        stock: 4,
        lowStockThreshold: null,
        size: '',
        errors: {},
      },
    })

    await wrapper.find('[data-cy="input-product-low-stock-threshold"]').setValue('0')

    expect(wrapper.emitted('update:lowStockThreshold')?.at(-1)).toEqual([0])
  })

  it('keeps the low-stock threshold input always editable, even for an existing product', () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 12.5,
        stock: 4,
        lowStockThreshold: 8,
        size: '',
        errors: {},
        isExistingProduct: true,
      },
    })

    expect(
      (wrapper.find('[data-cy="input-product-low-stock-threshold"]').element as HTMLInputElement).disabled
    ).toBe(false)
  })

  it('shows the default-threshold hint in the placeholder', () => {
    const wrapper = mount(ValuationSection, {
      props: {
        price: 0,
        stock: 0,
        lowStockThreshold: null,
        size: '',
        errors: {},
      },
    })

    expect(
      wrapper.find('[data-cy="input-product-low-stock-threshold"]').attributes('placeholder')
    ).toContain('5')
  })
})
