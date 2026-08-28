import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import FeedbackDialog from '../FeedbackDialog.vue'
import { useCustomerFeedback } from '@/composables/useCustomerFeedback'
import { feedbackService } from '@/services/feedback.service'

vi.mock('@/services/feedback.service', () => ({
  feedbackService: { submit: vi.fn() },
}))

// attachTo: document.body is required for jsdom to track document.activeElement
// correctly (a detached wrapper never becomes the active element) -- but that
// means every mount leaves real DOM nodes behind, so each one is tracked here
// and torn down in afterEach to keep tests from polluting each other's DOM.
let mountedWrappers: VueWrapper[] = []

function mountDialog() {
  const wrapper = mount(FeedbackDialog, {
    attachTo: document.body,
    global: { stubs: { teleport: true } },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the shared module-level state between tests.
    const { close } = useCustomerFeedback()
    close()
  })

  afterEach(() => {
    mountedWrappers.forEach((wrapper) => wrapper.unmount())
    mountedWrappers = []
  })

  it('is not rendered until open() is called', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('opens with the pre-filled type and closes via the cancel button', async () => {
    const wrapper = mountDialog()
    const { open } = useCustomerFeedback()

    open({ type: 'checkout', pagePath: '/produtos' })
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('checkout')

    await wrapper.findAll('button').find((b) => b.text() === 'Cancelar')?.trigger('click')
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('requires a non-empty message before submitting', async () => {
    const wrapper = mountDialog()
    const { open } = useCustomerFeedback()
    open()
    await nextTick()

    await wrapper.find('form').trigger('submit.prevent')
    await nextTick()

    expect(feedbackService.submit).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Conte o que aconteceu')
  })

  it('submits the form and shows the success state', async () => {
    vi.mocked(feedbackService.submit).mockResolvedValueOnce({ id: 1, status: 'new' })
    const wrapper = mountDialog()
    const { open } = useCustomerFeedback()
    open({ type: 'product', productId: 42, pagePath: '/produtos/combo' })
    await nextTick()

    await wrapper.find('textarea').setValue('O produto veio quebrado.')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(feedbackService.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'product',
        message: 'O produto veio quebrado.',
        product_id: 42,
        page_path: '/produtos/combo',
      })
    )
    expect(wrapper.text()).toContain('Obrigado! Recebemos seu feedback.')
  })

  it('keeps the typed message when submission fails, and disables double-submit', async () => {
    let resolveSubmit: (() => void) | undefined
    vi.mocked(feedbackService.submit).mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          resolveSubmit = () => reject(new Error('network'))
        })
    )
    const wrapper = mountDialog()
    const { open } = useCustomerFeedback()
    open()
    await nextTick()

    await wrapper.find('textarea').setValue('Nao consigo finalizar a compra.')
    await wrapper.find('form').trigger('submit.prevent')
    await nextTick()

    // Still in-flight: the submit button is disabled to prevent a double post.
    const submitButton = wrapper.findAll('button[type="submit"]')[0]
    expect(submitButton?.attributes('disabled')).toBeDefined()

    resolveSubmit?.()
    await flushPromises()

    expect(wrapper.text()).toContain('Nao conseguimos enviar agora')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe(
      'Nao consigo finalizar a compra.'
    )
  })

  it('moves focus into the message field on open and closes on Escape', async () => {
    const wrapper = mountDialog()
    const { open } = useCustomerFeedback()

    open()
    await nextTick()
    await nextTick() // useDialogA11y focuses on the tick after open

    expect(document.activeElement).toBe(wrapper.find('textarea').element)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('returns focus to the element that opened the dialog', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mountDialog()
    const { open } = useCustomerFeedback()
    open()
    // Let useDialogA11y's own "focus the message field on open" settle
    // first -- a real click always arrives well after that, but a
    // single tick here can race ahead of it and steal focus back.
    await flushPromises()

    await wrapper.findAll('button').find((b) => b.text() === 'Cancelar')?.trigger('click')
    await nextTick()

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
