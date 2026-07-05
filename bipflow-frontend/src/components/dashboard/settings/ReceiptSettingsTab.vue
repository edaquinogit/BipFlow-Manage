<script setup lang="ts">
import { ref, watch } from 'vue';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import { storeService } from '@/services/store.service';
import type { ReceiptPaperFormat } from '@/types/store';

/**
 * PDV receipt settings: the exchange/return policy text and the print
 * paper-format preset (58mm/80mm thermal roll or A4 sheet) shown on the
 * receipt PdvSaleReceiptModal.vue prints after a PDV sale. Follows
 * StoresTab.vue's pattern (edits Store fields directly via
 * storeService/useCurrentStore), not WhatsappTab.vue's -- these are real
 * per-store fields, not a bridge to the legacy StoreSettings singleton.
 */
const PAPER_FORMAT_OPTIONS: { value: ReceiptPaperFormat; label: string }[] = [
  { value: '58mm', label: 'Bobina 58mm (térmica)' },
  { value: '80mm', label: 'Bobina 80mm (térmica)' },
  { value: 'a4', label: 'Folha A4' },
];

const { selectedStore, fetchCurrentStore } = useCurrentStore();
const { success, error: toastError } = useToast();

const exchangePolicyDraft = ref(selectedStore.value?.receipt_exchange_policy ?? '');
const paperFormatDraft = ref<ReceiptPaperFormat>(selectedStore.value?.receipt_paper_format ?? '80mm');
const isSaving = ref(false);
const saveError = ref<string | null>(null);

watch(selectedStore, (store) => {
  exchangePolicyDraft.value = store?.receipt_exchange_policy ?? '';
  paperFormatDraft.value = store?.receipt_paper_format ?? '80mm';
});

async function handleSave(): Promise<void> {
  const store = selectedStore.value;
  if (!store || isSaving.value) {
    return;
  }

  isSaving.value = true;
  saveError.value = null;

  try {
    await storeService.updateReceiptSettings(store.slug, {
      receipt_exchange_policy: exchangePolicyDraft.value,
      receipt_paper_format: paperFormatDraft.value,
    });
    await fetchCurrentStore(true);
    success('Configurações de recibo atualizadas.');
  } catch (error: unknown) {
    Logger.error('Store receipt settings save failed', { error, slug: store.slug });
    saveError.value = 'Não foi possível salvar as configurações de recibo. Tente novamente.';
    toastError('Não foi possível salvar as configurações de recibo.');
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <section class="max-w-md space-y-6">
    <div>
      <p class="text-xs leading-5 text-bip-muted">
        Essas informações aparecem no comprovante impresso ao finalizar uma venda no PDV.
      </p>

      <form
        class="mt-4 space-y-4 rounded-lg border border-[#E5E7EB] bg-white p-4"
        @submit.prevent="handleSave"
      >
        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
            Política de troca
          </span>
          <textarea
            v-model="exchangePolicyDraft"
            data-cy="receipt-exchange-policy-input"
            rows="3"
            maxlength="280"
            class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="Ex.: Trocas e devoluções em até 7 dias mediante apresentação deste comprovante."
          />
          <span class="mt-1 block text-[10px] text-bip-muted">
            Deixe em branco para não mostrar nenhuma política no recibo.
          </span>
        </label>

        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
            Formato de impressão
          </span>
          <select
            v-model="paperFormatDraft"
            data-cy="receipt-paper-format-select"
            class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          >
            <option v-for="option in PAPER_FORMAT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <p v-if="saveError" data-cy="receipt-settings-error" class="text-xs font-semibold text-[#D81B60]">
          {{ saveError }}
        </p>

        <button
          type="submit"
          data-cy="btn-save-receipt-settings"
          :disabled="isSaving || !selectedStore"
          class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
        >
          {{ isSaving ? 'Salvando...' : 'Salvar configurações de recibo' }}
        </button>
      </form>
    </div>
  </section>
</template>
