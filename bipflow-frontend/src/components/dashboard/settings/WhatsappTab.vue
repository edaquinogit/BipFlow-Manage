<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline';
import { useAsyncResource } from '@/composables/useAsyncResource';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import type { StoreSettings, StoreSettingsPayload } from '@/types/store-settings';
import { Logger } from '@/services/logger';
import { storeSettingsService } from '@/services/store-settings.service';

const { canManageCatalog } = useCurrentUser();
const { success, error: toastError } = useToast();

const {
  data: storeSettings,
  isLoading: isStoreSettingsLoading,
  error: storeSettingsError,
  run: runFetchStoreSettings,
} = useAsyncResource<StoreSettings>();
const isSavingStoreSettings = ref(false);
const storeSettingsDraft = ref<StoreSettingsPayload>({ whatsapp_phone: '' });

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

const storeWhatsappDigits = computed(() => normalizePhone(storeSettingsDraft.value.whatsapp_phone));
const storeWhatsappValidationMessage = computed(() => {
  if (!storeSettingsDraft.value.whatsapp_phone.trim()) {
    return '';
  }

  if (storeWhatsappDigits.value.length < 10 || storeWhatsappDigits.value.length > 15) {
    return 'Use código do país e DDD. Ex.: 5571999999999';
  }

  return '';
});
const storeWhatsappTestUrl = computed(() => (
  storeSettings.value?.whatsapp_phone_digits
    ? `https://wa.me/${storeSettings.value.whatsapp_phone_digits}`
    : ''
));
const canSaveStoreSettings = computed(() => (
  !isSavingStoreSettings.value && !isStoreSettingsLoading.value && !storeWhatsappValidationMessage.value
));

async function fetchStoreSettings(): Promise<void> {
  await runFetchStoreSettings(
    () => storeSettingsService.get(),
    'Não foi possível carregar o WhatsApp da loja agora.'
  );
  storeSettingsDraft.value = { whatsapp_phone: storeSettings.value?.whatsapp_phone ?? '' };
}

async function submitStoreSettings(): Promise<void> {
  if (!canSaveStoreSettings.value) {
    return;
  }

  isSavingStoreSettings.value = true;
  try {
    storeSettings.value = await storeSettingsService.update({ whatsapp_phone: storeWhatsappDigits.value });
    success('WhatsApp da loja atualizado.');
  } catch (error: unknown) {
    Logger.error('Store settings save failed', { error });
    toastError('Não foi possível salvar o WhatsApp da loja.');
  } finally {
    isSavingStoreSettings.value = false;
  }
}

onMounted(() => {
  void fetchStoreSettings();
});

useStoreSwitchEffect(() => {
  void fetchStoreSettings();
});
</script>

<template>
  <section class="max-w-md">
    <div v-if="isStoreSettingsLoading" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div class="h-4 w-44 animate-pulse rounded bg-zinc-100" />
      <div class="mt-3 h-3 w-64 animate-pulse rounded bg-zinc-100" />
    </div>

    <div v-else-if="storeSettingsError" class="rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-4 text-sm text-[#7A143D]">
      {{ storeSettingsError }}
    </div>

    <div class="rounded-lg border border-[#E5E7EB] bg-zinc-50 p-3">
      <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Destino atual</p>
      <div class="mt-2 flex items-center justify-between gap-3">
        <p class="min-w-0 truncate text-sm font-bold text-[#05050A]">
          {{ storeSettings?.is_whatsapp_configured ? storeSettings.whatsapp_phone_digits : 'Não configurado' }}
        </p>
        <a
          v-if="storeWhatsappTestUrl"
          :href="storeWhatsappTestUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
          aria-label="Abrir WhatsApp configurado"
        >
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        </a>
      </div>
    </div>

    <form v-if="canManageCatalog" class="mt-4 space-y-4 rounded-lg border border-[#E5E7EB] bg-white p-4" @submit.prevent="submitStoreSettings">
      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">Número da loja</span>
        <input
          v-model="storeSettingsDraft.whatsapp_phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          placeholder="+55 71 99999-9999"
        />
      </label>

      <p v-if="storeWhatsappValidationMessage" class="text-xs font-semibold text-amber-700">
        {{ storeWhatsappValidationMessage }}
      </p>

      <button
        type="submit"
        :disabled="!canSaveStoreSettings"
        class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
      >
        {{ isSavingStoreSettings ? 'Salvando...' : 'Salvar WhatsApp' }}
      </button>
    </form>
  </section>
</template>
