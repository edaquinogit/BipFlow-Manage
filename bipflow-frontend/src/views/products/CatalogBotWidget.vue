<template>
  <div class="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-40 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:left-6">
    <Transition name="bot-panel">
      <section
        v-if="isOpen"
        id="catalog-bot-panel"
        class="mb-4 flex max-h-[min(660px,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-950/5"
        aria-labelledby="catalog-bot-title"
      >
        <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
              Atendimento
            </p>
            <h2 id="catalog-bot-title" class="mt-1 text-base font-semibold text-slate-900">
              Ajuda rapida
            </h2>
          </div>

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
            aria-label="Fechar atendimento"
            @click="isOpen = false"
          >
            <XMarkIcon class="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div ref="messageList" class="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
          <article
            v-for="entry in entries"
            :key="entry.id"
            class="flex"
            :class="entry.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[86%] rounded-[20px] px-4 py-3 text-sm leading-6 shadow-sm"
              :class="entry.role === 'user'
                ? 'bg-rose-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700'"
            >
              <p>{{ entry.text }}</p>

              <div
                v-if="entry.response?.products.length"
                class="mt-3 space-y-2 border-t border-slate-100 pt-3"
              >
                <button
                  v-for="product in entry.response.products"
                  :key="product.id"
                  type="button"
                  class="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-rose-200 hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
                  :disabled="!product.slug"
                  @click="handleOpenProduct(product.slug)"
                >
                  <span class="block text-sm font-semibold text-slate-900">{{ product.name }}</span>
                  <span class="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{{ formatBRL(product.price) }}</span>
                    <span>{{ product.stock_quantity }} em estoque</span>
                  </span>
                </button>
              </div>

              <div
                v-if="entry.response?.delivery_regions.length"
                class="mt-3 space-y-2 border-t border-slate-100 pt-3"
              >
                <div
                  v-for="region in entry.response.delivery_regions"
                  :key="region.id"
                  class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span class="block text-sm font-semibold text-slate-900">{{ region.name }}</span>
                  <span class="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{{ region.city || 'Cidade nao informada' }}</span>
                    <span>{{ formatBRL(region.delivery_fee) }}</span>
                  </span>
                </div>
              </div>

              <div
                v-if="entry.response?.options.length"
                class="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3"
              >
                <button
                  v-for="option in entry.response.options"
                  :key="`${entry.id}-${option.value}`"
                  type="button"
                  class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:text-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
                  @click="handleQuickMessage(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </article>

          <div v-if="isSending" class="flex justify-start" aria-live="polite">
            <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">
              <span class="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              Respondendo
            </div>
          </div>
        </div>

        <form class="border-t border-slate-200 bg-white p-4" @submit.prevent="handleSubmit">
          <p v-if="errorMessage" class="mb-3 text-sm text-rose-600" role="alert">
            {{ errorMessage }}
          </p>

          <div class="flex items-center gap-2">
            <label class="sr-only" for="catalog-bot-message">Mensagem</label>
            <input
              id="catalog-bot-message"
              v-model="draftMessage"
              type="text"
              maxlength="500"
              class="min-h-11 min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              placeholder="Digite sua pergunta"
              :disabled="isSending"
            />

            <button
              type="submit"
              class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
              :disabled="isSending || !draftMessage.trim()"
              aria-label="Enviar mensagem"
            >
              <PaperAirplaneIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </Transition>

    <button
      type="button"
      class="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_18px_35px_-18px_rgba(15,23,42,0.7)] ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:text-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 active:translate-y-0 sm:h-16 sm:w-16"
      :aria-expanded="isOpen"
      aria-controls="catalog-bot-panel"
      aria-label="Abrir atendimento"
      @click="toggleWidget"
    >
      <ChatBubbleLeftRightIcon class="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { botService } from '@/services/bot.service'
import { Logger } from '@/services/logger'
import type { BotMessageResponse } from '@/types/bot'
import { formatBRL } from '@/utils/formatters'

interface ConversationEntry {
  id: number
  role: 'bot' | 'user'
  text: string
  response?: BotMessageResponse
}

const emit = defineEmits<{
  openProduct: [slug: string]
}>()

const BOT_SESSION_STORAGE_KEY = 'bipflow.catalogBot.sessionId'

function readStoredSessionId(): string {
  try {
    return sessionStorage.getItem(BOT_SESSION_STORAGE_KEY) ?? ''
  } catch (error) {
    Logger.debug('Catalog bot session storage is unavailable', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return ''
  }
}

function storeSessionId(nextSessionId: string): void {
  try {
    sessionStorage.setItem(BOT_SESSION_STORAGE_KEY, nextSessionId)
  } catch (error) {
    Logger.debug('Failed to store catalog bot session id', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

const welcomeResponse: BotMessageResponse = {
  conversation_id: 0,
  session_id: '',
  conversation_status: 'open',
  intent: 'greeting',
  reply: 'Ola! Posso ajudar voce a ver produtos, consultar entrega ou finalizar um pedido.',
  options: [
    { label: 'Ver produtos', value: 'produtos' },
    { label: 'Consultar entrega', value: 'entrega' },
    { label: 'Finalizar pedido', value: 'pedido' },
  ],
  products: [],
  delivery_regions: [],
}

const isOpen = ref(false)
const isSending = ref(false)
const draftMessage = ref('')
const errorMessage = ref('')
const messageList = ref<HTMLElement | null>(null)
const conversationId = ref<number | null>(null)
const sessionId = ref(readStoredSessionId())
const entries = ref<ConversationEntry[]>([
  {
    id: 1,
    role: 'bot',
    text: welcomeResponse.reply,
    response: welcomeResponse,
  },
])

let nextEntryId = 2

function appendEntry(entry: Omit<ConversationEntry, 'id'>): void {
  entries.value.push({
    id: nextEntryId,
    ...entry,
  })
  nextEntryId += 1
}

async function scrollToLatestMessage(): Promise<void> {
  await nextTick()
  const container = messageList.value

  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

function toggleWidget(): void {
  isOpen.value = !isOpen.value

  if (isOpen.value) {
    void scrollToLatestMessage()
  }
}

async function sendMessage(message: string): Promise<void> {
  const trimmedMessage = message.trim()

  if (!trimmedMessage || isSending.value) {
    return
  }

  errorMessage.value = ''
  appendEntry({ role: 'user', text: trimmedMessage })
  draftMessage.value = ''
  isSending.value = true
  await scrollToLatestMessage()

  try {
    const response = await botService.sendMessage(trimmedMessage, {
      conversationId: conversationId.value,
      sessionId: sessionId.value || null,
    })
    conversationId.value = response.conversation_id
    sessionId.value = response.session_id
    storeSessionId(response.session_id)
    appendEntry({
      role: 'bot',
      text: response.reply,
      response,
    })
  } catch (error) {
    Logger.warn('Failed to send catalog bot message', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    errorMessage.value = 'Nao foi possivel responder agora. Tente novamente em instantes.'
  } finally {
    isSending.value = false
    await scrollToLatestMessage()
  }
}

function handleSubmit(): void {
  void sendMessage(draftMessage.value)
}

function handleQuickMessage(message: string): void {
  void sendMessage(message)
}

function handleOpenProduct(slug: string | null): void {
  if (!slug) {
    return
  }

  emit('openProduct', slug)
  isOpen.value = false
}
</script>

<style scoped>
.bot-panel-enter-active,
.bot-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.bot-panel-enter-from,
.bot-panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
</style>
