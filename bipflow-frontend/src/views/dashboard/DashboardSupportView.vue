<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { getSaleStatusLabel } from '@/constants/saleOrder';
import { botService } from '@/services/bot.service';
import { Logger } from '@/services/logger';
import { DashboardRoutes } from '@/router/dashboard.routes';
import type {
  BotConversationDetail,
  BotConversationStatus,
  BotConversationSummary,
} from '@/types/bot';
import { formatBRL } from '@/utils/formatters';

const props = defineProps<{
  conversationId?: string;
}>();

type StatusFilter = 'all' | BotConversationStatus;

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Aguardando cliente', value: 'waiting_customer' },
  { label: 'Handoff humano', value: 'waiting_human' },
  { label: 'Abertas', value: 'open' },
  { label: 'Fechadas', value: 'closed' },
];

const router = useRouter();

const conversations = ref<BotConversationSummary[]>([]);
const selectedConversation = ref<BotConversationDetail | null>(null);
const selectedConversationId = ref<number | null>(null);
const statusFilter = ref<StatusFilter>('all');
const searchTerm = ref('');
const totalConversations = ref(0);
const isLoadingList = ref(false);
const isLoadingDetail = ref(false);
const listError = ref<string | null>(null);
const detailError = ref<string | null>(null);

let searchTimeoutId: number | undefined;

const humanQueueCount = computed(() => (
  conversations.value.filter((conversation) => conversation.status === 'waiting_human').length
));

const currentPageMessageCount = computed(() => (
  conversations.value.reduce((total, conversation) => total + conversation.message_count, 0)
));

const selectedMessages = computed(() => selectedConversation.value?.messages ?? []);

function buildConversationFilters() {
  return {
    pageSize: 8,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    search: searchTerm.value.trim() || undefined,
  };
}

async function selectConversation(conversationId: number): Promise<void> {
  selectedConversationId.value = conversationId;
  isLoadingDetail.value = true;
  detailError.value = null;

  try {
    selectedConversation.value = await botService.getConversation(conversationId);
  } catch (error: unknown) {
    Logger.warn('Failed to load bot conversation detail', { error, conversationId });
    detailError.value = 'Não foi possível abrir essa conversa.';
  } finally {
    isLoadingDetail.value = false;
  }
}

async function fetchConversations(): Promise<void> {
  isLoadingList.value = true;
  listError.value = null;

  try {
    const response = await botService.getConversations(buildConversationFilters());
    conversations.value = response.results;
    totalConversations.value = response.count;

    const requestedId = props.conversationId ? Number(props.conversationId) : null;
    const stillExists = requestedId !== null
      && response.results.some((conversation) => conversation.id === requestedId);
    const nextId = stillExists ? requestedId : response.results[0]?.id ?? null;

    if (nextId === null) {
      selectedConversationId.value = null;
      selectedConversation.value = null;
      return;
    }

    if (nextId !== requestedId) {
      void router.replace({
        name: DashboardRoutes.SupportConversation,
        params: { conversationId: String(nextId) },
      });
    }
    await selectConversation(nextId);
  } catch (error: unknown) {
    Logger.warn('Failed to load bot conversations', { error });
    listError.value = 'Não foi possível carregar as conversas do bot agora.';
  } finally {
    isLoadingList.value = false;
  }
}

function openConversation(id: number): void {
  if (id === selectedConversationId.value) {
    return;
  }

  void router.push({ name: DashboardRoutes.SupportConversation, params: { conversationId: String(id) } });
  void selectConversation(id);
}

function refreshConversations(): void {
  void fetchConversations();
}

function scheduleConversationFetch(): void {
  window.clearTimeout(searchTimeoutId);
  searchTimeoutId = window.setTimeout(() => {
    void fetchConversations();
  }, 320);
}

function getStatusLabel(status: BotConversationStatus): string {
  const labels: Record<BotConversationStatus, string> = {
    open: 'Aberta',
    waiting_customer: 'Aguardando cliente',
    waiting_human: 'Handoff humano',
    closed: 'Fechada',
  };

  return labels[status];
}

function getStatusClass(status: BotConversationStatus): string {
  const classes: Record<BotConversationStatus, string> = {
    open: 'border-[#D81B60]/20 bg-[#FCE7F3] text-[#7A143D]',
    waiting_customer: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    waiting_human: 'border-amber-200 bg-amber-50 text-amber-800',
    closed: 'border-[#E5E7EB] bg-zinc-50 text-bip-muted',
  };

  return classes[status];
}

function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    greeting: 'Boas-vindas',
    catalog: 'Catálogo',
    product_search: 'Busca',
    delivery: 'Entrega',
    checkout: 'Checkout',
    human_support: 'Atendimento',
    fallback: 'Fallback',
  };

  return labels[intent] ?? 'Sem intenção';
}

