<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import { botService } from '@/services/bot.service'
import { Logger } from '@/services/logger'
import type {
  BotConversationDetail,
  BotConversationStatus,
  BotConversationSummary,
} from '@/types/bot'

type StatusFilter = 'all' | BotConversationStatus

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Aguardando cliente', value: 'waiting_customer' },
  { label: 'Handoff humano', value: 'waiting_human' },
  { label: 'Abertas', value: 'open' },
  { label: 'Fechadas', value: 'closed' },
]

const conversations = ref<BotConversationSummary[]>([])
const selectedConversation = ref<BotConversationDetail | null>(null)
const selectedConversationId = ref<number | null>(null)
const isPanelOpen = ref(false)
const hasLoadedList = ref(false)
const statusFilter = ref<StatusFilter>('all')
const searchTerm = ref('')
const totalConversations = ref(0)
const isLoadingList = ref(false)
const isLoadingDetail = ref(false)
const listError = ref<string | null>(null)
const detailError = ref<string | null>(null)

let searchTimeoutId: number | undefined

const humanQueueCount = computed(() => (
  conversations.value.filter((conversation) => conversation.status === 'waiting_human').length
))

const currentPageMessageCount = computed(() => (
  conversations.value.reduce((total, conversation) => total + conversation.message_count, 0)
))

const selectedMessages = computed(() => selectedConversation.value?.messages ?? [])

function buildConversationFilters() {
  return {
    pageSize: 8,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    search: searchTerm.value.trim() || undefined,
  }
}

async function fetchConversations(options: { keepSelection?: boolean } = {}): Promise<void> {
  const previousSelectedId = selectedConversationId.value
  isLoadingList.value = true
  listError.value = null

  try {
    const response = await botService.getConversations(buildConversationFilters())
    conversations.value = response.results
    totalConversations.value = response.count
    hasLoadedList.value = true

    const canKeepSelection = Boolean(
      options.keepSelection
        && previousSelectedId
        && response.results.some((conversation) => conversation.id === previousSelectedId)
    )
    const nextConversationId = canKeepSelection
      ? previousSelectedId
      : response.results[0]?.id ?? null

    if (nextConversationId) {
      await selectConversation(nextConversationId)
      return
    }

    selectedConversationId.value = null
    selectedConversation.value = null
  } catch (error: unknown) {
    Logger.warn('Failed to load bot conversations', { error })
    listError.value = 'Nao foi possivel carregar as conversas do bot agora.'
  } finally {
    isLoadingList.value = false
  }
}

async function selectConversation(conversationId: number): Promise<void> {
  selectedConversationId.value = conversationId
  isLoadingDetail.value = true
  detailError.value = null

  try {
    selectedConversation.value = await botService.getConversation(conversationId)
  } catch (error: unknown) {
    Logger.warn('Failed to load bot conversation detail', { error, conversationId })
    detailError.value = 'Nao foi possivel abrir essa conversa.'
  } finally {
    isLoadingDetail.value = false
  }
}

function refreshConversations(): void {
  if (!isPanelOpen.value) {
    isPanelOpen.value = true
  }

  void fetchConversations({ keepSelection: true })
}

function scheduleConversationFetch(): void {
  if (!isPanelOpen.value) {
    return
  }

  window.clearTimeout(searchTimeoutId)
  searchTimeoutId = window.setTimeout(() => {
    void fetchConversations()
  }, 320)
}

function openPanel(): void {
  isPanelOpen.value = true

  if (!hasLoadedList.value && !isLoadingList.value) {
    void fetchConversations()
  }
}

function closePanel(): void {
  isPanelOpen.value = false
}

function getStatusLabel(status: BotConversationStatus): string {
  const labels: Record<BotConversationStatus, string> = {
    open: 'Aberta',
    waiting_customer: 'Aguardando cliente',
    waiting_human: 'Handoff humano',
    closed: 'Fechada',
  }

  return labels[status]
}

function getStatusClass(status: BotConversationStatus): string {
  const classes: Record<BotConversationStatus, string> = {
    open: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    waiting_customer: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    waiting_human: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    closed: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300',
  }

  return classes[status]
}

function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    greeting: 'Boas-vindas',
    catalog: 'Catalogo',
    product_search: 'Busca',
    delivery: 'Entrega',
    checkout: 'Checkout',
    human_support: 'Atendimento',
    fallback: 'Fallback',
  }

  return labels[intent] ?? 'Sem intencao'
}

