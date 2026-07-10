<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { ArrowDownTrayIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { ProductBulkLabel } from '@/types/productLabel';
import ProductService from '@/services/product.service';
import { Logger } from '@/services/logger';
import { formatBRL } from '@/utils/formatters';
import { useDialogA11y } from '@/composables/useDialogA11y';
import { buildProductLabelsPdf } from '@/utils/productLabelsPdf';

/**
 * Etapa 6 of the QR-code stock-exit evolution (see
 * docs/architecture/qrcode-stock-exit-evolution.md): batch label printing,
 * the action Etapa 2 explicitly deferred. Mirrors ProductLabelModal.vue's
 * single-product print flow (same Teleport/useDialogA11y/print-CSS pattern)
 * and PdvSaleReceiptModal.vue's print-or-download button pair, but renders
 * a grid of labels instead of one.
 *
 * `productIds` is a snapshot the parent takes at open time (not resolved
 * from the currently-loaded product list) -- a selected id can be absent
 * from `products.value` if a filter changed after selecting it, so this
 * modal always resolves labels straight from the backend by id, which
 * embeds name/price/size in its response for exactly that reason.
 */
const props = defineProps<{
  show: boolean;
  productIds: number[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

useDialogA11y(toRef(props, 'show'), () => emit('close'), containerRef, closeButtonRef);

const isLoading = ref(false);
const loadError = ref<string | null>(null);
const labels = ref<ProductBulkLabel[]>([]);
const missingIds = ref<number[]>([]);

const hasLabels = computed(() => labels.value.length > 0);

const loadLabels = async (): Promise<void> => {
  if (props.productIds.length === 0) {
    return;
  }

  isLoading.value = true;
  loadError.value = null;
  labels.value = [];
  missingIds.value = [];

  try {
    const response = await ProductService.getQrCodesBulk(props.productIds);
    labels.value = response.labels;
    missingIds.value = response.missing_ids;
  } catch (error: unknown) {
    loadError.value = 'Não foi possível gerar as etiquetas dos produtos selecionados.';
    Logger.error('Failed to load bulk product QR labels', {
      error,
      productIds: props.productIds,
    });
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      void loadLabels();
    }
  },
  { immediate: true }
);

const handlePrint = (): void => {
  window.print();
};

const handleDownloadPdf = (): void => {
  if (!hasLabels.value) {
    return;
  }
  buildProductLabelsPdf(labels.value).save('etiquetas-produtos.pdf');
};
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay no-print">
        <div
          ref="containerRef"
          class="modal-container"
          role="dialog"
          aria-modal="true"
          aria-label="Etiquetas dos produtos selecionados"
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
            Etiquetas selecionadas
          </h3>
          <p class="text-[10px] text-bip-muted font-bold uppercase tracking-[0.2em] mb-6 no-print">
            {{ productIds.length }} produto{{ productIds.length === 1 ? '' : 's' }} selecionado{{ productIds.length === 1 ? '' : 's' }}
          </p>

          <div v-if="isLoading" class="flex justify-center py-10 no-print" data-cy="qr-bulk-labels-loading">
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-[#D81B60]/30 border-t-[#D81B60]" />
          </div>

          <p v-else-if="loadError" data-cy="qr-bulk-labels-error" class="py-6 text-center text-xs font-bold text-[#D81B60] no-print">
            {{ loadError }}
          </p>

          <template v-else>
            <p
              v-if="missingIds.length > 0"
              data-cy="qr-bulk-missing-warning"
              class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 no-print"
            >
              {{ missingIds.length }} produto{{ missingIds.length === 1 ? '' : 's' }} selecionado{{ missingIds.length === 1 ? '' : 's' }}
              não {{ missingIds.length === 1 ? 'foi encontrado' : 'foram encontrados' }} e não
              {{ missingIds.length === 1 ? 'aparece' : 'aparecem' }} nas etiquetas.
            </p>

            <p v-if="!hasLabels" data-cy="qr-bulk-labels-empty" class="py-6 text-center text-xs font-bold text-bip-muted no-print">
              Nenhuma etiqueta para exibir.
            </p>

            <div v-else class="qr-bulk-printable-grid" data-cy="qr-bulk-labels-grid">
              <div
                v-for="label in labels"
                :key="label.id"
                class="qr-label-card"
                data-cy="qr-bulk-label-card"
              >
                <p class="label-name">{{ label.name }}</p>
                <p class="label-price">{{ formatBRL(label.price) }}</p>
                <p v-if="label.size" class="label-size" data-cy="qr-bulk-label-size">Tamanho: {{ label.size }}</p>
                <img :src="label.qr_code" alt="QR Code do produto" class="label-qr" data-cy="qr-bulk-label-image" />
                <p class="label-code">{{ label.public_code }}</p>
              </div>
            </div>
          </template>

          <div class="flex w-full flex-wrap gap-3 mt-7 no-print">
            <button type="button" class="cancel-button" @click="emit('close')">
              Fechar
            </button>
            <button
              type="button"
              data-cy="btn-download-labels-pdf"
              :disabled="!hasLabels"
              class="cancel-button"
              @click="handleDownloadPdf"
            >
              <ArrowDownTrayIcon class="mr-1.5 inline h-4 w-4" />
              Baixar PDF
            </button>
            <button
              type="button"
              data-cy="btn-print-labels"
              :disabled="!hasLabels"
              class="confirm-button"
              @click="handlePrint"
            >
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
  max-width: 48rem;
  max-height: min(85vh, 48rem);
  overflow-y: auto;
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
}

.close-button:hover {
  background-color: #fafafa;
  color: #05050a;
}

/* auto-fill/minmax reflows from 1 column on a narrow phone up to 3-4 on
   desktop without a manual breakpoint list -- same responsive philosophy
   TableRow.vue/TableRowCard.vue already express structurally via their
   own desktop/mobile split. */
.qr-bulk-printable-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.qr-label-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  border: 1px dashed #d1d5db;
  border-radius: 1rem;
  padding: 1.25rem 1rem;
  text-align: center;
}

.label-name {
  font-size: 0.8rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #05050a;
}

.label-price {
  font-family: monospace;
  font-weight: 900;
  color: #d81b60;
}

.label-size {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
}

.label-qr {
  height: 8rem;
  width: 8rem;
}

.label-code {
  font-family: monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #6b7280;
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

.cancel-button:hover:not(:disabled) {
  background-color: #fafafa;
}

.cancel-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.confirm-button:hover:not(:disabled) {
  background-color: #ad1457;
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
   everything in the document outside the grid, not just inside this
   component's own subtree -- the modal is Teleport-ed to <body>, so the
   rest of the dashboard is a sibling, not a descendant, of any scoped
   style here. Print forces a FIXED 2-column grid (unlike the on-screen
   auto-fill/minmax reflow): the screen preview should adapt to whatever
   viewport it's in, but a physical page has one fixed width, so the two
   stylesheets deliberately diverge here. */
@media print {
  body * {
    visibility: hidden;
  }

  .qr-bulk-printable-grid,
  .qr-bulk-printable-grid * {
    visibility: visible;
  }

  .qr-bulk-printable-grid {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5cm;
    padding: 1cm;
  }

  .qr-label-card {
    break-inside: avoid;
  }

  .no-print {
    display: none !important;
  }
}
</style>
