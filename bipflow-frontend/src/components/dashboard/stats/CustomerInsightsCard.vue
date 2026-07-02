<script setup lang="ts">
import { computed } from 'vue';
import { ChatBubbleLeftRightIcon, UserGroupIcon } from '@heroicons/vue/24/outline';
import type { SaleOrderCustomerInsights } from '@/types/sales';
import Card from '@/components/ui/Card.vue';

const props = defineProps<{
  insights: SaleOrderCustomerInsights | null;
  isLoading: boolean;
}>();

const hasConversations = computed(() => (props.insights?.bot_conversations_count ?? 0) > 0);

const conversionLabel = computed(() => {
  if (!hasConversations.value || props.insights?.bot_conversion_rate == null) {
    return 'Sem dados';
  }

  return `${Number(props.insights.bot_conversion_rate).toFixed(1)}%`;
});

const totalCustomers = computed(
  () => (props.insights?.new_customers ?? 0) + (props.insights?.returning_customers ?? 0)
);

const returningShare = computed(() => {
  if (!totalCustomers.value) {
    return 0;
  }

  return Math.round(((props.insights?.returning_customers ?? 0) / totalCustomers.value) * 100);
});
</script>

<template>
  <Card aria-label="Conversao do bot e perfil de clientes">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Conversao e clientes</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-[#05050A]">Bot e recorrencia</h3>
      </div>
      <UserGroupIcon class="h-6 w-6 text-indigo-600" />
    </div>

    <div v-if="isLoading" aria-live="polite" class="mt-6 grid grid-cols-2 gap-4">
      <span class="sr-only">Carregando conversao e clientes</span>
      <div class="h-20 animate-pulse rounded-2xl bg-zinc-100" />
      <div class="h-20 animate-pulse rounded-2xl bg-zinc-100" />
    </div>

    <div v-else class="mt-6 grid grid-cols-2 gap-4">
      <div>
        <div class="flex items-center gap-1.5 text-bip-muted">
          <ChatBubbleLeftRightIcon class="h-3.5 w-3.5" />
          <p class="text-[10px] font-black uppercase tracking-widest">Conversao do bot</p>
        </div>
        <p class="mt-1 text-3xl font-black italic tracking-tighter text-[#05050A]">{{ conversionLabel }}</p>
        <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-bip-muted">
          {{ insights?.bot_converted_count ?? 0 }} de {{ insights?.bot_conversations_count ?? 0 }} conversas
        </p>
      </div>

      <div>
        <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Clientes recorrentes</p>
        <p class="mt-1 text-3xl font-black italic tracking-tighter text-[#05050A]">{{ returningShare }}%</p>
        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            class="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
            :style="{ width: returningShare + '%' }"
          />
        </div>
        <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-bip-muted">
          {{ insights?.new_customers ?? 0 }} novos - {{ insights?.returning_customers ?? 0 }} recorrentes
        </p>
      </div>
    </div>
  </Card>
</template>
