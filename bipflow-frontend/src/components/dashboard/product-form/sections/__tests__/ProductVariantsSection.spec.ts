import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProductVariantsSection from '../ProductVariantsSection.vue'

const baseVariant = {
  id: 1,
  name: 'M',
  color_hex: '#111827',
  price: null as number | null,
  stock_quantity: 3,
  image: null,
  is_active: true,
  position: 0,
}

function mountSection(price: number | null = null) {
  return mount(ProductVariantsSection, {
    props: {
      variants: [{ ...baseVariant, price }],
      basePrice: 59.9,
    },
  })
}

describe('ProductVariantsSection', () => {
  it('shows the product base price as guidance', () => {
    expect(mountSection().text()).toContain('Preco base do produto')
    expect(mountSection().text()).toContain('59,90')
  })

  it('leaves the price input blank for an inheriting variant', () => {
    const input = mountSection(null).find('input[type="number"][step="0.01"]')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('pre-fills the input for a variant with its own price', () => {
    const input = mountSection(69.9).find('input[type="number"][step="0.01"]')
    expect((input.element as HTMLInputElement).value).toBe('69.9')
  })

  it('emits a numeric price when the merchant types one', async () => {
    const wrapper = mountSection(null)
    await wrapper.find('input[type="number"][step="0.01"]').setValue('64.90')

    const emitted = wrapper.emitted('update:variants')?.at(-1)?.[0] as Array<{ price: unknown }>
    expect(emitted[0]?.price).toBe(64.9)
  })

  it('emits null (inherit) when the price input is cleared', async () => {
    const wrapper = mountSection(69.9)
    await wrapper.find('input[type="number"][step="0.01"]').setValue('')

    const emitted = wrapper.emitted('update:variants')?.at(-1)?.[0] as Array<{ price: unknown }>
    expect(emitted[0]?.price).toBeNull()
  })

  it('coerces a negative price back to inherit', async () => {
    const wrapper = mountSection(null)
    await wrapper.find('input[type="number"][step="0.01"]').setValue('-5')

    const emitted = wrapper.emitted('update:variants')?.at(-1)?.[0] as Array<{ price: unknown }>
    expect(emitted[0]?.price).toBeNull()
  })
})
