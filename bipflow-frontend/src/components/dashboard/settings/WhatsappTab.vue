<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline';
import { useAsyncResource } from '@/composables/useAsyncResource';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import type { StoreSettings, StoreSettingsPayload } from '@/types/store-settings';
import { Logger } from '@/services/logger';
import { storeSettingsService } from '@/services/store-settings.service';

const { canManageCatalog } = useCurrentUser();
const { selectedStore } = useCurrentStore();
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
    return 'Use codigo do pais e DDD. Ex.: 5571999999999';
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
    'Nao foi possivel carregar o WhatsApp da loja agora.'
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
    toastError('Nao foi possivel salvar o WhatsApp da loja.');
  } finally {
    isSavingStoreSettings.value = false;
  }
}

onMounted(() => {
  void fetchStoreSettings();
});

watch(selectedStore, () => {
  void fetchStoreSettings();
});
</script>

<template>
  <section class="max-w-md">
    <div v-if="isStoreSettingsLoading" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div class="h-4 w-44 animate-pulse rounded bg-zinc-800" />
      <div class="mt-3 h-3 w-64 animate-pulse rounded bg-zinc-800" />
    </div>

    <div v-else-if="storeSettingsError" class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
      {{ storeSettingsError }}
    </div>

    <div class="rounded-lg border border-white/10 bg-zinc-950 p-3">
      <p class="text-[10px] font-black uppercase tracking-widest text-zinc-500">Destino atual</p>
      <div class="mt-2 flex items-center justify-between gap-3">
        <p class="min-w-0 truncate text-sm font-bold text-white">
          {{ storeSettings?.is_whatsapp_configured ? storeSettings.whatsapp_phone_digits : 'Nao configurado' }}
        </p>
        <a
          v-if="storeWhatsappTestUrl"
          :href="storeWhatsappTestUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400/15"
          aria-label="Abrir WhatsApp configurado"
        >
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
        </a>
      </div>
    </div>

    <form v-if="canManageCatalog" class="mt-4 space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="submitStoreSettings">
      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Numero da loja</span>
        <input
          v-model="storeSettingsDraft.whatsapp_phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          placeholder="+55 71 99999-9999"
        />
      </label>

      <p v-if="storeWhatsappValidationMessage" class="text-xs font-semibold text-amber-200">
        {{ storeWhatsappValidationMessage }}
      </p>

      <button
        type="submit"
        :disabled="!canSaveStoreSettings"
        class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {{ isSavingStoreSettings ? 'Salvando...' : 'Salvar WhatsApp' }}
      </button>
    </form>
  </section>
</template>
