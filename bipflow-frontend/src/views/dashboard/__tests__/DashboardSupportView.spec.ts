import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DashboardSupportView from '../DashboardSupportView.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { botService } from '@/services/bot.service'
import type { BotConversationDetail, BotConversationSummary, PaginatedBotConversationsResponse } from '@/types/bot'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/services/bot.service', () => ({
  botService: {
    getConversations: vi.fn(),
    getConversation: vi.fn(),
  },
}))
vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
}))

function buildConversation(overrides: Partial<BotConversationSummary> = {}): BotConversationSummary {
  return {
    id: 1,
    session_id: 'sess-1',
    channel: 'web',
    customer_phone: '71999990000',
    status: 'open',
    last_intent: 'catalog',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:05:00Z',
    message_count: 3,
    last_message_preview: 'Oi, gostaria de saber sobre o produto',
    sale_order: null,
    ...overrides,
  }
}

function buildListResponse(results: BotConversationSummary[]): PaginatedBotConversationsResponse {
  return { count: results.length, next: null, previous: null, page_size: 8, total_pages: 1, results }
}

function buildDetail(summary: BotConversationSummary): BotConversationDetail {
  return { ...summary, messages: [] }
}

describe('DashboardSupportView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(null) } as any)
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace: vi.fn().mockResolvedValue(undefined) } as any)
  })

  it('shows an error banner when the conversation list fails to load', async () => {
    vi.mocked(botService.getConversations).mockRejectedValue(new Error('network down'))

    const wrapper = mount(DashboardSupportView, { props: {} })
    await flushPromises()

    expect(wrapper.text()).toContain('Não foi possível carregar as conversas do bot agora.')
  })

  it('shows the empty state when there are no conversations', async () => {
    vi.mocked(botService.getConversations).mockResolvedValue(buildListResponse([]))

    const wrapper = mount(DashboardSupportView, { props: {} })
    await flushPromises()

    expect(wrapper.text()).toContain('Nenhuma conversa encontrada.')
  })

  it('loads the first conversation detail and lists it in the sidebar', async () => {
    const conversation = buildConversation()
    vi.mocked(botService.getConversations).mockResolvedValue(buildListResponse([conversation]))
    vi.mocked(botService.getConversation).mockResolvedValue(buildDetail(conversation))

    const wrapper = mount(DashboardSupportView, { props: {} })
    await flushPromises()

    expect(botService.getConversation).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('71999990000')
  })

  it('shows the shared sale-status label when the conversation converted to an order', async () => {
    const conversation = buildConversation({
      sale_order: { order_reference: 'BPF-0042', status: 'sent', total: '99.90', created_at: '2026-06-20T10:10:00Z' },
    })
    vi.mocked(botService.getConversations).mockResolvedValue(buildListResponse([conversation]))
    vi.mocked(botService.getConversation).mockResolvedValue(buildDetail(conversation))

    const wrapper = mount(DashboardSupportView, { props: {} })
    await flushPromises()

    expect(wrapper.text()).toContain('Converteu em pedido')
    expect(wrapper.text()).toContain('Enviado')
  })
})
