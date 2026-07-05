import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ProductFormRoot from '../ProductFormRoot.vue'
import type { Product } from '@/schemas/product.schema'

/**
 * Regression coverage for a real production bug: saving a product can take
 * much longer than the form's own internal validation step (a cold Render
 * free-tier instance plus up to 3 sequential image uploads to R2 can run
 * into tens of seconds). ProductFormRoot used to reset its "saving" button
 * state the instant it emitted `save`, regardless of whether the parent's
 * async save had actually finished -- the button re-enabled almost
 * immediately, inviting a double submit (duplicate products) while the real
 * request was still in flight. The fix threads the parent's `isSaving`
 * prop into the button's disabled/spinner state instead of relying only on
 * the form's own short-lived local `isSubmitting` flag.
 */

const validProduct: Partial<Product> = {
  id: 1,
  name: 'Produto Valido',
  price: 19.9,
  stock_quantity: 5,
  category: 1,
  sku: 'SKU-1234',
  image: null,
  images: [],
}

// handleSubmit awaits a real setTimeout(50ms) before validating/emitting --
// flushPromises() alone only drains the microtask queue, it doesn't advance
// real timers, so tests must actually wait past it.
async function waitForFormValidation() {
  await new Promise((resolve) => setTimeout(resolve, 60))
  await flushPromises()
}

function mountForm(props: Partial<InstanceType<typeof ProductFormRoot>['$props']> = {}) {
  return mount(ProductFormRoot, {
    props: {
      isOpen: true,
      initialData: validProduct as Product,
      categories: [{ id: 1, name: 'Categoria Teste' }],
      isSaving: false,
      ...props,
    },
  })
}

describe('ProductFormRoot', () => {
  it('stays disabled and shows the saving state until the parent reports isSaving=false, even after the form itself has emitted save', async () => {
    const wrapper = mountForm({ isSaving: false })

    await wrapper.find('form').trigger('submit')
    await waitForFormValidation()

    expect(wrapper.emitted('save')).toHaveLength(1)

    // The parent's real async save is still in flight at this point (the
    // regression: the button used to re-enable right here, before the
    // network request -- possibly still cold-starting on Render -- ever
    // resolved).
    await wrapper.setProps({ isSaving: true })

    const submitButton = wrapper.find('[data-cy="btn-submit-product"]')
    expect((submitButton.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Salvando...')

    // Only once the parent's save truly resolves does the button recover.
    await wrapper.setProps({ isSaving: false })
    expect((submitButton.element as HTMLButtonElement).disabled).toBe(false)
    expect(wrapper.text()).not.toContain('Salvando...')
  })

  it('never emits a second save while the parent-reported save is still in flight', async () => {
    const wrapper = mountForm({ isSaving: true })

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('emits save with the parsed form data on a normal, non-busy submit', async () => {
    const wrapper = mountForm()

    await wrapper.find('form').trigger('submit')
    await waitForFormValidation()

    const emitted = wrapper.emitted('save')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toMatchObject({
      name: 'Produto Valido',
      price: 19.9,
      category: 1,
    })
  })
})
