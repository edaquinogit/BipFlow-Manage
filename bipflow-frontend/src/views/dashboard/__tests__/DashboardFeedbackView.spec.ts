import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import DashboardFeedbackView from '../DashboardFeedbackView.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useToast } from '@/composables/useToast'
import { feedbackService } from '@/services/feedback.service'
import type { FeedbackReport, PaginatedFeedbackReportsResponse } from '@/types/feedback'

vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/services/feedback.service', () => ({
  feedbackService: { getReports: vi.fn(), updateStatus: vi.fn() },
}))

function buildReport(overrides: Partial<FeedbackReport> = {}): FeedbackReport {
  return {
    id: 1,
    feedback_type: 'shipping',
    message: 'Nao consegui calcular o frete.',
    contact: '',
    page_path: '/produtos',
    product: null,
    product_name: null,
    order: null,
    order_reference: null,
    customer_name: '',
    customer_phone: '',
    correlation_id: 'req-abc-123',
    status: 'new',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
    ...overrides,
  }
}

function buildResponse(
  results: FeedbackReport[],
  overrides: Partial<PaginatedFeedbackReportsResponse> = {}
): PaginatedFeedbackReportsResponse {
  return {
    count: results.length,
    next: null,
    previous: null,
    page_size: 20,
    total_pages: 1,
    results,
    ...overrides,
  }
}

describe('DashboardFeedbackView', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as any)
    vi.mocked(useToast).mockReturnValue(toastState as any)
  })

  it('shows an empty state when there are no reports', async () => {
    vi.mocked(feedbackService.getReports).mockResolvedValue(buildResponse([]))

    const wrapper = mount(DashboardFeedbackView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nenhum feedback recebido ainda.')
  })

  it('shows an error banner when the request fails', async () => {
    vi.mocked(feedbackService.getReports).mockRejectedValue(new Error('network down'))

    const wrapper = mount(DashboardFeedbackView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nao foi possivel carregar os relatos agora.')
  })

  it('lists reports with type label, message and status badge', async () => {
    vi.mocked(feedbackService.getReports).mockResolvedValue(
      buildResponse([buildReport({ feedback_type: 'checkout', status: 'reviewing' })])
    )

    const wrapper = mount(DashboardFeedbackView)
    await flushPromises()

    expect(wrapper.text()).toContain('Checkout')
    expect(wrapper.text()).toContain('Nao consegui calcular o frete.')
    expect(wrapper.text()).toContain('Em analise')
  })

  it('re-fetches with the selected status filter', async () => {
    vi.mocked(feedbackService.getReports).mockResolvedValue(buildResponse([]))

    const wrapper = mount(DashboardFeedbackView)
    await flushPromises()
    vi.mocked(feedbackService.getReports).mockClear()

    await wrapper.find('select').setValue('resolved')
    await flushPromises()

    expect(feedbackService.getReports).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'resolved' })
    )
  })

  it('opens the detail modal and updates the status', async () => {
    const report = buildReport()
    vi.mocked(feedbackService.getReports).mockResolvedValue(buildResponse([report]))
    vi.mocked(feedbackService.updateStatus).mockResolvedValue(undefined)

    const wrapper = mount(DashboardFeedbackView, {
      attachTo: document.body,
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    const detailButton = wrapper.findAll('button').find((b) => b.text().includes('Detalhes'))
    await detailButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('req-abc-123')

    const select = wrapper.find('[role="dialog"] select')
    await select.setValue('resolved')
    await flushPromises()

    expect(feedbackService.updateStatus).toHaveBeenCalledWith(1, 'resolved')
    wrapper.unmount()
  })

  it('disables the status select for a dashboard reader without write access', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(false) } as any)
    const report = buildReport()
    vi.mocked(feedbackService.getReports).mockResolvedValue(buildResponse([report]))

    const wrapper = mount(DashboardFeedbackView, {
      attachTo: document.body,
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    const detailButton = wrapper.findAll('button').find((b) => b.text().includes('Detalhes'))
    await detailButton?.trigger('click')
    await flushPromises()

    const select = wrapper.find('[role="dialog"] select')
    expect(select.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
