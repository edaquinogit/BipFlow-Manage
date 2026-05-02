<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  MagnifyingGlassIcon,
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
  if (!id) return 'All Categories';
  const category = props.categories.find((item) => item.id === id);
  return category?.name || 'Unknown Category';
}

function getAvailabilityText(inStock: boolean | null): string {
  if (inStock === true) return 'In Stock';
  if (inStock === false) return 'Out of Stock';
  return 'All Items';
}

function normalizePriceInput(value: string): number | null {
  if (!value.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatPriceRange(): string {
  const { minPrice, maxPrice } = localFilters.value;

  if (minPrice !== null && maxPrice !== null) {
    return `Price: ${minPrice} - ${maxPrice}`;
  }

  if (minPrice !== null) {
    return `Price from ${minPrice}`;
  }

  if (maxPrice !== null) {
    return `Price up to ${maxPrice}`;
  }

  return 'Price';
}

function handleSearchInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emitFilters({ search: target.value });
}

function clearSearch(): void {
  emitFilters({ search: '' });
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
  <div class="relative z-40 space-y-4 overflow-visible">
    <div
      class="relative overflow-visible rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-sm"
      data-cy="search-filter-bar"
      @click="closeDropdowns"
    >
      <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 class="text-sm font-black uppercase tracking-[0.2em] text-white">
            Search & Filter
          </h4>
          <p class="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Refine your asset registry without breaking workflow
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div
            v-if="isSearching"
            class="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-300"
          >
            <span class="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
            Searching
          </div>

          <button
            v-if="hasAnyActiveFilters"
            type="button"
            data-cy="btn-clear-filters"
            class="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-800/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-white"
            @click.stop="handleClearFilters"
          >
            <XMarkIcon class="h-3 w-3" />
            Clear Filters
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)_minmax(160px,0.5fr)_minmax(160px,0.5fr)]">
        <div class="relative">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Search
          </label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <MagnifyingGlassIcon class="h-4 w-4 text-zinc-600" />
            </div>

            <input
              :value="localFilters.search"
              type="text"
              placeholder="Search by name, SKU, or description..."
              data-cy="search-input"
              class="w-full rounded-2xl border border-zinc-700/50 bg-zinc-800/40 py-3 pl-12 pr-10 text-sm text-white placeholder-zinc-600 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              @input="handleSearchInput"
            />

            <button
              v-if="localFilters.search"
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-500 transition hover:text-white"
              @click.stop="clearSearch"
            >
              <XMarkIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div v-if="categories.length > 0" class="relative">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Category
          </label>
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-2xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3 text-left text-sm text-white transition hover:bg-zinc-800/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            :aria-expanded="isCategoryDropdownOpen"
            @click.stop="isCategoryDropdownOpen = !isCategoryDropdownOpen"
          >
            <span class="truncate">{{ getCategoryName(localFilters.categoryId) }}</span>
            <ChevronDownIcon class="h-4 w-4 text-zinc-500 transition-transform" :class="{ 'rotate-180': isCategoryDropdownOpen }" />
          </button>

          <div
            v-if="isCategoryDropdownOpen"
            class="absolute z-[80] mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-zinc-700/50 bg-zinc-900 shadow-2xl"
            role="listbox"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 border-b border-zinc-800 px-4 py-3 text-left text-sm text-indigo-300 transition hover:bg-indigo-500/10"
              @click.stop="showNewCategoryModal = true; isCategoryDropdownOpen = false"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6" />
              </svg>
              New Category
            </button>

            <button
              type="button"
              class="w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              :aria-selected="localFilters.categoryId === null"
              @click.stop="selectCategory(null)"
            >
              All Categories
            </button>

            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              class="w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              :aria-selected="localFilters.categoryId === category.id"
              @click.stop="selectCategory(category.id)"
            >
              {{ category.name }}
            </button>
          </div>
        </div>

        <div class="relative">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Availability
          </label>
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-2xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3 text-left text-sm text-white transition hover:bg-zinc-800/60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            :aria-expanded="isAvailabilityDropdownOpen"
            @click.stop="isAvailabilityDropdownOpen = !isAvailabilityDropdownOpen"
          >
            <span class="truncate">{{ getAvailabilityText(localFilters.inStock) }}</span>
            <ChevronDownIcon class="h-4 w-4 text-zinc-500 transition-transform" :class="{ 'rotate-180': isAvailabilityDropdownOpen }" />
          </button>

          <div
            v-if="isAvailabilityDropdownOpen"
            class="absolute z-[80] mt-2 w-full rounded-2xl border border-zinc-700/50 bg-zinc-900 shadow-2xl"
            role="listbox"
          >
            <button
              type="button"
              class="w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              :aria-selected="localFilters.inStock === null"
              @click.stop="selectAvailability(null)"
            >
              All Items
            </button>
            <button
              type="button"
              class="w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              :aria-selected="localFilters.inStock === true"
              @click.stop="selectAvailability(true)"
            >
              In Stock
            </button>
            <button
              type="button"
              class="w-full px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              :aria-selected="localFilters.inStock === false"
              @click.stop="selectAvailability(false)"
            >
              Out of Stock
            </button>
          </div>
        </div>

        <div v-if="showPriceControls">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Min Price
          </label>
          <input
            :value="localFilters.minPrice ?? ''"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-2xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3 text-sm text-white placeholder-zinc-600 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            placeholder="0.00"
            @input="handleMinPriceInput"
          />
        </div>

        <div v-if="showPriceControls">
          <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Max Price
          </label>
          <input
            :value="localFilters.maxPrice ?? ''"
            type="number"
            min="0"
            step="0.01"
            class="w-full rounded-2xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3 text-sm text-white placeholder-zinc-600 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            placeholder="1000.00"
            @input="handleMaxPriceInput"
          />
        </div>
      </div>

      <div v-if="activeFilterSummary.length > 0" class="mt-5 border-t border-zinc-800/70 pt-4">
        <div class="flex flex-wrap gap-2">
          <button
            v-if="localFilters.search.trim()"
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-200"
            @click.stop="removeFilter('search')"
          >
            {{ activeFilterSummary.find((item) => item.startsWith('Busca:')) }}
            <XMarkIcon class="h-3 w-3" />
          </button>

          <button
            v-if="localFilters.categoryId"
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200"
            @click.stop="removeFilter('category')"
          >
            Categoria: {{ getCategoryName(localFilters.categoryId) }}
            <XMarkIcon class="h-3 w-3" />
          </button>

          <button
            v-if="localFilters.inStock !== null"
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-200"
            @click.stop="removeFilter('availability')"
          >
            {{ getAvailabilityText(localFilters.inStock) }}
            <XMarkIcon class="h-3 w-3" />
          </button>

          <button
            v-if="localFilters.minPrice !== null || localFilters.maxPrice !== null"
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-200"
            @click.stop="removeFilter('price')"
          >
            {{ formatPriceRange() }}
            <XMarkIcon class="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showNewCategoryModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="cancelNewCategory"
    >
      <div class="mx-4 w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-sm font-black uppercase tracking-[0.2em] text-white">
              New Category
            </h3>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Create once and immediately refine the registry
            </p>
          </div>

          <button
            type="button"
            class="text-zinc-500 transition hover:text-white"
            @click="cancelNewCategory"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="createNewCategory">
          <div>
            <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Category Name
            </label>
            <input
              v-model="newCategoryName"
              type="text"
              required
              minlength="2"
              maxlength="50"
              class="w-full rounded-2xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-3 text-sm text-white placeholder-zinc-600 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="Enter category name..."
            />
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 rounded-2xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:bg-zinc-800/70 hover:text-white"
              :disabled="isCreatingCategory"
              @click="cancelNewCategory"
            >
              Cancel
            </button>

            <button
              type="submit"
              class="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isCreatingCategory || !newCategoryName.trim()"
            >
              <span v-if="isCreatingCategory">Creating...</span>
              <span v-else>Create Category</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
