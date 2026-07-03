<script setup lang="ts">
import { ref, toRef } from 'vue';
import { PrinterIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { PdvSaleResponse } from '@/types/pdvSale';
import { getPaymentLabel } from '@/constants/saleOrder';
import { formatBRL } from '@/utils/formatters';
import { useDialogA11y } from '@/composables/useDialogA11y';

/**
 * Etapa R2 of the QR-code stock-exit refinement (see
 * docs/architecture/qrcode-stock-exit-refinement.md): a receipt/confirmation
 * screen after a PDV sale finalizes -- until now the only feedback was a
 * toast that disappears in a few seconds, with no itemized record on
 * screen for the cashier (or the customer) to check.
 */
const props = defineProps<{
  show: boolean;
  sale: PdvSaleResponse | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

useDialogA11y(toRef(props, 'show'), () => emit('close'), containerRef, closeButtonRef);

const handlePrint = (): void => {
  window.print();
};
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show && sale" class="modal-overlay no-print">
        <div
          ref="containerRef"
          class="modal-container"
          role="dialog"
          aria-modal="true"
          aria-label="Venda registrada"
        >
          <button
            ref="closeButtonRef"
            type="button"
            aria-label="Fechar"
            class="close-button no-print"
            @click="emit('close')"
          >
            <XMarkIcon class="h-4 w-4" />
          </button>

          <h3 class="text-xl font-black text-[#05050A] italic uppercase tracking-tighter mb-1">
            Venda registrada
          </h3>
          <p class="text-[10px] text-bip-muted font-bold uppercase tracking-[0.2em] mb-6" data-cy="pdv-receipt-order-reference">
            {{ sale.order_reference }}
          </p>

          <div class="receipt-printable" data-cy="pdv-receipt">
            <ul class="space-y-2">
              <li
                v-for="item in sale.items"
                :key="item.product_id"
                class="flex items-baseline justify-between gap-3 text-sm"
                data-cy="pdv-receipt-item"
              >
                <span class="min-w-0 truncate font-semibold text-[#05050A]">
                  {{ item.quantity }}x {{ item.product_name }}
                </span>
                <span class="shrink-0 font-mono text-[#05050A]">{{ formatBRL(item.line_total) }}</span>
              </li>
            </ul>

            <div class="mt-4 flex items-center justify-between border-t border-dashed border-[#D1D5DB] pt-3 text-sm font-black">
              <span>Total</span>
              <span data-cy="pdv-receipt-total">{{ formatBRL(sale.total) }}</span>
            </div>
            <p class="mt-1 text-xs text-bip-muted">
              Pagamento: {{ getPaymentLabel(sale.payment_method as 'pix' | 'card' | 'cash') }}
            </p>
          </div>

          <div class="flex w-full gap-4 mt-7 no-print">
            <button type="button" class="cancel-button" @click="emit('close')">
              Fechar
            </button>
            <button type="button" data-cy="btn-print-receipt" class="confirm-button" @click="handlePrint">
              <PrinterIcon class="mr-1.5 inline h-4 w-4" />
              Imprimir
            </button>
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
  max-width: 24rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 2rem;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden;
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
}

.close-button:hover {
  background-color: #fafafa;
  color: #05050a;
}

.receipt-printable {
  border: 1px dashed #d1d5db;
  border-radius: 1rem;
  padding: 1.25rem;
}

.cancel-button {
  flex: 1;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  transition: all 0.2s ease;
}

.cancel-button:hover {
  background-color: #fafafa;
}

.confirm-button {
  flex: 1;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  background-color: #d81b60;
  color: white;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: all 0.3s ease;
}

.confirm-button:hover {
  background-color: #ad1457;
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

<style>
/* Unscoped on purpose (see ProductLabelModal.vue): printing needs to hide
   everything in the document outside the receipt, not just inside this
   component's own subtree -- the modal is Teleport-ed to <body>, so the
   rest of the dashboard is a sibling, not a descendant, of any scoped style. */
@media print {
  body * {
    visibility: hidden;
  }

  .receipt-printable,
  .receipt-printable * {
    visibility: visible;
  }

  .receipt-printable {
    position: fixed;
    top: 2rem;
    left: 50%;
    transform: translateX(-50%);
  }

  .no-print {
    display: none !important;
  }
}
</style>
