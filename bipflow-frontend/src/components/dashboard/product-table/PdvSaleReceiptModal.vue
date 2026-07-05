<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { ArrowDownTrayIcon, EnvelopeIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { ReceiptData } from '@/types/receipt';
import { getPaymentLabel } from '@/constants/saleOrder';
import { formatBRL, formatDateTimeBR, formatWhatsAppPhone } from '@/utils/formatters';
import { useDialogA11y } from '@/composables/useDialogA11y';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { buildReceiptPdf } from '@/utils/receiptPdf';
import { Logger } from '@/services/logger';

/**
 * Etapa R2 of the QR-code stock-exit refinement (see
 * docs/architecture/qrcode-stock-exit-refinement.md): a receipt/confirmation
 * screen after a PDV sale finalizes -- until now the only feedback was a
 * toast that disappears in a few seconds, with no itemized record on
 * screen for the cashier (or the customer) to check.
 *
 * PDV receipt refinement (store name/date/exchange-policy/paper-format):
 * `sale.order_reference` used to render outside `.receipt-printable`, so
 * the printed receipt never actually showed which order it was -- fixed by
 * moving it inside. Store info comes from `useCurrentStore()` (already a
 * reactive singleton fed by StoreSerializer), not a prop, since this modal
 * only ever renders for the currently active store's own PDV.
 */
const props = defineProps<{
  show: boolean;
  sale: ReceiptData | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

useDialogA11y(toRef(props, 'show'), () => emit('close'), containerRef, closeButtonRef);

const { selectedStore } = useCurrentStore();

const paperFormatClass = computed(() => (
  `format-${selectedStore.value?.receipt_paper_format ?? '80mm'}`
));

const handlePrint = (): void => {
  window.print();
};

const handleDownloadPdf = (): void => {
  if (!props.sale) {
    return;
  }
  buildReceiptPdf(props.sale, selectedStore.value).save(`recibo-${props.sale.order_reference}.pdf`);
};

/**
 * Envio por e-mail via Gmail: em vez de depender do backend enviar o
 * e-mail (bipdelivery/api/pdv.py's PdvReceiptEmailView, que exige um SMTP
 * de verdade configurado -- muitas lojas pequenas não têm um e-mail
 * transacional próprio), "Enviar" baixa o PDF do recibo e abre uma janela
 * de composição do Gmail já preenchida com destinatário/assunto/corpo. O
 * navegador não permite anexar um arquivo automaticamente por segurança,
 * então o corpo do e-mail já orienta o lojista a anexar o PDF baixado.
 */
const isEmailFormOpen = ref(false);
const emailDraft = ref('');
const emailError = ref<string | null>(null);
const emailSentMessage = ref<string | null>(null);

const openEmailForm = (): void => {
  emailDraft.value = props.sale?.customer_email ?? '';
  emailError.value = null;
  emailSentMessage.value = null;
  isEmailFormOpen.value = true;
};

const closeEmailForm = (): void => {
  isEmailFormOpen.value = false;
  emailError.value = null;
};

const handleSendEmail = (): void => {
  const sale = props.sale;
  if (!sale) {
    return;
  }

  const email = emailDraft.value.trim();
  if (!email) {
    emailError.value = 'Informe um e-mail.';
    return;
  }

  emailError.value = null;

  try {
    buildReceiptPdf(sale, selectedStore.value).save(`recibo-${sale.order_reference}.pdf`);

    const subject = `Recibo da compra ${sale.order_reference}`;
    const body =
      `Olá! Segue o recibo da sua compra ${sale.order_reference}.\n\n` +
      'O arquivo PDF do recibo acabou de ser baixado neste computador -- anexe-o a este e-mail antes de enviar.';
    const gmailComposeUrl =
      'https://mail.google.com/mail/?view=cm&fs=1' +
      `&to=${encodeURIComponent(email)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(gmailComposeUrl, '_blank', 'noopener,noreferrer');

    emailSentMessage.value = `PDF baixado. Anexe-o na aba do Gmail que abrimos para ${email} e envie por lá.`;
    isEmailFormOpen.value = false;
  } catch (error: unknown) {
    Logger.error('Failed to prepare PDV receipt email via Gmail', {
      error,
      orderReference: sale.order_reference,
    });
    emailError.value = 'Não foi possível preparar o recibo para envio. Tente novamente.';
  }
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
          <p class="text-[10px] text-bip-muted font-bold uppercase tracking-[0.2em] mb-6 no-print">
            {{ sale.order_reference }}
          </p>

          <div class="receipt-printable" :class="paperFormatClass" data-cy="pdv-receipt">
            <div v-if="selectedStore" class="mb-1 text-center">
              <p class="text-sm font-black uppercase text-[#05050A]">{{ selectedStore.name }}</p>
              <p v-if="selectedStore.whatsapp_phone" class="text-[10px] text-bip-muted">
                {{ formatWhatsAppPhone(selectedStore.whatsapp_phone) }}
              </p>
            </div>
            <p class="mb-2 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-bip-muted">
              Cupom não fiscal
            </p>

            <div class="mb-2 flex items-center justify-between text-[11px] text-bip-muted">
              <span data-cy="pdv-receipt-order-reference">{{ sale.order_reference }}</span>
              <span>{{ formatDateTimeBR(sale.created_at) }}</span>
            </div>

            <ul class="space-y-2 border-t border-dashed border-[#D1D5DB] pt-2">
              <li
                v-for="(item, index) in sale.items"
                :key="item.product_id ?? index"
                class="flex items-baseline justify-between gap-3 text-sm"
                data-cy="pdv-receipt-item"
              >
                <span class="min-w-0">
                  <span class="block truncate font-semibold text-[#05050A]">
                    {{ item.quantity }}x {{ item.product_name }}
                  </span>
                  <span class="block text-[10px] text-bip-muted">
                    {{ formatBRL(item.unit_price) }} cada
                  </span>
                </span>
                <span class="shrink-0 font-mono text-[#05050A]">{{ formatBRL(item.line_total) }}</span>
              </li>
            </ul>

            <div class="mt-4 flex items-center justify-between border-t border-dashed border-[#D1D5DB] pt-3 text-sm font-black">
              <span>Total</span>
              <span data-cy="pdv-receipt-total" class="font-mono">{{ formatBRL(sale.total) }}</span>
            </div>
            <p class="mt-1 text-xs text-bip-muted">
              Pagamento: {{ getPaymentLabel(sale.payment_method as 'pix' | 'card' | 'cash') }}
            </p>

            <p
              v-if="selectedStore?.receipt_exchange_policy"
              data-cy="pdv-receipt-exchange-policy"
              class="mt-4 border-t border-dashed border-[#D1D5DB] pt-3 text-center text-[10px] leading-4 text-bip-muted"
            >
              {{ selectedStore.receipt_exchange_policy }}
            </p>

            <p class="mt-3 text-center text-[10px] font-bold text-bip-muted">
              Obrigado pela preferência!
            </p>
          </div>

          <div class="flex w-full flex-wrap gap-3 mt-7 no-print">
            <button type="button" class="cancel-button" @click="emit('close')">
              Fechar
            </button>
            <button
              type="button"
              data-cy="btn-download-receipt-pdf"
              class="cancel-button"
              @click="handleDownloadPdf"
            >
              <ArrowDownTrayIcon class="mr-1.5 inline h-4 w-4" />
              Baixar PDF
            </button>
            <button
              type="button"
              data-cy="btn-open-receipt-email"
              class="cancel-button"
              @click="openEmailForm"
            >
              <EnvelopeIcon class="mr-1.5 inline h-4 w-4" />
              Enviar por e-mail
            </button>
            <button type="button" data-cy="btn-print-receipt" class="confirm-button" @click="handlePrint">
              <PrinterIcon class="mr-1.5 inline h-4 w-4" />
              Imprimir
            </button>
          </div>

          <div v-if="isEmailFormOpen" class="mt-4 w-full space-y-2 no-print">
            <label class="block">
              <span class="mb-1 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
                E-mail do cliente
              </span>
              <input
                v-model="emailDraft"
                type="email"
                data-cy="receipt-email-input"
                class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                placeholder="cliente@exemplo.com"
              />
            </label>
            <p class="text-[10px] text-bip-muted">
              Ao enviar, o PDF do recibo é baixado e o Gmail abre em outra aba já preenchido --
              é só anexar o arquivo baixado e enviar.
            </p>
            <p v-if="emailError" data-cy="receipt-email-error" class="text-xs font-semibold text-[#D81B60]">
              {{ emailError }}
            </p>
            <div class="flex gap-3">
              <button type="button" class="cancel-button" @click="closeEmailForm">
                Cancelar
              </button>
              <button
                type="button"
                data-cy="btn-send-receipt-email"
                class="confirm-button"
                @click="handleSendEmail"
              >
                Enviar
              </button>
            </div>
          </div>

          <p
            v-if="emailSentMessage"
            data-cy="receipt-email-sent"
            class="mt-3 text-center text-xs font-semibold text-emerald-700 no-print"
          >
            {{ emailSentMessage }}
          </p>
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

  /* PDV receipt print-format presets (store-configurable, see
     ReceiptSettingsTab.vue): the two dominant thermal receipt-roll widths
     in Brazilian retail, plus a plain-sheet width for a regular printer. */
  .receipt-printable.format-58mm {
    width: 58mm;
  }

  .receipt-printable.format-80mm {
    width: 80mm;
  }

  .receipt-printable.format-a4 {
    width: 190mm;
  }

  .no-print {
    display: none !important;
  }
}
</style>
