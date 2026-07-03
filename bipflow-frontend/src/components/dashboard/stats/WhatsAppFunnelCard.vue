<script setup lang="ts">
import { computed } from 'vue';
import { ChatBubbleLeftRightIcon } from '@heroicons/vue/24/outline';
import type { SaleOrderCustomerInsights } from '@/types/sales';
import Card from '@/components/ui/Card.vue';

const props = defineProps<{
  insights: SaleOrderCustomerInsights | null;
  isLoading: boolean;
}>();

const hasConversations = computed(() => (props.insights?.bot_conversations_count ?? 0) > 0);
const totalCustomers = computed(
  () => (props.insights?.new_customers ?? 0) + (props.insights?.returning_customers ?? 0)
);
const returningShare = computed(() => {
  if (!totalCustomers.value) {
    return 0;
  }

  return Math.round(((props.insights?.returning_customers ?? 0) / totalCustomers.value) * 100);
});

const conversionRate = computed(() =>
  props.insights?.whatsapp_conversion_rate ?? props.insights?.bot_conversion_rate ?? null
);

const conversationConversionLabel = computed(() => {
  if (!hasConversations.value || conversionRate.value == null) {
    return 'Sem dados';
  }

  return `${Number(conversionRate.value).toFixed(1)}%`;
});

const interactionsCount = computed(
  () => props.insights?.whatsapp_clicks ?? props.insights?.bot_conversations_count ?? 0
);
const interactionLabel = computed(
  () => (props.insights?.whatsapp_clicks != null ? 'Cliques no WhatsApp' : 'Conversas iniciadas')
);
const convertedCount = computed(() => props.insights?.bot_converted_count ?? 0);
const timeToClose = computed(() => props.insights?.average_whatsapp_response_time_seconds ?? null);
const formattedTimeToClose = computed(() => {
  if (timeToClose.value == null) {
    return 'Indisponível';
  }

  const minutes = Math.floor(timeToClose.value / 60);
  const seconds = timeToClose.value % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
});
</script>

<template>
  <Card aria-label="Funil de conversao do WhatsApp">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Funil WhatsApp</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-[#05050A]">Conversao em conversas</h3>
      </div>
      <ChatBubbleLeftRightIcon class="h-6 w-6 text-cyan-600" />
    </div>

    <div v-if="isLoading" aria-live="polite" class="mt-6 grid grid-cols-1 gap-4">
      <span class="sr-only">Carregando funil do WhatsApp</span>
      <div class="h-16 animate-pulse rounded-2xl bg-zinc-100" />
      <div class="h-16 animate-pulse rounded-2xl bg-zinc-100" />
    </div>

    <div v-else class="mt-6 space-y-6">
      <div class="rounded-3xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Taxa de conversão WhatsApp → pedido</p>
        <p class="mt-3 text-3xl font-black text-[#05050A]">{{ conversationConversionLabel }}</p>
        <p class="mt-2 text-[11px] font-bold uppercase tracking-widest text-bip-muted">
          {{ convertedCount }} pedidos de {{ interactionsCount }} interações
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="rounded-3xl border border-[#E5E7EB] bg-white p-4">
          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">{{ interactionLabel }}</p>
          <p class="mt-3 text-2xl font-black text-[#05050A]">{{ interactionsCount }}</p>
          <div class="mt-2 h-2 rounded-full bg-zinc-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-500"
              :style="{ width: `${Math.max(6, Math.min(100, interactionsCount ? Math.min(100, Math.round((convertedCount / interactionsCount) * 100)) : 0))}%` }"
            />
          </div>
        </div>

        <div class="rounded-3xl border border-[#E5E7EB] bg-white p-4">
          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Pedidos via WhatsApp</p>
          <p class="mt-3 text-2xl font-black text-[#05050A]">{{ convertedCount }}</p>
          <p class="mt-1 text-[11px] font-bold uppercase tracking-widest text-bip-muted">
            de {{ interactionsCount }} interações
          </p>
        </div>

        <div class="rounded-3xl border border-[#E5E7EB] bg-white p-4">
          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Tempo médio de fechamento</p>
          <p class="mt-3 text-2xl font-black text-[#05050A]">{{ formattedTimeToClose }}</p>
        </div>

        <div class="rounded-3xl border border-[#E5E7EB] bg-white p-4">
          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Clientes recorrentes</p>
          <p class="mt-3 text-2xl font-black text-[#05050A]">{{ returningShare }}%</p>
          <p class="mt-1 text-[11px] font-bold uppercase tracking-widest text-bip-muted">
            {{ props.insights?.returning_customers ?? 0 }} recorrentes
          </p>
        </div>
      </div>
    </div>
  </Card>
</template>
