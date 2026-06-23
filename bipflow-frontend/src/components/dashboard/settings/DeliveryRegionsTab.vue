<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { PencilSquareIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useAsyncResource } from '@/composables/useAsyncResource';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import type { DeliveryRegion, DeliveryRegionPayload } from '@/types/delivery';
import { deliveryRegionService } from '@/services/delivery-region.service';
import { Logger } from '@/services/logger';
import { formatBRL } from '@/utils/formatters';

const { canManageCatalog } = useCurrentUser();
const { success, error: toastError } = useToast();

const {
  data: deliveryRegionsData,
  isLoading: isDeliveryRegionsLoading,
  error: deliveryRegionsError,
  run: runFetchDeliveryRegions,
} = useAsyncResource<DeliveryRegion[]>();
const deliveryRegions = computed(() => deliveryRegionsData.value ?? []);

const isSavingDeliveryRegion = ref(false);
const deletingDeliveryRegionId = ref<number | null>(null);
const editingRegionId = ref<number | null>(null);
const regionDraft = ref<DeliveryRegionPayload>({
  name: '',
  city: '',
  neighborhoods: '',
  delivery_fee: '',
  is_active: true,
});

function resetRegionDraft(): void {
  editingRegionId.value = null;
  regionDraft.value = { name: '', city: '', neighborhoods: '', delivery_fee: '', is_active: true };
}

function fetchDeliveryRegions(): Promise<void> {
  return runFetchDeliveryRegions(
    () => deliveryRegionService.getAll(),
    'Nao foi possivel carregar as regioes de frete agora.'
  );
}

function editDeliveryRegion(region: DeliveryRegion): void {
  editingRegionId.value = region.id;
  regionDraft.value = {
    name: region.name,
    city: region.city,
    neighborhoods: region.neighborhoods,
    delivery_fee: String(region.delivery_fee),
    is_active: region.is_active,
  };
}

async function submitDeliveryRegion(): Promise<void> {
  const deliveryFee = Number(regionDraft.value.delivery_fee);
  if (!regionDraft.value.name.trim() || !Number.isFinite(deliveryFee) || deliveryFee < 0) {
    return;
  }

  isSavingDeliveryRegion.value = true;
  const payload: DeliveryRegionPayload = {
    name: regionDraft.value.name.trim(),
    city: regionDraft.value.city.trim(),
    neighborhoods: regionDraft.value.neighborhoods.trim(),
    delivery_fee: deliveryFee.toFixed(2),
    is_active: regionDraft.value.is_active,
  };

  try {
    if (editingRegionId.value) {
      await deliveryRegionService.update(editingRegionId.value, payload);
      success('Frete da regiao atualizado.');
    } else {
      await deliveryRegionService.create(payload);
      success('Regiao de frete adicionada.');
    }

    resetRegionDraft();
    await fetchDeliveryRegions();
  } catch (error: unknown) {
    Logger.error('Delivery region save failed', { error, regionId: editingRegionId.value });
    toastError('Nao foi possivel salvar a regiao de frete.');
  } finally {
    isSavingDeliveryRegion.value = false;
  }
}

async function handleDeleteDeliveryRegion(regionId: number): Promise<void> {
  deletingDeliveryRegionId.value = regionId;
  try {
    await deliveryRegionService.delete(regionId);
    success('Regiao de frete removida.');
    await fetchDeliveryRegions();
  } catch (error: unknown) {
    Logger.error('Delivery region deletion failed', { error, regionId });
    toastError('Nao foi possivel remover a regiao de frete.');
  } finally {
    deletingDeliveryRegionId.value = null;
  }
}

onMounted(() => {
  void fetchDeliveryRegions();
});

useStoreSwitchEffect(() => {
  void fetchDeliveryRegions();
});
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
    <form v-if="canManageCatalog" class="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="submitDeliveryRegion">
      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Regiao</span>
        <input
          v-model="regionDraft.name"
          type="text"
          class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
          placeholder="Centro, Zona Norte..."
        />
      </label>

      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Cidade</span>
          <input
            v-model="regionDraft.city"
            type="text"
            class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
            placeholder="Salvador"
          />
        </label>

        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Valor</span>
          <input
            v-model="regionDraft.delivery_fee"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
            placeholder="12.00"
          />
        </label>
      </div>

      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Bairros atendidos</span>
        <textarea
          v-model="regionDraft.neighborhoods"
          rows="3"
          class="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
          placeholder="Opcional: Centro, Barra, Ondina"
        />
      </label>

      <label class="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2">
        <span class="text-xs font-bold text-zinc-300">Regiao ativa na vitrine</span>
        <input v-model="regionDraft.is_active" type="checkbox" class="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-rose-500 focus:ring-rose-500/30" />
      </label>

      <button
        type="submit"
        :disabled="isSavingDeliveryRegion"
        class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {{ isSavingDeliveryRegion ? 'Salvando...' : editingRegionId ? 'Salvar regiao' : 'Adicionar regiao' }}
      </button>
    </form>

    <div class="space-y-3">
      <div v-if="isDeliveryRegionsLoading" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div class="h-4 w-40 animate-pulse rounded bg-zinc-800" />
        <div class="mt-3 h-3 w-56 animate-pulse rounded bg-zinc-800" />
      </div>

      <div v-else-if="deliveryRegionsError" class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        {{ deliveryRegionsError }}
      </div>

      <div v-else-if="deliveryRegions.length === 0" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p class="text-sm font-semibold text-white">Nenhuma regiao cadastrada.</p>
        <p class="mt-1 text-xs leading-5 text-zinc-500">Cadastre regioes para precificar o frete no carrinho publico.</p>
      </div>

      <article v-for="region in deliveryRegions" :key="region.id" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-white">{{ region.name }}</p>
            <p class="mt-1 text-xs text-zinc-500">
              {{ region.city || 'Cidade nao informada' }} - {{ region.is_active ? 'Ativa' : 'Inativa' }}
            </p>
          </div>
          <p class="shrink-0 text-sm font-black text-rose-300">{{ formatBRL(region.delivery_fee) }}</p>
        </div>

        <p v-if="region.neighborhoods" class="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">{{ region.neighborhoods }}</p>

        <div v-if="canManageCatalog" class="mt-4 flex gap-2">
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-white/20 hover:text-white"
            @click="editDeliveryRegion(region)"
          >
            <PencilSquareIcon class="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="deletingDeliveryRegionId === region.id"
            @click="handleDeleteDeliveryRegion(region.id)"
          >
            <TrashIcon class="h-4 w-4" />
            {{ deletingDeliveryRegionId === region.id ? 'Removendo' : 'Remover' }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