function getMessageAuthorLabel(role: 'bot' | 'user'): string {
  return role === 'bot' ? 'Bot' : 'Cliente';
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

watch(statusFilter, () => {
  void fetchConversations();
});

watch(searchTerm, scheduleConversationFetch);

watch(() => props.conversationId, (id) => {
  if (id && Number(id) !== selectedConversationId.value) {
    void selectConversation(Number(id));
  }
});

useStoreSwitchEffect(() => {
  void fetchConversations();
});

onMounted(() => {
  void fetchConversations();
});

onBeforeUnmount(() => {
  window.clearTimeout(searchTimeoutId);
});
</script>

<template>
  <div :aria-busy="isLoadingList || isLoadingDetail ? 'true' : 'false'">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Atendimento</p>
        <h1 class="mt-1 text-xl font-black italic tracking-tighter text-[#05050A]">Conversas do bot</h1>
      </div>

      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-bip-muted transition hover:border-[#D81B60]/40 hover:text-[#D81B60] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FCE7F3] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isLoadingList"
        aria-label="Atualizar conversas do bot"
        @click="refreshConversations"
      >
        <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': isLoadingList }" />
      </button>
    </div>

    <div class="mt-6 grid gap-3 md:grid-cols-3">
      <div class="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <p class="text-sm text-bip-muted">Conversas</p>
        <p class="mt-2 text-3xl font-semibold text-[#05050A]">{{ totalConversations }}</p>
      </div>

      <div class="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <p class="text-sm text-bip-muted">Handoff humano</p>
        <p class="mt-2 text-3xl font-semibold text-amber-700">{{ humanQueueCount }}</p>
      </div>

      <div class="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <p class="text-sm text-bip-muted">Mensagens na página</p>
        <p class="mt-2 text-3xl font-semibold text-emerald-700">{{ currentPageMessageCount }}</p>
      </div>
    </div>

    <div class="mt-6 grid min-h-0 gap-4 lg:grid-cols-[minmax(280px,0.92fr)_minmax(0,1.38fr)]">
      <aside class="min-h-0 rounded-lg border border-[#E5E7EB] bg-white">
        <div class="border-b border-[#E5E7EB] p-4">
          <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-1">
            <label class="relative block">
              <span class="sr-only">Buscar conversa</span>
              <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bip-muted" />
              <input
                v-model="searchTerm"
                type="search"
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white pl-10 pr-3 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                placeholder="Buscar sessão, telefone ou mensagem"
              />
            </label>

            <label class="relative block">
              <span class="sr-only">Filtrar por status</span>
              <FunnelIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bip-muted" />
              <select
                v-model="statusFilter"
                class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white pl-10 pr-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              >
                <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <div class="max-h-[32rem] overflow-y-auto p-3 lg:max-h-none lg:h-full">
          <div v-if="isLoadingList && conversations.length === 0" class="space-y-3">
            <div v-for="index in 4" :key="index" class="h-24 animate-pulse rounded-lg border border-[#E5E7EB] bg-zinc-50" />
          </div>

          <div
            v-else-if="listError"
            class="rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-4 text-sm font-medium text-[#7A143D]"
          >
            <ExclamationTriangleIcon class="mb-3 h-5 w-5" />
            {{ listError }}
          </div>

          <div
            v-else-if="conversations.length === 0"
            class="rounded-lg border border-[#E5E7EB] bg-white p-5 text-sm font-medium text-bip-muted"
          >
            Nenhuma conversa encontrada.
          </div>

          <div v-else class="space-y-2">
            <button
              v-for="conversation in conversations"
              :key="conversation.id"
              type="button"
              class="w-full rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FCE7F3]"
              :class="selectedConversationId === conversation.id
                ? 'border-[#D81B60]/30 bg-[#FCE7F3]'
                : 'border-[#E5E7EB] bg-white hover:border-[#D81B60]/20 hover:bg-zinc-50'"
              :aria-label="`Abrir conversa ${conversation.session_id}`"
              @click="openConversation(conversation.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-[#05050A]">
                    {{ conversation.customer_phone || conversation.session_id }}
                  </p>
                  <p class="mt-1 text-xs text-bip-muted">
                    {{ formatDateTime(conversation.updated_at) }}
                  </p>
                </div>
                <span class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium" :class="getStatusClass(conversation.status)">
                  {{ getStatusLabel(conversation.status) }}
                </span>
              </div>

              <p class="mt-3 line-clamp-2 text-xs leading-5 text-bip-muted">
                {{ conversation.last_message_preview || 'Sem mensagem recente.' }}
              </p>

              <p v-if="conversation.sale_order" class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <ShoppingBagIcon class="h-3.5 w-3.5" />
                Converteu: {{ conversation.sale_order.order_reference }}
              </p>
            </button>
          </div>
        </div>
      </aside>

      <section class="flex min-h-0 flex-col rounded-lg border border-[#E5E7EB] bg-white">
        <div class="flex items-start justify-between gap-4 border-b border-[#E5E7EB] p-5">
          <div class="min-w-0">
            <p class="text-sm text-bip-muted">Conversa aberta</p>
            <h2 class="mt-1 truncate text-xl font-semibold text-[#05050A]">
              {{ selectedConversation?.customer_phone || selectedConversation?.session_id || 'Nenhuma sessão aberta' }}
            </h2>
          </div>

          <ChatBubbleLeftRightIcon class="h-6 w-6 shrink-0 text-bip-muted" />
        </div>

        <div v-if="isLoadingDetail" class="space-y-4 p-5">
          <div class="h-20 animate-pulse rounded-lg border border-[#E5E7EB] bg-zinc-50" />
          <div class="ml-auto h-20 w-4/5 animate-pulse rounded-lg border border-[#E5E7EB] bg-zinc-50" />
          <div class="h-20 animate-pulse rounded-lg border border-[#E5E7EB] bg-zinc-50" />
        </div>

        <div
          v-else-if="detailError"
          class="m-5 rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-5 text-sm font-medium text-[#7A143D]"
        >
          <ExclamationTriangleIcon class="mb-3 h-5 w-5" />
          {{ detailError }}
        </div>

        <div
          v-else-if="!selectedConversation"
          class="m-5 rounded-lg border border-[#E5E7EB] bg-zinc-50 p-6 text-sm font-medium text-bip-muted"
        >
          Nenhuma conversa selecionada.
        </div>

        <div v-else class="flex min-h-0 flex-1 flex-col">
          <div class="grid gap-3 border-b border-[#E5E7EB] p-5 sm:grid-cols-3">
            <div>
              <p class="text-xs text-bip-muted">Status</p>
              <p class="mt-1 text-sm font-semibold text-[#05050A]">{{ getStatusLabel(selectedConversation.status) }}</p>
            </div>
            <div>
              <p class="text-xs text-bip-muted">Intenção</p>
              <p class="mt-1 text-sm font-semibold text-[#05050A]">{{ getIntentLabel(selectedConversation.last_intent) }}</p>
            </div>
            <div>
              <p class="text-xs text-bip-muted">Canal</p>
              <p class="mt-1 text-sm font-semibold text-[#05050A]">{{ selectedConversation.channel }}</p>
            </div>
          </div>

          <div
            v-if="selectedConversation.sale_order"
            class="m-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
          >
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-2 text-emerald-800">
                <ShoppingBagIcon class="h-5 w-5" />
                <p class="text-sm font-black uppercase tracking-widest">Converteu em pedido</p>
              </div>
              <span class="rounded-full border border-emerald-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-800">
                {{ getSaleStatusLabel(selectedConversation.sale_order.status) }}
              </span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-4">
              <p class="text-sm font-semibold text-[#05050A]">{{ selectedConversation.sale_order.order_reference }}</p>
              <p class="text-lg font-black text-emerald-800">{{ formatBRL(selectedConversation.sale_order.total) }}</p>
            </div>
            <p class="mt-1 text-xs text-emerald-700/70">{{ formatDateTime(selectedConversation.sale_order.created_at) }}</p>
          </div>

          <div class="flex-1 space-y-4 overflow-y-auto p-5">
            <article
              v-for="message in selectedMessages"
              :key="message.id"
              class="max-w-[88%] rounded-lg border p-4"
              :class="message.role === 'bot'
                ? 'border-[#E5E7EB] bg-zinc-50 text-[#05050A]'
                : 'ml-auto border-[#D81B60]/20 bg-[#FCE7F3] text-[#05050A]'"
            >
              <div class="mb-2 flex items-center justify-between gap-3">
                <span class="inline-flex items-center gap-2 text-xs font-medium text-bip-muted">
                  <component :is="message.role === 'bot' ? ChatBubbleLeftRightIcon : UserCircleIcon" class="h-4 w-4" />
                  {{ getMessageAuthorLabel(message.role) }}
                </span>
                <span class="shrink-0 text-xs text-bip-muted">{{ formatDateTime(message.created_at) }}</span>
              </div>
              <p class="whitespace-pre-line text-sm leading-6">{{ message.content }}</p>
              <p v-if="message.intent" class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] px-2.5 py-1 text-xs text-bip-muted">
                <PhoneIcon v-if="message.intent === 'human_support'" class="h-3.5 w-3.5" />
                {{ getIntentLabel(message.intent) }}
              </p>
            </article>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
