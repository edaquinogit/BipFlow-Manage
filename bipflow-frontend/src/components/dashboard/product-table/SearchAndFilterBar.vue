<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ChevronDownIcon,
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
const isCategoryDropdownOpen = ref(false);
const isAvailabilityDropdownOpen = ref(false);
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

function toggleCategoryDropdown(): void {
  isAvailabilityDropdownOpen.value = false;
  isCategoryDropdownOpen.value = !isCategoryDropdownOpen.value;
}

function toggleAvailabilityDropdown(): void {
  isCategoryDropdownOpen.value = false;
  isAvailabilityDropdownOpen.value = !isAvailabilityDropdownOpen.value;
}

function selectCategory(categoryId: string | number | null): void {
  isCategoryDropdownOpen.value = false;
  emitFilters({ categoryId });
}

function selectAvailability(inStock: boolean | null): void {
  isAvailabilityDropdownOpen.value = false;
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

function closeDropdowns(): void {
  isCategoryDropdownOpen.value = false;
  isAvailabilityDropdownOpen.value = false;
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
      class="relative overflow-visible rounded-lg border border-white/10 bg-zinc-950/85 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl"
      data-cy="search-filter-bar"
      @click="closeDropdowns"
    >
      <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label class="relative block min-w-0 flex-1">
          <span class="sr-only">Buscar produtos</span>
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <MagnifyingGlassIcon class="h-4 w-4 text-zinc-500" />
          </div>

          <input
            :value="localFilters.search"
            type="text"
            placeholder="Buscar por nome, SKU ou descricao"
            data-cy="search-input"
            class="h-11 w-full rounded-lg border border-transparent bg-white/[0.06] py-3 pl-11 pr-10 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20 focus:bg-white/[0.08] focus:ring-2 focus:ring-white/10"
            @input="handleSearchInput"
          />

          <button
            v-if="localFilters.search"
            type="button"
            class="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-500 transition hover:text-white"
            aria-label="Limpar busca"
            @click.stop="clearSearch"
          >
            <XMarkIcon class="h-4 w-4" />
          </button>
        </label>

        <div v-if="isSearching" class="inline-flex h-11 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm text-zinc-300">
          <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Buscando
        </div>

        <div v-if="categories.length > 0" class="relative min-w-[11rem]">
          <button
            type="button"
            class="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-transparent bg-white/[0.06] px-4 text-left text-sm text-white transition hover:bg-white/[0.08] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
            :aria-expanded="isCategoryDropdownOpen"
            @click.stop="toggleCategoryDropdown"
          >
            <span class="truncate">{{ getCategoryName(localFilters.categoryId) }}</span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-zinc-500 transition-transform" :class="{ 'rotate-180': isCategoryDropdownOpen }" />
          </button>

          <div
            v-if="isCategoryDropdownOpen"
            class="absolute left-0 z-[80] mt-2 w-64 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-2xl shadow-black/40 ring-1 ring-black/20 backdrop-blur-xl"
            role="listbox"
          >
            <div class="flex items-center justify-between px-3 py-2">
              <span class="text-xs font-medium text-zinc-500">Categorias</span>
              <span v-if="categories.length" class="text-xs text-zinc-600">
                {{ categories.length }}
              </span>
            </div>

            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
              @click.stop="showNewCategoryModal = true; isCategoryDropdownOpen = false"
            >
              <span class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-400">
                <PlusIcon class="h-4 w-4" />
              </span>
              <span class="min-w-0">
                <span class="block truncate font-medium">Nova categoria</span>
                <span class="block truncate text-xs text-zinc-500">Criar e aplicar filtro</span>
              </span>
            </button>

            <div class="my-1 h-px bg-white/10" />

            <div class="filter-popover-scroll max-h-64 overflow-y-auto pr-1">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
                :class="!localFilters.categoryId ? 'bg-white/[0.08] text-white' : 'text-zinc-300 hover:text-white'"
                :aria-selected="!localFilters.categoryId"
                @click.stop="selectCategory(null)"
              >
                <span class="truncate">Todas as categorias</span>
                <CheckIcon v-if="!localFilters.categoryId" class="h-4 w-4 shrink-0 text-emerald-300" />
              </button>

              <button
                v-for="category in categories"
                :key="category.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
                :class="localFilters.categoryId === category.id ? 'bg-white/[0.08] text-white' : 'text-zinc-300 hover:text-white'"
                :aria-selected="localFilters.categoryId === category.id"
                @click.stop="selectCategory(category.id)"
              >
                <span class="truncate">{{ category.name }}</span>
                <CheckIcon v-if="localFilters.categoryId === category.id" class="h-4 w-4 shrink-0 text-emerald-300" />
              </button>
            </div>
          </div>
        </div>

        <div class="relative min-w-[9.5rem]">
          <button
            type="button"
            class="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-transparent bg-white/[0.06] px-4 text-left text-sm text-white transition hover:bg-white/[0.08] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/10"
            :aria-expanded="isAvailabilityDropdownOpen"
            @click.stop="toggleAvailabilityDropdown"
          >
            <span class="truncate">{{ getAvailabilityText(localFilters.inStock) }}</span>
            <ChevronDownIcon class="h-4 w-4 shrink-0 text-zinc-500 transition-transform" :class="{ 'rotate-180': isAvailabilityDropdownOpen }" />
          </button>

          <div
            v-if="isAvailabilityDropdownOpen"
            class="absolute right-0 z-[80] mt-2 w-52 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-2xl shadow-black/40 ring-1 ring-black/20 backdrop-blur-xl"
            role="listbox"
          >
            <div class="px-3 py-2 text-xs font-medium text-zinc-500">
              Disponibilidade
            </div>

            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
              :class="localFilters.inStock === null ? 'bg-white/[0.08] text-white' : 'text-zinc-300 hover:text-white'"
              :aria-selected="localFilters.inStock === null"
              @click.stop="selectAvailability(null)"
            >
              <span>Todos os itens</span>
              <CheckIcon v-if="localFilters.inStock === null" class="h-4 w-4 shrink-0 text-emerald-300" />
            </button>
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
              :class="localFilters.inStock === true ? 'bg-white/[0.08] text-white' : 'text-zinc-300 hover:text-white'"
              :aria-selected="localFilters.inStock === true"
              @click.stop="selectAvailability(true)"
            >
              <span>Em estoque</span>
              <CheckIcon v-if="localFilters.inStock === true" class="h-4 w-4 shrink-0 text-emerald-300" />
            </button>
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
              :class="localFilters.inStock === false ? 'bg-white/[0.08] text-white' : 'text-zinc-300 hover:text-white'"
              :aria-selected="localFilters.inStock === false"
              @click.stop="selectAvailability(false)"
            >
              <span>Sem estoque</span>
              <CheckIcon v-if="localFilters.inStock === false" class="h-4 w-4 shrink-0 text-emerald-300" />
            </button>
          </div>
        </div>

        <div v-if="showPriceControls" class="grid grid-cols-2 gap-2 lg:w-52">
          <label class="block">
            <span class="sr-only">Preco minimo</span>
            <input
              :value="localFilters.minPrice ?? ''"
              type="number"
              min="0"
              step="0.01"
              class="h-11 w-full rounded-lg border border-transparent bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              placeholder="Min."
              @input="handleMinPriceInput"
            />
          </label>
          <label class="block">
            <span class="sr-only">Preco maximo</span>
            <input
              :value="localFilters.maxPrice ?? ''"
              type="number"
              min="0"
              step="0.01"
              class="h-11 w-full rounded-lg border border-transparent bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/10"
              placeholder="Max."
              @input="handleMaxPriceInput"
            />
          </label>
        </div>

        <button
          v-if="hasAnyActiveFilters"
          type="button"
          data-cy="btn-clear-filters"
          class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
          @click.stop="handleClearFilters"
        >
          <XMarkIcon class="h-4 w-4" />
          Limpar
        </button>
      </div>

      <div v-if="activeFilterSummary.length > 0" class="mt-3 flex flex-wrap gap-2">
        <button
          v-if="localFilters.search.trim()"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
          @click.stop="removeFilter('search')"
        >
          {{ activeFilterSummary.find((item) => item.startsWith('Busca:')) }}
          <XMarkIcon class="h-3 w-3" />
        </button>

        <button
          v-if="localFilters.categoryId"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
          @click.stop="removeFilter('category')"
        >
          {{ getCategoryName(localFilters.categoryId) }}
          <XMarkIcon class="h-3 w-3" />
        </button>

        <button
          v-if="localFilters.inStock !== null"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
          @click.stop="removeFilter('availability')"
        >
          {{ getAvailabilityText(localFilters.inStock) }}
          <XMarkIcon class="h-3 w-3" />
        </button>

        <button
          v-if="localFilters.minPrice !== null || localFilters.maxPrice !== null"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
          @click.stop="removeFilter('price')"
        >
          {{ formatPriceRange() }}
          <XMarkIcon class="h-3 w-3" />
        </button>
      </div>
    </div>

    <div
      v-if="showNewCategoryModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="cancelNewCategory"
    >
      <div class="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-white">
              Nova categoria
            </h3>
            <p class="mt-1 text-sm text-zinc-500">
              Crie uma categoria e aplique o filtro em seguida.
            </p>
          </div>

          <button
            type="button"
            class="text-zinc-500 transition hover:text-white"
            aria-label="Fechar criacao de categoria"
            @click="cancelNewCategory"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="createNewCategory">
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-zinc-300">
              Nome da categoria
            </span>
            <input
              v-model="newCategoryName"
              type="text"
              required
              minlength="2"
              maxlength="50"
              class="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 focus:ring-2 focus:ring-white/10"
              placeholder="Ex.: Bebidas"
            />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
              :disabled="isCreatingCategory"
              @click="cancelNewCategory"
            >
              Cancelar
            </button>

            <button
              type="submit"
              class="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
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
  background: rgb(113 113 122 / 0.55);
  border-radius: 999px;
}

.filter-popover-scroll::-webkit-scrollbar-thumb:hover {
  background: rgb(161 161 170 / 0.72);
}
</style>
