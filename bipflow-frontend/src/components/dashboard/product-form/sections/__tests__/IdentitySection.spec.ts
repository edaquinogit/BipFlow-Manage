import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import IdentitySection from '../IdentitySection.vue'

describe('IdentitySection public_code (Etapa 1 of the QR-code stock-exit evolution)', () => {
  it('hides the code field for a new product (nothing generated yet)', () => {
    const wrapper = mount(IdentitySection, {
      props: {
        name: '',
        sku: '',
        description: '',
        category: null,
        categories: [],
        errors: {},
        publicCode: null,
      },
    })

    expect(wrapper.find('[data-cy="input-product-public-code"]').exists()).toBe(false)
  })

  it('shows the generated code read-only when editing an existing product', () => {
    const wrapper = mount(IdentitySection, {
      props: {
        name: 'Produto existente',
        sku: 'SKU-1',
        description: '',
        category: null,
        categories: [],
        errors: {},
        publicCode: 'ABCD2345',
      },
    })

    const input = wrapper.find('[data-cy="input-product-public-code"]').element as HTMLInputElement
    expect(input.value).toBe('ABCD2345')
    expect(input.readOnly).toBe(true)
  })

  it('copies the code to the clipboard when the copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const wrapper = mount(IdentitySection, {
      props: {
        name: 'Produto existente',
        sku: 'SKU-1',
        description: '',
        category: null,
        categories: [],
        errors: {},
        publicCode: 'ABCD2345',
      },
    })

    await wrapper.find('[data-cy="btn-copy-public-code"]').trigger('click')

    expect(writeText).toHaveBeenCalledWith('ABCD2345')
  })
})
