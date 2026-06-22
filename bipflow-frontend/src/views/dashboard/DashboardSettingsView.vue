<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ArrowTopRightOnSquareIcon,
  BuildingStorefrontIcon,
  PencilSquareIcon,
  PhoneIcon,
  TagIcon,
  TrashIcon,
  TruckIcon,
} from '@heroicons/vue/24/outline';
import { useCategories } from '@/composables/useCategories';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import type { CategoryCreatePayload } from '@/schemas/category.schema';
import type { DeliveryRegion, DeliveryRegionPayload } from '@/types/delivery';
import type { StoreSettings, StoreSettingsPayload } from '@/types/store-settings';
import { deliveryRegionService } from '@/services/delivery-region.service';
import { Logger } from '@/services/logger';
import { storeService } from '@/services/store.service';
import { storeSettingsService } from '@/services/store-settings.service';
import { formatBRL } from '@/utils/formatters';

type SettingsTab = 'categorias' | 'frete' | 'whatsapp' | 'lojas';

const TABS: { value: SettingsTab; label: string; icon: typeof TagIcon }[] = [
  { value: 'categorias', label: 'Categorias', icon: TagIcon },
  { value: 'frete', label: 'Frete', icon: TruckIcon },
  { value: 'whatsapp', label: 'WhatsApp', icon: PhoneIcon },
  { value: 'lojas', label: 'Lojas', icon: BuildingStorefrontIcon },
];

const activeTab = ref<SettingsTab>('categorias');

const { canManageCatalog } = useCurrentUser();
const { selectedStore, fetchCurrentStore, selectStore } = useCurrentStore();
const { success, error: toastError } = useToast();

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
const { categories, loading: isCategoriesLoading, error: categoriesError, fetchCategories, addCategory, deleteCategory } = useCategories();
const isSavingCategory = ref(false);
const deletingCategoryId = ref<number | null>(null);
const categoryDraft = ref<CategoryCreatePayload>({ name: '', description: '' });

function resetCategoryDraft(): void {
  categoryDraft.value = { name: '', description: '' };
}

async function submitCategory(): Promise<void> {
  const name = categoryDraft.value.name.trim();
  if (name.length < 2) {
    return;
  }

  isSavingCategory.value = true;
  try {
    await addCategory({ name, description: categoryDraft.value.description?.trim() ?? '' });
    success('Categoria criada com sucesso.');
    resetCategoryDraft();
  } catch (error: unknown) {
    Logger.error('Category save failed', { error });
    toastError('Nao foi possivel salvar a categoria.');
  } finally {
    isSavingCategory.value = false;
  }
}

async function handleDeleteCategory(categoryId: number): Promise<void> {
  deletingCategoryId.value = categoryId;
  try {
    await deleteCategory(categoryId);
    success('Categoria removida com sucesso.');
  } catch (error: unknown) {
    Logger.error('Category deletion failed', { error, categoryId });
    toastError('Nao foi possivel remover a categoria. Verifique se ela possui produtos vinculados.');
  } finally {
    deletingCategoryId.value = null;
  }
}

// ---------------------------------------------------------------------------
// Frete (regioes de entrega)
// ---------------------------------------------------------------------------
const deliveryRegions = ref<DeliveryRegion[]>([]);
const isDeliveryRegionsLoading = ref(false);
const deliveryRegionsError = ref<string | null>(null);
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

