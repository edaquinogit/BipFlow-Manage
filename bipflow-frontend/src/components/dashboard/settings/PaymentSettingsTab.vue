<script setup lang="ts">
import { ref, watch } from 'vue'
import { CreditCardIcon, LinkIcon, QrCodeIcon } from '@heroicons/vue/24/outline'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useToast } from '@/composables/useToast'
import { storeService } from '@/services/store.service'
import { Logger } from '@/services/logger'
import { buildErrorContext, type ApplicationError } from '@/types/errors'
import { DEFAULT_STORE_PAYMENT_SETTINGS } from '@/utils/paymentInstallments'

const { selectedStore } = useCurrentStore()
const { success, error: toastError } = useToast()

const pixLinkDraft = ref(DEFAULT_STORE_PAYMENT_SETTINGS.payment_pix_link_url)
const cardLinkDraft = ref(DEFAULT_STORE_PAYMENT_SETTINGS.payment_card_link_url)
const cardMaxInstallmentsDraft = ref(DEFAULT_STORE_PAYMENT_SETTINGS.card_max_installments)
const cardMonthlyInterestRateDraft = ref(DEFAULT_STORE_PAYMENT_SETTINGS.card_monthly_interest_rate)
const cardMinInstallmentAmountDraft = ref(DEFAULT_STORE_PAYMENT_SETTINGS.card_min_installment_amount)
const isLoading = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

function resetDrafts(): void {
  pixLinkDraft.value = DEFAULT_STORE_PAYMENT_SETTINGS.payment_pix_link_url
  cardLinkDraft.value = DEFAULT_STORE_PAYMENT_SETTINGS.payment_card_link_url
  cardMaxInstallmentsDraft.value = DEFAULT_STORE_PAYMENT_SETTINGS.card_max_installments
  cardMonthlyInterestRateDraft.value = DEFAULT_STORE_PAYMENT_SETTINGS.card_monthly_interest_rate
  cardMinInstallmentAmountDraft.value = DEFAULT_STORE_PAYMENT_SETTINGS.card_min_installment_amount
}

async function loadPaymentSettings(slug: string): Promise<void> {
  isLoading.value = true
  saveError.value = null

  try {
    const settings = await storeService.getPaymentSettings(slug)
    pixLinkDraft.value = settings.payment_pix_link_url
    cardLinkDraft.value = settings.payment_card_link_url
    cardMaxInstallmentsDraft.value = settings.card_max_installments
    cardMonthlyInterestRateDraft.value = settings.card_monthly_interest_rate
    cardMinInstallmentAmountDraft.value = settings.card_min_installment_amount
  } catch (error: unknown) {
    Logger.error('Store payment settings load failed', buildErrorContext(error as ApplicationError, { slug }))
    saveError.value = 'Nao foi possivel carregar as configuracoes de pagamento.'
  } finally {
    isLoading.value = false
  }
}

watch(
  selectedStore,
  (store) => {
    if (!store) {
      resetDrafts()
      return
    }

    void loadPaymentSettings(store.slug)
  },
  { immediate: true },
)

async function handleSave(): Promise<void> {
  const store = selectedStore.value
  if (!store || isSaving.value) {
    return
  }

  isSaving.value = true
  saveError.value = null

  try {
    await storeService.updatePaymentSettings(store.slug, {
      payment_pix_link_url: pixLinkDraft.value.trim(),
      payment_card_link_url: cardLinkDraft.value.trim(),
      card_max_installments: Number(cardMaxInstallmentsDraft.value),
      card_monthly_interest_rate: String(cardMonthlyInterestRateDraft.value).trim(),
      card_min_installment_amount: String(cardMinInstallmentAmountDraft.value).trim(),
    })
    success('Configuracoes de pagamento atualizadas.')
  } catch (error: unknown) {
    Logger.error('Store payment settings save failed', buildErrorContext(error as ApplicationError, { slug: store.slug }))
    saveError.value = 'Nao foi possivel salvar as configuracoes de pagamento.'
    toastError('Nao foi possivel salvar as configuracoes de pagamento.')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="max-w-2xl space-y-6">
    <form
      class="space-y-5 rounded-lg border border-[#E5E7EB] bg-white p-4"
      @submit.prevent="handleSave"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <label class="block">
          <span class="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-bip-muted">
            <QrCodeIcon class="h-4 w-4" />
            Link Pix
          </span>
          <input
            v-model="pixLinkDraft"
            data-cy="payment-pix-link-input"
            type="url"
            inputmode="url"
            class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="https://..."
          />
        </label>

        <label class="block">
          <span class="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-bip-muted">
            <CreditCardIcon class="h-4 w-4" />
            Link Cartao
          </span>
          <input
            v-model="cardLinkDraft"
            data-cy="payment-card-link-input"
            type="url"
            inputmode="url"
            class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="https://..."
          />
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
            Max. parcelas
          </span>
          <input
            v-model.number="cardMaxInstallmentsDraft"
            data-cy="payment-card-max-installments-input"
            type="number"
            min="1"
            max="24"
            step="1"
            class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          />
        </label>

        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
            Juros mensal %
          </span>
          <input
            v-model="cardMonthlyInterestRateDraft"
            data-cy="payment-card-interest-input"
            type="number"
            min="0"
            max="30"
            step="0.01"
            class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          />
        </label>

        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
            Parcela minima
          </span>
          <input
            v-model="cardMinInstallmentAmountDraft"
            data-cy="payment-card-min-installment-input"
            type="number"
            min="1"
            step="0.01"
            class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          />
        </label>
      </div>

      <div class="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold leading-5 text-sky-900">
        <LinkIcon class="mr-1 inline h-4 w-4 align-text-bottom" />
        O BipFlow salva links e referencias. Dados do cartao ficam no gateway da maquininha.
      </div>

      <p v-if="saveError" data-cy="payment-settings-error" class="text-xs font-semibold text-[#D81B60]">
        {{ saveError }}
      </p>

      <button
        type="submit"
        data-cy="btn-save-payment-settings"
        :disabled="isLoading || isSaving || !selectedStore"
        class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
      >
        {{ isSaving ? 'Salvando...' : 'Salvar pagamentos' }}
      </button>
    </form>
  </section>
</template>
