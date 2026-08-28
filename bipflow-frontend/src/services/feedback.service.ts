import api from './api'
import type {
  FeedbackReportFilters,
  FeedbackStatus,
  FeedbackSubmitPayload,
  FeedbackSubmitResponse,
  PaginatedFeedbackReportsResponse,
} from '@/types/feedback'

export const feedbackService = {
  /** Public, works for guests and authenticated customers alike -- the
   * store is resolved server-side, never sent from here (see
   * bipdelivery/api/store_scope.py). */
  async submit(payload: FeedbackSubmitPayload): Promise<FeedbackSubmitResponse> {
    const response = await api.post<FeedbackSubmitResponse>('v1/feedback/', payload)
    return response.data
  },

  async getReports(
    filters: FeedbackReportFilters = {}
  ): Promise<PaginatedFeedbackReportsResponse> {
    const params: Record<string, string | number> = {
      page_size: filters.pageSize ?? 10,
    }

    if (filters.status) {
      params.status = filters.status
    }

    if (filters.type) {
      params.type = filters.type
    }

    if (filters.dateFrom) {
      params.date_from = filters.dateFrom
    }

    if (filters.dateTo) {
      params.date_to = filters.dateTo
    }

    if (filters.page) {
      params.page = filters.page
    }

    const response = await api.get<PaginatedFeedbackReportsResponse>('v1/feedback-reports/', {
      params,
    })

    return response.data
  },

  async updateStatus(id: number, status: FeedbackStatus): Promise<void> {
    await api.patch(`v1/feedback-reports/${id}/status/`, { status })
  },
}
