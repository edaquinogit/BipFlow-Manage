<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  CheckIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { useToast } from '@/composables/useToast';
import { useCategories } from '@/composables/useCategories';
import type { FilterState } from '@/types/filters';
import { createDefaultFilterState, hasActiveFilters } from '@/types/filters';
import { Logger } from '@/services/logger';

interface Props {
  filters: FilterState;
  isSearching?: boolean;
  categories?: Array<{ id: number | string; name: string }>;
  showPriceControls?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSearching: false,
  categories: () => [],
  showPriceControls: true,
});

const emit = defineEmits<{
  (e: 'updateFilters', filters: Partial<FilterState>): void;
  (e: 'clear-filters'): void;
}>();

const { addCategory } = useCategories();
const toast = useToast();

const localFilters = ref<FilterState>({ ...props.filters });
const isFiltersOpen = ref(false);
const showNewCategoryModal = ref(false);
const newCategoryName = ref('');
const isCreatingCategory = ref(false);

const hasAnyActiveFilters = computed(() => hasActiveFilters(localFilters.value));

const activeFilterSummary = computed(() => {
  const parts: string[] = [];

  if (localFilters.value.search.trim()) {
    parts.push(`Busca: "${localFilters.value.search.trim()}"`);
  }

  if (localFilters.value.categoryId) {
    parts.push(`Categoria: ${getCategoryName(localFilters.value.categoryId)}`);
  }

  if (localFilters.value.inStock !== null) {
    parts.push(localFilters.value.inStock ? 'Somente em estoque' : 'Somente sem estoque');
  }

  if (localFilters.value.minPrice !== null || localFilters.value.maxPrice !== null) {
    parts.push(formatPriceRange());
  }

  return parts;
});

watch(
  () => props.filters,
  (newFilters) => {
    localFilters.value = { ...newFilters };
  },
  { deep: true }
);

function emitFilters(patch: Partial<FilterState>): void {
  localFilters.value = {
    ...localFilters.value,
    ...patch,
    page: 1,
  };

  emit('updateFilters', { ...patch, page: 1 });
}

function getCategoryName(id: string | number | null): string {
  if (!id) return 'Todas as categorias';
  const category = props.categories.find((item) => item.id === id);
  return category?.name || 'Categoria desconhecida';
}

function getAvailabilityText(inStock: boolean | null): string {
  if (inStock === true) return 'Em estoque';
  if (inStock === false) return 'Sem estoque';
  return 'Todos os itens';
}

function normalizePriceInput(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatPriceRange(): string {
  const { minPrice, maxPrice } = localFilters.value;

  if (minPrice !== null && maxPrice !== null) {
    return `Preco: ${minPrice} - ${maxPrice}`;
  }

  if (minPrice !== null) {
    return `A partir de ${minPrice}`;
  }

  if (maxPrice !== null) {
    return `Ate ${maxPrice}`;
  }

  return 'Preco';
}

function handleSearchInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emitFilters({ search: target.value });
}

function clearSearch(): void {
  emitFilters({ search: '' });
}

function toggleFiltersDrawer(): void {
  isFiltersOpen.value = !isFiltersOpen.value;
}

function selectCategory(categoryId: string | number | null): void {
  emitFilters({ categoryId });
}

function selectAvailability(inStock: boolean | null): void {
  emitFilters({ inStock });
}

function handleMinPriceInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emitFilters({ minPrice: normalizePriceInput(target.value) });
}

function handleMaxPriceInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emitFilters({ maxPrice: normalizePriceInput(target.value) });
}

function handleClearFilters(): void {
  localFilters.value = createDefaultFilterState();
  emit('clear-filters');
}

function removeFilter(type: 'search' | 'category' | 'availability' | 'price'): void {
  switch (type) {
    case 'search':
      emitFilters({ search: '' });
      return;
    case 'category':
      emitFilters({ categoryId: null });
      return;
    case 'availability':
      emitFilters({ inStock: null });
      return;
    case 'price':
      emitFilters({ minPrice: null, maxPrice: null });
  }
}

async function createNewCategory(): Promise<void> {
  const categoryName = newCategoryName.value.trim();
  if (!categoryName) return;

  isCreatingCategory.value = true;

  try {
    const newCategory = await addCategory({
      name: categoryName,
      description: '',
    });

    newCategoryName.value = '';
    showNewCategoryModal.value = false;
    emitFilters({ categoryId: newCategory.id });
    toast.success(`Categoria "${newCategory.name}" criada com sucesso.`);
  } catch (error) {
    Logger.error('Failed to create category from filter bar', {
      error,
      categoryName,
    });
    toast.error('Nao foi possivel criar a categoria. Tente novamente.');
  } finally {
    isCreatingCategory.value = false;
  }
}

function cancelNewCategory(): void {
  newCategoryName.value = '';
  showNewCategoryModal.value = false;
}
</script>

