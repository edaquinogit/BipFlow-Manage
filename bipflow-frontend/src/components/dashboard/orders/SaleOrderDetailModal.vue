<script setup lang="ts">
import { ref, toRef } from 'vue';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { SaleOrderDetail } from '@/types/sales';
import {
  getChannelLabel,
  getDeliveryMethodLabel,
  getPaymentLabel,
  getSaleStatusLabel,
} from '@/constants/saleOrder';
import { formatBRL, formatDateTimeBR } from '@/utils/formatters';
import { useDialogA11y } from '@/composables/useDialogA11y';

/**
 * Etapa 0 of the pedidos/NF/envio evolution (see
 * docs/architecture/pedidos-nf-envio-evolution.md): until now there was no
 * way to see a full order -- address, customer notes, or the original
 * WhatsApp message -- anywhere in the dashboard. This is read-only; status
 * changes stay on the order card in DashboardOrdersView.vue.
 */
const props = defineProps<{
  show: boolean;
  order: SaleOrderDetail | null;
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ close: [] }>();

const containerRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

useDialogA11y(toRef(props, 'show'), () => emit('close'), containerRef, closeButtonRef);
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay">
        <div
          ref="containerRef"
          class="modal-container"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes do pedido"
        >
          <button
            ref="closeButtonRef"
            type="button"
            aria-label="Fechar"
            class="close-button"
            @click="emit('close')"
          >
            <XMarkIcon class="h-4 w-4" />
          </button>

          <div v-if="isLoading" class="space-y-3 py-6">
            <div class="h-4 w-40 animate-pulse rounded bg-zinc-100" />
            <div class="h-3 w-64 animate-pulse rounded bg-zinc-100" />
            <div class="h-24 w-full animate-pulse rounded bg-zinc-100" />
          </div>

          <div v-else-if="error" class="rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-4 text-sm text-[#7A143D]">
            {{ error }}
          </div>

          <div v-else-if="order" class="max-h-[75vh] space-y-6 overflow-y-auto pr-1">
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">
                Pedido {{ order.order_reference }}
              </p>
              <h3 class="mt-1 text-xl font-black italic tracking-tighter text-[#05050A]">
                {{ order.customer_name }}
              </h3>
              <div class="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                <span class="rounded-full border border-[#E5E7EB] bg-zinc-50 px-2.5 py-1 text-bip-muted">
                  {{ getSaleStatusLabel(order.status) }}
                </span>
                <span class="rounded-full border border-[#E5E7EB] bg-zinc-50 px-2.5 py-1 text-bip-muted">
                  {{ getChannelLabel(order.channel) }}
                </span>
              </div>
              <p class="mt-2 text-xs text-bip-muted">{{ formatDateTimeBR(order.created_at) }}</p>
            </div>

            <section class="space-y-1.5">
              <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Cliente</h4>
              <p class="text-sm text-[#05050A]">{{ order.customer_phone }}</p>
              <p v-if="order.customer_email" class="text-sm text-[#05050A]">{{ order.customer_email }}</p>
            </section>

            <section class="space-y-1.5">
              <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">
                {{ getDeliveryMethodLabel(order.delivery_method) }}
              </h4>
              <template v-if="order.delivery_method === 'delivery'">
                <p v-if="order.address" class="text-sm text-[#05050A]">
                  {{ order.address }}<span v-if="order.neighborhood">, {{ order.neighborhood }}</span>
                </p>
                <p v-if="order.city" class="text-sm text-[#05050A]">{{ order.city }}</p>
                <p v-if="order.delivery_region_name" class="text-xs text-bip-muted">
                  Regiao: {{ order.delivery_region_name }}
                </p>
                <p v-if="!order.address" class="text-xs text-bip-muted">Endereco nao informado.</p>
              </template>
            </section>

            <section v-if="order.notes" class="space-y-1.5">
              <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">
                Observacoes do cliente
              </h4>
              <p class="whitespace-pre-line text-sm text-[#05050A]">{{ order.notes }}</p>
            </section>

            <section class="space-y-1.5">
              <h4 class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">Itens</h4>
              <ul class="divide-y divide-[#E5E7EB] rounded-lg border border-[#E5E7EB]">
                <li
                  v-for="item in order.items"
                  :key="item.id"
                  class="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span class="min-w-0 truncate text-[#05050A]">{{ item.quantity }}x {{ item.product_name }}</span>
                  <span class="shrink-0 font-mono text-[#05050A]">{{ formatBRL(item.line_total) }}</span>
                </li>
              </ul>
              <div class="flex items-center justify-between px-1 pt-1 text-sm font-black text-[#05050A]">
                <span>Total</span>
                <span class="font-mono">{{ formatBRL(order.total) }}</span>
              </div>
              <p class="px-1 text-xs text-bip-muted">
                Pagamento: {{ getPaymentLabel(order.payment_method) }}
              </p>
            </section>

            <a
              v-if="order.whatsapp_url"
              :href="order.whatsapp_url"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-800 transition hover:bg-emerald-100"
            >
              <ChatBubbleLeftRightIcon class="h-4 w-4" />
              Ver conversa original no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(8px);
}

.modal-container {
  width: 100%;
  max-width: 32rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 2rem;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  position: relative;
}

.close-button {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  display: flex;
  height: 2rem;
  width: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  transition: all 0.2s ease;
  z-index: 1;
}

.close-button:hover {
  background-color: #fafafa;
  color: #05050a;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
