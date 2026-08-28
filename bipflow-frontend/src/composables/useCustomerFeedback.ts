/**
 * BipFlow Customer Feedback Composable
 *
 * Module-level shared state (same pattern as useToast): one FeedbackDialog
 * instance is mounted per storefront page, and any trigger -- the discreet
 * footer link or a contextual "Relatar problema" button next to a real
 * error -- calls `open()` to drive that single instance, no prop drilling.
 */
import { reactive, ref } from 'vue'
import { feedbackService } from '@/services/feedback.service'
import type { FeedbackContext, FeedbackType } from '@/types/feedback'

export { getErrorRequestId as extractFeedbackCorrelationId } from '@/types/errors'

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

const isOpen = ref(false)
const submitState = ref<SubmitState>('idle')
const errorMessage = ref('')
const context = reactive<FeedbackContext>({})

const form = reactive({
  type: 'other' as FeedbackType,
  message: '',
  contact: '',
})

let lastFocusedElement: HTMLElement | null = null
let resetTimeoutId: number | undefined

function resetForm(): void {
  form.type = 'other'
  form.message = ''
  form.contact = ''
  submitState.value = 'idle'
  errorMessage.value = ''
}

interface OpenOptions extends FeedbackContext {
  type?: FeedbackType
}

/**
 * Open the dialog, optionally pre-filled with context the system already
 * knows -- the customer never has to type what page they're on or which
 * product/order/failed-request this is about.
 */
function open(options: OpenOptions = {}): void {
  window.clearTimeout(resetTimeoutId)
  lastFocusedElement = document.activeElement as HTMLElement | null

  context.pagePath = options.pagePath ?? ''
  context.productId = options.productId ?? null
  context.orderId = options.orderId ?? null
  context.correlationId = options.correlationId ?? ''

  resetForm()
  if (options.type) {
    form.type = options.type
  }

  isOpen.value = true
}

function close(): void {
  isOpen.value = false

  const elementToRefocus = lastFocusedElement
  lastFocusedElement = null
  elementToRefocus?.focus?.()

  // Delayed so the closing transition doesn't visibly clear the form while
  // it's still animating out; a re-open before this fires cancels it.
  resetTimeoutId = window.setTimeout(resetForm, 300)
}

async function submit(): Promise<boolean> {
  if (submitState.value === 'submitting') {
    return false
  }

  if (!form.message.trim()) {
    errorMessage.value = 'Conte o que aconteceu para enviarmos seu relato.'
    submitState.value = 'error'
    return false
  }

  submitState.value = 'submitting'
  errorMessage.value = ''

  try {
    await feedbackService.submit({
      type: form.type,
      message: form.message.trim(),
      contact: form.contact.trim() || undefined,
      page_path: context.pagePath || undefined,
      product_id: context.productId ?? undefined,
      order_id: context.orderId ?? undefined,
      correlation_id: context.correlationId || undefined,
    })
    submitState.value = 'success'
    return true
  } catch {
    // Deliberately generic: the customer doesn't need (and the message
    // field must not leak) backend validation internals here -- the form
    // stays exactly as typed so nothing is lost on retry.
    submitState.value = 'error'
    errorMessage.value = 'Nao conseguimos enviar agora. Tente novamente.'
    return false
  }
}

export function useCustomerFeedback() {
  return {
    isOpen,
    submitState,
    errorMessage,
    context,
    form,
    open,
    close,
    submit,
  }
}