async function fetchDeliveryRegions(): Promise<void> {
  isDeliveryRegionsLoading.value = true;
  deliveryRegionsError.value = null;

  try {
    deliveryRegions.value = await deliveryRegionService.getAll();
  } catch (error: unknown) {
    Logger.warn('Failed to fetch delivery regions', { error });
    deliveryRegionsError.value = 'Nao foi possivel carregar as regioes de frete agora.';
  } finally {
    isDeliveryRegionsLoading.value = false;
  }
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

// ---------------------------------------------------------------------------
// WhatsApp da loja
// ---------------------------------------------------------------------------
const storeSettings = ref<StoreSettings | null>(null);
const isStoreSettingsLoading = ref(false);
const storeSettingsError = ref<string | null>(null);
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
  isStoreSettingsLoading.value = true;
  storeSettingsError.value = null;

  try {
    storeSettings.value = await storeSettingsService.get();
    storeSettingsDraft.value = { whatsapp_phone: storeSettings.value.whatsapp_phone ?? '' };
  } catch (error: unknown) {
    Logger.warn('Failed to fetch store settings', { error });
    storeSettingsError.value = 'Nao foi possivel carregar o WhatsApp da loja agora.';
  } finally {
    isStoreSettingsLoading.value = false;
  }
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

// ---------------------------------------------------------------------------
// Nova loja
// ---------------------------------------------------------------------------
const newStoreName = ref('');
const isCreatingStore = ref(false);
const createStoreError = ref<string | null>(null);

async function handleCreateStore(): Promise<void> {
  const name = newStoreName.value.trim();
  if (name.length < 2) {
    return;
  }

  isCreatingStore.value = true;
  createStoreError.value = null;

  try {
    const newStore = await storeService.create(name);
    await fetchCurrentStore(true);
    selectStore(newStore.slug);
    newStoreName.value = '';
    success(`Loja "${newStore.name}" criada com sucesso.`);
  } catch (error: unknown) {
    Logger.error('Store creation failed', { error, name });
    createStoreError.value = 'Nao foi possivel criar a loja. Tente novamente.';
  } finally {
    isCreatingStore.value = false;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const refreshSettings = (): void => {
  void fetchCategories(true);
  void fetchDeliveryRegions();
  void fetchStoreSettings();
};

refreshSettings();
watch(selectedStore, refreshSettings);
</script>

<template>
  <div>
    <div>
      <p class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Operacao</p>
      <h1 class="mt-1 text-xl font-black italic tracking-tighter text-white">Configuracoes</h1>
    </div>

    <nav role="tablist" aria-label="Secoes de configuracao" class="mt-6 inline-flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-zinc-950 p-1">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.value"
        class="flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300"
        :class="activeTab === tab.value ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'text-zinc-500 hover:text-zinc-200'"
        @click="activeTab = tab.value"
      >
        <component :is="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="activeTab === 'categorias'" class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
      <form v-if="canManageCatalog" class="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="submitCategory">
        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome</span>
          <input
            v-model="categoryDraft.name"
            type="text"
            class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
            placeholder="Bebidas, Combos, Acessorios..."
          />
        </label>

        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Descricao (opcional)</span>
          <textarea
            v-model="categoryDraft.description"
            rows="2"
            class="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
            placeholder="Contexto rapido para a equipe"
          />
        </label>

        <button
          type="submit"
          :disabled="isSavingCategory || categoryDraft.name.trim().length < 2"
          class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {{ isSavingCategory ? 'Salvando...' : 'Adicionar categoria' }}
        </button>
      </form>

      <div class="space-y-3">
        <div v-if="isCategoriesLoading" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div class="h-4 w-40 animate-pulse rounded bg-zinc-800" />
          <div class="mt-3 h-3 w-56 animate-pulse rounded bg-zinc-800" />
        </div>

        <div v-else-if="categoriesError" class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          {{ categoriesError }}
        </div>

        <div v-else-if="categories.length === 0" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p class="text-sm font-semibold text-white">Nenhuma categoria cadastrada.</p>
          <p class="mt-1 text-xs leading-5 text-zinc-500">Cadastre ao menos uma categoria para liberar o formulario de produtos.</p>
        </div>

        <article v-for="category in categories" :key="category.id" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-white">{{ category.name }}</p>
              <p v-if="category.description" class="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{{ category.description }}</p>
            </div>
            <button
              v-if="canManageCatalog"
              type="button"
              class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="deletingCategoryId === category.id"
              @click="handleDeleteCategory(category.id)"
            >
              <TrashIcon class="h-4 w-4" />
              {{ deletingCategoryId === category.id ? 'Removendo' : 'Remover' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section v-else-if="activeTab === 'frete'" class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
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

    <section v-else-if="activeTab === 'whatsapp'" class="mt-8 max-w-md">
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

    <section v-else-if="activeTab === 'lojas'" class="mt-8 max-w-md">
      <p class="text-xs leading-5 text-zinc-500">
        Voce passa a ser dona/dono dessa loja e pode trocar entre as suas lojas pelo seletor no topo.
      </p>

      <form class="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="handleCreateStore">
        <label class="block">
          <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome da loja</span>
          <input
            v-model="newStoreName"
            type="text"
            class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
            placeholder="Ex.: Filial Centro"
          />
        </label>

        <p v-if="createStoreError" class="text-xs font-semibold text-rose-300">{{ createStoreError }}</p>

        <button
          type="submit"
          :disabled="isCreatingStore || newStoreName.trim().length < 2"
          class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {{ isCreatingStore ? 'Criando...' : 'Criar loja' }}
        </button>
      </form>
    </section>
  </div>
</template>