function getMessageAuthorLabel(role: 'bot' | 'user'): string {
  return role === 'bot' ? 'Bot' : 'Cliente'
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponivel'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

watch(statusFilter, () => {
  if (isPanelOpen.value) {
    void fetchConversations()
  }
})

watch(searchTerm, scheduleConversationFetch)

onBeforeUnmount(() => {
  window.clearTimeout(searchTimeoutId)
})

defineExpose({
  openPanel,
})
</script>

<template>
  <section
    id="dashboard-bot"
    class="space-y-5"
    :aria-busy="isLoadingList || isLoadingDetail ? 'true' : 'false'"
  >
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <p class="text-sm font-medium text-zinc-400">Atendimento</p>
        <h2 class="mt-1 text-2xl font-semibold text-white">
          Vitrine do chatbot
        </h2>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Conversas do catalogo, pedidos de atendimento humano e ultimas mensagens em um painel limpo.
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          v-if="isPanelOpen"
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isLoadingList"
          aria-label="Atualizar conversas do bot"
          @click="refreshConversations"
        >
          <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': isLoadingList }" />
        </button>

        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
          :aria-expanded="isPanelOpen"
          @click="isPanelOpen ? closePanel() : openPanel()"
        >
          <ChatBubbleLeftRightIcon class="h-5 w-5" />
          {{ isPanelOpen ? 'Recolher' : 'Abrir vitrine' }}
        </button>
      </div>
    </div>

    <button
      v-if="!isPanelOpen"
      type="button"
      class="group flex w-full items-center justify-between gap-5 rounded-lg border border-white/10 bg-zinc-950/80 p-4 text-left shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:border-white/20 hover:bg-zinc-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
      @click="openPanel"
    >
      <span>
        <span class="block text-sm font-semibold text-white">Abrir painel de atendimento</span>
        <span class="mt-1 block text-sm leading-6 text-zinc-500">
          Veja conversas recentes, status de handoff e historico do bot sem ocupar a tela principal.
        </span>
      </span>
      <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-950 transition group-hover:bg-zinc-200">
        <ChatBubbleLeftRightIcon class="h-5 w-5" />
      </span>
    </button>

    <Teleport to="body">
      <Transition name="bot-showcase">
        <div
          v-if="isPanelOpen"
          class="fixed inset-0 z-[100] bg-black/55 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-bot-showcase-title"
          @click.self="closePanel"
        >
          <div class="mx-auto flex h-full max-h-[calc(100vh-2.5rem)] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50">
            <header class="flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div class="min-w-0">
                <p class="text-sm font-medium text-zinc-500">Atendimento</p>
                <h3 id="dashboard-bot-showcase-title" class="mt-1 text-xl font-semibold text-white">
                  Vitrine do chatbot
                </h3>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition hover:border-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="isLoadingList"
                  aria-label="Atualizar conversas do bot"
                  @click="refreshConversations"
                >
                  <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': isLoadingList }" />
                </button>

                <button
                  type="button"
                  class="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                  @click="closePanel"
                >
                  Fechar
                </button>
              </div>
            </header>

            <div class="grid gap-3 border-b border-white/10 p-4 md:grid-cols-3">
              <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p class="text-sm text-zinc-500">Conversas</p>
                <p class="mt-2 text-3xl font-semibold text-white">
                  {{ totalConversations }}
                </p>
              </div>

              <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p class="text-sm text-zinc-500">Handoff humano</p>
                <p class="mt-2 text-3xl font-semibold text-amber-200">
                  {{ humanQueueCount }}
                </p>
              </div>

              <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p class="text-sm text-zinc-500">Mensagens na pagina</p>
                <p class="mt-2 text-3xl font-semibold text-emerald-200">
                  {{ currentPageMessageCount }}
                </p>
              </div>
            </div>

            <div class="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,0.92fr)_minmax(0,1.38fr)]">
              <aside class="min-h-0 border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
                <div class="border-b border-white/10 p-4">
                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-1">
                    <label class="relative block">
                      <span class="sr-only">Buscar conversa</span>
                      <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        v-model="searchTerm"
                        type="search"
                        class="h-10 w-full rounded-lg border border-transparent bg-white/[0.06] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/10"
                        placeholder="Buscar sessao, telefone ou mensagem"
                      />
                    </label>

                    <label class="relative block">
                      <span class="sr-only">Filtrar por status</span>
                      <FunnelIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <select
                        v-model="statusFilter"
                        class="h-10 w-full appearance-none rounded-lg border border-transparent bg-white/[0.06] pl-10 pr-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/10"
                      >
                        <option
                          v-for="option in STATUS_OPTIONS"
                          :key="option.value"
                          :value="option.value"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </label>
                  </div>
                </div>

                <div class="max-h-72 overflow-y-auto p-3 lg:max-h-none lg:h-full">
                  <div
                    v-if="isLoadingList && conversations.length === 0"
                    class="space-y-3"
                  >
                    <div
                      v-for="index in 4"
                      :key="index"
                      class="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]"
                    />
                  </div>

                  <div
                    v-else-if="listError"
                    class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-medium text-rose-100"
                  >
                    <ExclamationTriangleIcon class="mb-3 h-5 w-5" />
                    {{ listError }}
                  </div>

                  <div
                    v-else-if="conversations.length === 0"
                    class="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm font-medium text-zinc-300"
                  >
                    Nenhuma conversa encontrada.
                  </div>

                  <div v-else class="space-y-2">
                    <button
                      v-for="conversation in conversations"
                      :key="conversation.id"
                      type="button"
                      class="w-full rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                      :class="selectedConversationId === conversation.id
                        ? 'border-white/30 bg-white/[0.08]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'"
                      :aria-label="`Abrir conversa ${conversation.session_id}`"
                      @click="selectConversation(conversation.id)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="truncate text-sm font-semibold text-white">
                            {{ conversation.customer_phone || conversation.session_id }}
                          </p>
                          <p class="mt-1 text-xs text-zinc-500">
                            {{ formatDateTime(conversation.updated_at) }}
                          </p>
                        </div>
                        <span
                          class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium"
                          :class="getStatusClass(conversation.status)"
                        >
                          {{ getStatusLabel(conversation.status) }}
                        </span>
                      </div>

                      <p class="mt-3 line-clamp-2 text-xs leading-5 text-zinc-400">
                        {{ conversation.last_message_preview || 'Sem mensagem recente.' }}
                      </p>
                    </button>
                  </div>
                </div>
              </aside>

              <section class="flex min-h-0 flex-col">
                <div class="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                  <div class="min-w-0">
                    <p class="text-sm text-zinc-500">Conversa aberta</p>
                    <h4 class="mt-1 truncate text-xl font-semibold text-white">
                      {{ selectedConversation?.customer_phone || selectedConversation?.session_id || 'Nenhuma sessao aberta' }}
                    </h4>
                  </div>

                  <ChatBubbleLeftRightIcon class="h-6 w-6 shrink-0 text-zinc-400" />
                </div>

                <div v-if="isLoadingDetail" class="space-y-4 p-5">
                  <div class="h-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
                  <div class="ml-auto h-20 w-4/5 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
                  <div class="h-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
                </div>

                <div
                  v-else-if="detailError"
                  class="m-5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-5 text-sm font-medium text-rose-100"
                >
                  <ExclamationTriangleIcon class="mb-3 h-5 w-5" />
                  {{ detailError }}
                </div>

                <div
                  v-else-if="!selectedConversation"
                  class="m-5 rounded-lg border border-white/10 bg-white/[0.03] p-6 text-sm font-medium text-zinc-300"
                >
                  Nenhuma conversa selecionada.
                </div>

                <div v-else class="flex min-h-0 flex-1 flex-col">
                  <div class="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-3">
                    <div>
                      <p class="text-xs text-zinc-500">Status</p>
                      <p class="mt-1 text-sm font-semibold text-white">{{ getStatusLabel(selectedConversation.status) }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-zinc-500">Intencao</p>
                      <p class="mt-1 text-sm font-semibold text-white">{{ getIntentLabel(selectedConversation.last_intent) }}</p>
                    </div>
                    <div>
                      <p class="text-xs text-zinc-500">Canal</p>
                      <p class="mt-1 text-sm font-semibold text-white">{{ selectedConversation.channel }}</p>
                    </div>
                  </div>

                  <div class="flex-1 space-y-4 overflow-y-auto p-5">
                    <article
                      v-for="message in selectedMessages"
                      :key="message.id"
                      class="max-w-[88%] rounded-lg border p-4"
                      :class="message.role === 'bot'
                        ? 'border-white/10 bg-white/[0.04] text-zinc-100'
                        : 'ml-auto border-rose-400/20 bg-rose-500/10 text-white'"
                    >
                      <div class="mb-2 flex items-center justify-between gap-3">
                        <span class="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
                          <component
                            :is="message.role === 'bot' ? ChatBubbleLeftRightIcon : UserCircleIcon"
                            class="h-4 w-4"
                          />
                          {{ getMessageAuthorLabel(message.role) }}
                        </span>
                        <span class="shrink-0 text-xs text-zinc-500">
                          {{ formatDateTime(message.created_at) }}
                        </span>
                      </div>
                      <p class="whitespace-pre-line text-sm leading-6">
                        {{ message.content }}
                      </p>
                      <p v-if="message.intent" class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
                        <PhoneIcon v-if="message.intent === 'human_support'" class="h-3.5 w-3.5" />
                        {{ getIntentLabel(message.intent) }}
                      </p>
                    </article>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.bot-showcase-enter-active,
.bot-showcase-leave-active {
  transition: opacity 0.18s ease;
}

.bot-showcase-enter-active > div,
.bot-showcase-leave-active > div {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.bot-showcase-enter-from,
.bot-showcase-leave-to {
  opacity: 0;
}

.bot-showcase-enter-from > div,
.bot-showcase-leave-to > div {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
