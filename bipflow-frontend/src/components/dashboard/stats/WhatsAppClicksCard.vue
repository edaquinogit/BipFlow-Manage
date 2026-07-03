<script setup lang="ts">
import { computed } from 'vue';
import { ArrowTrendingUpIcon } from '@heroicons/vue/24/outline';
import type { SaleOrderCustomerInsights } from '@/types/sales';
import Card from '@/components/ui/Card.vue';

const props = defineProps<{
  insights: SaleOrderCustomerInsights | null;
  isLoading: boolean;
}>();

const totalClicks = computed(() => props.insights?.whatsapp_clicks ?? props.insights?.bot_conversations_count ?? 0);
const conversionRate = computed(() => props.insights?.whatsapp_conversion_rate ?? props.insights?.bot_conversion_rate ?? null);
const convertedOrders = computed(() => props.insights?.whatsapp_converted_orders ?? props.insights?.bot_converted_count ?? 0);
const clickConversionLabel = computed(() => {
  if (conversionRate.value == null) {
    return 'Sem dados';
  }

  return `${Number(conversionRate.value).toFixed(1)}%`;
});

const interactionSource = computed(() => (props.insights?.whatsapp_clicks != null ? 'Cliques no WhatsApp' : 'Interações totais'));
</script>

<template>
  <Card aria-label="Cliques no WhatsApp e conversao" overflow-hidden>
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Engajamento WhatsApp</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-[#05050A]">Cliques no WhatsApp</h3>
      </div>
      <ArrowTrendingUpIcon class="h-6 w-6 text-cyan-600" />
    </div>

    <div v-if="isLoading" aria-live="polite" class="mt-6 grid gap-4">
      <span class="sr-only">Carregando cliques do WhatsApp</span>
      <div class="h-16 animate-pulse rounded-2xl bg-zinc-100" />
      <div class="h-16 animate-pulse rounded-2xl bg-zinc-100" />
    </div>

    <div v-else class="mt-6 space-y-6">
      <div class="rounded-3xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">{{ interactionSource }}</p>
        <p class="mt-3 text-3xl font-black text-[#05050A]">{{ totalClicks }}</p>
        <p class="mt-2 text-[11px] font-bold uppercase tracking-widest text-bip-muted">
          {{ convertedOrders }} pedidos registrados
        </p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="rounded-3xl border border-[#E5E7EB] bg-white p-4">
          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Taxa de conversão</p>
          <p class="mt-3 text-2xl font-black text-[#05050A]">{{ clickConversionLabel }}</p>
        </div>

        <div class="rounded-3xl border border-[#E5E7EB] bg-white p-4">
          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Pedidos via WhatsApp</p>
          <p class="mt-3 text-2xl font-black text-[#05050A]">{{ convertedOrders }}</p>
        </div>
      </div>
    </div>
  </Card>
</template>
