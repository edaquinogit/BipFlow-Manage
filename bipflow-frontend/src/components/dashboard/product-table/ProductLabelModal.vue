<script setup lang="ts">
import { ref, toRef, watch } from 'vue';
import { PrinterIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { Product } from '@/schemas/product.schema';
import type { ProductQrCode } from '@/types/productLabel';
import ProductService from '@/services/product.service';
import { Logger } from '@/services/logger';
import { buildErrorContext, type ApplicationError } from '@/types/errors';
import { formatBRL } from '@/utils/formatters';
import { useDialogA11y } from '@/composables/useDialogA11y';

/**
 * Etapa 2 of the QR-code stock-exit evolution (see
 * docs/architecture/qrcode-stock-exit-evolution.md): renders the printable
 * label (name, price, code, QR image) for a single product. The QR image
 * itself is rendered server-side (GET /v1/products/{id}/qr-code/) as a data
 * URI, so this component only needs an <img>, no client-side QR library.
 */
const props = defineProps<{
  show: boolean;
  product: Product | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

useDialogA11y(toRef(props, 'show'), () => emit('close'), containerRef, closeButtonRef);

const isLoading = ref(false);
const loadError = ref<string | null>(null);
const label = ref<ProductQrCode | null>(null);

const loadLabel = async (): Promise<void> => {
  if (!props.product?.id) {
    return;
  }

  isLoading.value = true;
  loadError.value = null;
  label.value = null;

  try {
    label.value = await ProductService.getQrCode(props.product.id);
  } catch (error: unknown) {
    loadError.value = 'Não foi possível gerar o QR Code deste produto.';
    Logger.error('Failed to load product QR code', buildErrorContext(error as ApplicationError, { productId: props.product.id }));
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      void loadLabel();
    }
  },
  { immediate: true }
);

const handlePrint = (): void => {
  window.print();
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
          aria-label="Etiqueta do produto"
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
            Etiqueta do produto
          </h3>
          <p class="text-[10px] text-bip-muted font-bold uppercase tracking-[0.2em] mb-6">
            {{ product?.name }}
          </p>

          <div v-if="isLoading" class="flex justify-center py-10" data-cy="qr-label-loading">
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-[#D81B60]/30 border-t-[#D81B60]" />
          </div>

          <p v-else-if="loadError" data-cy="qr-label-error" class="py-6 text-center text-xs font-bold text-[#D81B60]">
            {{ loadError }}
          </p>

          <div v-else-if="label" class="qr-printable-label" data-cy="qr-printable-label">
            <p class="label-name">{{ product?.name }}</p>
            <p v-if="product?.price" class="label-price">{{ formatBRL(product.price) }}</p>
            <p v-if="product?.size" class="label-size" data-cy="qr-label-size">Tamanho: {{ product.size }}</p>
            <img :src="label.qr_code" alt="QR Code do produto" class="label-qr" data-cy="qr-label-image" />
            <p class="label-code">{{ label.public_code }}</p>
          </div>

          <div class="flex w-full gap-4 mt-7 no-print">
            <button type="button" class="cancel-button" @click="emit('close')">
              Fechar
            </button>
            <button
              type="button"
              data-cy="btn-print-label"
              :disabled="!label"
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

.qr-printable-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  border: 1px dashed #d1d5db;
  border-radius: 1rem;
  padding: 1.5rem;
  text-align: center;
}

.label-name {
  font-size: 0.875rem;
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
  height: 10rem;
  width: 10rem;
}

.label-code {
  font-family: monospace;
  font-size: 0.75rem;
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
/* Unscoped on purpose: printing needs to hide everything in the document
   outside the label, not just inside this component's own subtree (the
   modal is Teleport-ed to <body>, so the rest of the dashboard is a sibling,
   not a descendant, of anything scoped styles could reach). */
@media print {
  body * {
    visibility: hidden;
  }

  .qr-printable-label,
  .qr-printable-label * {
    visibility: visible;
  }

  .qr-printable-label {
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
