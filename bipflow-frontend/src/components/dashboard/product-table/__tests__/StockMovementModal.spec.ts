import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StockMovementModal from '../StockMovementModal.vue'
import type { Product } from '@/schemas/product.schema'

const product = { id: 1, name: 'Produto teste', stock_quantity: 10 } as Product

const mountModal = (props: Partial<{ show: boolean; product: Product | null; isSubmitting: boolean }> = {}) =>
  mount(StockMovementModal, {
    props: {
      show: true,
      product,
      isSubmitting: false,
      ...props,
    },
    // Render the Teleport target inline instead of moving it to <body> so
    // wrapper.find() can reach it directly.
    global: {
      stubs: { teleport: true },
    },
  })

describe('StockMovementModal', () => {
  it('does not render when show is false', () => {
    const wrapper = mountModal({ show: false })

    expect(wrapper.find('[data-cy="btn-confirm-movement"]').exists()).toBe(false)
  })

  it('defaults to entrada and resets reason when switching type', async () => {
    const wrapper = mountModal()

    expect(wrapper.find('[data-cy="btn-movement-type-entrada"]').classes()).toContain('type-toggle-active')

    await wrapper.find('[data-cy="select-movement-reason"]').setValue('compra')
    await wrapper.find('[data-cy="btn-movement-type-saida"]').trigger('click')

    expect(wrapper.find('[data-cy="btn-movement-type-saida"]').classes()).toContain('type-toggle-active')
    expect((wrapper.find('[data-cy="select-movement-reason"]').element as HTMLSelectElement).value).toBe('')
  })

  it('blocks submit and shows an error when quantity is zero', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-cy="input-movement-quantity"]').setValue(0)
    await wrapper.find('[data-cy="select-movement-reason"]').setValue('compra')
    await wrapper.find('[data-cy="btn-confirm-movement"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Informe uma quantidade maior que zero.')
  })

  it('blocks submit and shows an error when no reason is selected', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-cy="input-movement-quantity"]').setValue(5)
    await wrapper.find('[data-cy="btn-confirm-movement"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Selecione um motivo.')
  })

  it('blocks saida that would drive projected stock negative', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-cy="btn-movement-type-saida"]').trigger('click')
    await wrapper.find('[data-cy="input-movement-quantity"]').setValue(999)
    await wrapper.find('[data-cy="select-movement-reason"]').setValue('perda_avaria')
    await wrapper.find('[data-cy="btn-confirm-movement"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Quantidade maior que o estoque disponível.')
  })

  it('emits submit with the correct payload on valid entrada input', async () => {
    const wrapper = mountModal()

    await wrapper.find('[data-cy="input-movement-quantity"]').setValue(7)
    await wrapper.find('[data-cy="select-movement-reason"]').setValue('compra')
    await wrapper.find('[data-cy="input-movement-notes"]').setValue('Reposição mensal')
    await wrapper.find('[data-cy="btn-confirm-movement"]').trigger('click')

    expect(wrapper.emitted('submit')?.at(-1)).toEqual([
      { movement_type: 'entrada', quantity: 7, reason: 'compra', notes: 'Reposição mensal' },
    ])
  })

  it('disables the confirm button while isSubmitting is true', () => {
    const wrapper = mountModal({ isSubmitting: true })

    expect(
      (wrapper.find('[data-cy="btn-confirm-movement"]').element as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('resets the form state every time it becomes visible', async () => {
    const wrapper = mountModal({ show: false })

    await wrapper.setProps({ show: true })
    await wrapper.find('[data-cy="btn-movement-type-saida"]').trigger('click')
    await wrapper.find('[data-cy="input-movement-quantity"]').setValue(42)

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })

    expect((wrapper.find('[data-cy="input-movement-quantity"]').element as HTMLInputElement).value).toBe('1')
    expect(wrapper.find('[data-cy="btn-movement-type-entrada"]').classes()).toContain('type-toggle-active')
  })
})