<template>
  <div class="sticky top-24 z-40 overflow-visible">
    <div
      class="relative flex items-center gap-2"
      data-cy="search-filter-bar"
    >
      <label class="relative block min-w-0 flex-1">
        <span class="sr-only">Buscar produtos</span>
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <MagnifyingGlassIcon class="h-4 w-4 text-bip-muted" />
        </div>

        <input
          :value="localFilters.search"
          type="text"
          placeholder="Buscar por nome, SKU ou descrição"
          data-cy="search-input"
          class="h-11 w-full rounded-full border border-transparent bg-[#F4F1F3] py-3 pl-11 pr-10 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:bg-white focus:ring-2 focus:ring-[#FCE7F3]"
          @input="handleSearchInput"
        />

        <button
          v-if="localFilters.search"
          type="button"
          class="absolute inset-y-0 right-0 flex items-center pr-4 text-bip-muted transition hover:text-[#05050A]"
          aria-label="Limpar busca"
          @click="clearSearch"
        >
          <XMarkIcon class="h-4 w-4" />
        </button>
      </label>

      <span
        v-if="isSearching"
        class="hidden shrink-0 items-center gap-2 rounded-full bg-[#F4F1F3] px-3 py-2 text-xs text-bip-muted sm:inline-flex"
      >
        <span class="h-2 w-2 animate-pulse rounded-full bg-[#D81B60]" />
        Buscando
      </span>

      <button
        v-if="hasAnyActiveFilters"
        type="button"
        data-cy="btn-clear-filters"
        class="hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-bip-muted transition hover:text-[#D81B60] sm:inline-flex"
        @click="handleClearFilters"
      >
        <XMarkIcon class="h-3.5 w-3.5" />
        Limpar
      </button>

      <button
        type="button"
        :aria-expanded="isFiltersOpen"
        aria-label="Abrir filtros"
        class="group relative shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-transparent bg-[#F4F1F3] text-bip-muted transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FCE7F3] hover:text-[#D81B60] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
        @click="toggleFiltersDrawer"
      >
        <FunnelIcon class="h-5 w-5" />
        <span
          v-if="hasAnyActiveFilters"
          class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#D81B60] ring-2 ring-white"
        />
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="isFiltersOpen" class="absolute left-0 right-0 top-full z-40 mt-2">
        <div class="fixed inset-0 bg-black/10 backdrop-blur-sm" @click="isFiltersOpen = false" />

        <div class="relative ml-auto w-full max-w-2xl rounded-2xl border border-white/40 bg-white/80 p-4 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-6">
          <button
            type="button"
            class="absolute right-3 top-3 text-bip-muted transition hover:text-[#D81B60]"
            aria-label="Fechar filtros"
            @click="isFiltersOpen = false"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>

          <div class="grid gap-6 sm:grid-cols-2">
            <div>
              <div class="mb-3 flex items-center justify-between gap-3">
                <span class="text-xs font-black uppercase tracking-[0.16em] text-bip-muted">Categorias</span>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-xs font-semibold text-[#D81B60] hover:underline"
                  @click="showNewCategoryModal = true"
                >
                  <PlusIcon class="h-3.5 w-3.5" />
                  Nova
                </button>
              </div>

              <div class="filter-popover-scroll max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[#D1D5DB]/60 bg-white/50 p-1.5 backdrop-blur">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition"
                  :class="!localFilters.categoryId ? 'bg-[#D81B60] text-white shadow-sm' : 'text-[#05050A] hover:bg-zinc-100'"
                  :aria-selected="!localFilters.categoryId"
                  @click="selectCategory(null)"
                >
                  <span class="truncate">Todas as categorias</span>
                  <CheckIcon v-if="!localFilters.categoryId" class="h-4 w-4 shrink-0" />
                </button>

                <button
                  v-for="category in categories"
                  :key="category.id"
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition"
                  :class="localFilters.categoryId === category.id ? 'bg-[#D81B60] text-white shadow-sm' : 'text-[#05050A] hover:bg-zinc-100'"
                  :aria-selected="localFilters.categoryId === category.id"
                  @click="selectCategory(category.id)"
                >
                  <span class="truncate">{{ category.name }}</span>
                  <CheckIcon v-if="localFilters.categoryId === category.id" class="h-4 w-4 shrink-0" />
                </button>
              </div>
            </div>

            <div>
              <span class="mb-3 block text-xs font-black uppercase tracking-[0.16em] text-bip-muted">Disponibilidade</span>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                  :class="localFilters.inStock === null
                    ? 'bg-[#D81B60] text-white shadow-md'
                    : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#FCE7F3] hover:text-[#D81B60]'"
                  @click="selectAvailability(null)"
                >
                  Todos os itens
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                  :class="localFilters.inStock === true
                    ? 'bg-[#D81B60] text-white shadow-md'
                    : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#FCE7F3] hover:text-[#D81B60]'"
                  @click="selectAvailability(true)"
                >
                  Em estoque
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                  :class="localFilters.inStock === false
                    ? 'bg-[#D81B60] text-white shadow-md'
                    : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#FCE7F3] hover:text-[#D81B60]'"
                  @click="selectAvailability(false)"
                >
                  Sem estoque
                </button>
              </div>

              <div v-if="showPriceControls" class="mt-6">
                <span class="mb-3 block text-xs font-black uppercase tracking-[0.16em] text-bip-muted">Faixa de preço</span>
                <div class="grid grid-cols-2 gap-2">
                  <label class="block">
                    <span class="sr-only">Preço minimo</span>
                    <input
                      :value="localFilters.minPrice ?? ''"
                      type="number"
                      min="0"
                      step="0.01"
                      class="h-10 w-full rounded-lg border border-[#D1D5DB] bg-white/50 px-3 text-sm text-[#05050A] outline-none backdrop-blur transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                      placeholder="Min."
                      @input="handleMinPriceInput"
                    />
                  </label>
                  <label class="block">
                    <span class="sr-only">Preço maximo</span>
                    <input
                      :value="localFilters.maxPrice ?? ''"
                      type="number"
                      min="0"
                      step="0.01"
                      class="h-10 w-full rounded-lg border border-[#D1D5DB] bg-white/50 px-3 text-sm text-[#05050A] outline-none backdrop-blur transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                      placeholder="Max."
                      @input="handleMaxPriceInput"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end gap-3 border-t border-white/40 pt-4">
            <button
              v-if="hasAnyActiveFilters"
              type="button"
              class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-bip-muted transition hover:border-[#D81B60]/40 hover:text-[#05050A]"
              @click="handleClearFilters"
            >
              <XMarkIcon class="h-4 w-4" />
              Limpar filtros
            </button>
            <button
              type="button"
              class="inline-flex h-10 items-center justify-center rounded-lg bg-[#D81B60] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-18px_rgba(216,27,96,0.8)] transition hover:bg-[#D81B60]/90"
              @click="isFiltersOpen = false"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="activeFilterSummary.length > 0" class="mt-3 flex flex-wrap gap-2">
      <button
        v-if="localFilters.search.trim()"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-zinc-50 px-3 py-1.5 text-xs text-bip-muted"
        @click="removeFilter('search')"
      >
        {{ activeFilterSummary.find((item) => item.startsWith('Busca:')) }}
        <XMarkIcon class="h-3 w-3" />
      </button>

      <button
        v-if="localFilters.categoryId"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-zinc-50 px-3 py-1.5 text-xs text-bip-muted"
        @click="removeFilter('category')"
      >
        {{ getCategoryName(localFilters.categoryId) }}
        <XMarkIcon class="h-3 w-3" />
      </button>

      <button
        v-if="localFilters.inStock !== null"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-zinc-50 px-3 py-1.5 text-xs text-bip-muted"
        @click="removeFilter('availability')"
      >
        {{ getAvailabilityText(localFilters.inStock) }}
        <XMarkIcon class="h-3 w-3" />
      </button>

      <button
        v-if="localFilters.minPrice !== null || localFilters.maxPrice !== null"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-zinc-50 px-3 py-1.5 text-xs text-bip-muted"
        @click="removeFilter('price')"
      >
        {{ formatPriceRange() }}
        <XMarkIcon class="h-3 w-3" />
      </button>
    </div>

    <div
      v-if="showNewCategoryModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="cancelNewCategory"
    >
      <div class="mx-4 w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xl shadow-black/10">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-[#05050A]">
              Nova categoria
            </h3>
            <p class="mt-1 text-sm text-bip-muted">
              Crie uma categoria e aplique o filtro em seguida.
            </p>
          </div>

          <button
            type="button"
            class="text-bip-muted transition hover:text-[#05050A]"
            aria-label="Fechar criação de categoria"
            @click="cancelNewCategory"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="createNewCategory">
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-bip-muted">
              Nome da categoria
            </span>
            <input
              v-model="newCategoryName"
              type="text"
              required
              minlength="2"
              maxlength="50"
              class="h-12 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              placeholder="Ex.: Bebidas"
            />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm font-medium text-bip-muted transition hover:border-[#D81B60]/30 hover:text-[#05050A]"
              :disabled="isCreatingCategory"
              @click="cancelNewCategory"
            >
              Cancelar
            </button>

            <button
              type="submit"
              class="rounded-xl bg-[#D81B60] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isCreatingCategory || !newCategoryName.trim()"
            >
              <span v-if="isCreatingCategory">Criando...</span>
              <span v-else>Criar categoria</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-popover-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgb(113 113 122 / 0.55) transparent;
}

.filter-popover-scroll::-webkit-scrollbar {
  width: 6px;
}

.filter-popover-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.filter-popover-scroll::-webkit-scrollbar-thumb {
  background: rgb(209 213 219 / 0.8);
  border-radius: 999px;
}

.filter-popover-scroll::-webkit-scrollbar-thumb:hover {
  background: rgb(156 163 175 / 0.9);
}
</style>
