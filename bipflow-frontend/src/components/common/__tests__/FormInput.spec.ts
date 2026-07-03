import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormInput from '../FormInput.vue'

describe('FormInput', () => {
  it('keeps mobile-safe input sizing and exposes the value', async () => {
    const wrapper = mount(FormInput, {
      props: {
        label: 'Nome',
        modelValue: '',
      },
      attrs: {
        name: 'name',
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('style')).toContain('font-size: 16px')

    await input.setValue('Ana')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Ana'])
  })
})
