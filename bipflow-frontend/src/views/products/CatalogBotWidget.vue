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
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="relative flex h-2.5 w-2.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
                Atendimento
              </p>
            </div>
            <h2 id="catalog-bot-title" class="mt-1 text-base font-semibold text-slate-900">
              Assistente da loja
            </h2>
            <p class="mt-1 text-xs leading-5 text-slate-500">
              Produtos, entrega, pedido e atendimento humano.
            </p>
          </div>

          <button
            type="button"
            class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
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
                v-if="entry.response && getQuickReplyOptions(entry.response).length"
                class="mt-3 grid gap-2 border-t border-slate-100 pt-3"
              >
                <button
                  v-for="option in getQuickReplyOptions(entry.response)"
                  :key="`${entry.id}-${option.value}`"
                  type="button"
                  class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-rose-200 hover:bg-rose-50/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
                  @click="handleBotOption(option)"
                >
                  <span class="block text-xs font-semibold text-slate-900">
                    {{ option.label }}
                  </span>
                  <span v-if="option.description" class="mt-0.5 block text-xs leading-5 text-slate-500">
                    {{ option.description }}
                  </span>
                </button>
              </div>

              <div
                v-if="entry.response && getWhatsAppOptions(entry.response).length"
                class="mt-3 space-y-3 border-t border-slate-100 pt-3"
              >
                <div class="flex items-start gap-2">
                  <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <PhoneIcon class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-900">
                      WhatsApp da loja
                    </p>
                    <p class="mt-0.5 text-xs leading-5 text-slate-500">
                      Escolha o assunto e abra a conversa com a mensagem certa.
                    </p>
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-2">
                  <button
                    v-for="option in getWhatsAppOptions(entry.response)"
                    :key="`${entry.id}-${option.value}`"
                    type="button"
                    class="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
                    @click="handleBotOption(option)"
                  >
                    <span class="block text-sm font-semibold text-slate-900">
                      {{ option.label }}
                    </span>
                    <span v-if="option.description" class="mt-0.5 block text-xs leading-5 text-slate-600">
                      {{ option.description }}
                    </span>
                  </button>
                </div>
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
              placeholder="Escreva do seu jeito"
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
  PhoneIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import { botService, getStoredBotSessionId, storeBotSessionId } from '@/services/bot.service'
import { Logger } from '@/services/logger'
import type { BotMessageResponse, BotOption } from '@/types/bot'
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

const welcomeResponse: BotMessageResponse = {
  conversation_id: 0,
  session_id: '',
  conversation_status: 'open',
  intent: 'greeting',
  reply: 'Oi! Eu te ajudo a encontrar produtos, consultar entrega e finalizar com mais seguranca. Por onde quer comecar?',
  options: [
    {
      label: 'Ver produtos',
      value: 'produtos',
      kind: 'quick_reply',
      description: 'Mostro opcoes disponiveis agora.',
    },
    {
      label: 'Consultar entrega',
      value: 'entrega',
      kind: 'quick_reply',
      description: 'Vejo regioes atendidas e valores.',
    },
    {
      label: 'Falar com atendente',
      value: 'atendente',
      kind: 'quick_reply',
      description: 'Encaminho para atendimento humano.',
    },
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
const sessionId = ref(getStoredBotSessionId())
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
    storeBotSessionId(response.session_id)
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

function getQuickReplyOptions(response: BotMessageResponse): BotOption[] {
  return response.options.filter((option) => (option.kind ?? 'quick_reply') === 'quick_reply')
}

function getWhatsAppOptions(response: BotMessageResponse): BotOption[] {
  return response.options.filter((option) => option.kind === 'whatsapp_link' && Boolean(option.url))
}

function handleBotOption(option: BotOption): void {
  if (option.kind === 'whatsapp_link' && option.url) {
    window.open(option.url, '_blank', 'noopener,noreferrer')
    isOpen.value = false
    return
  }

  void sendMessage(option.value)
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
