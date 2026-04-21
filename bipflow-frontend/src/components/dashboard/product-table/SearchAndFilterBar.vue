<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import type { FilterState } from '@/types/filters';
import { useDebounceFn } from '@/utils/debounce';
import { Logger } from '@/services/logger';

/**
 * Search and Filter Bar Component
 *
 * Professional NYC Station (Cyberpunk) themed search and filter interface
 * with custom dropdowns and high-performance debouncing.
 *
 * Features:
 * - Custom themed search input with debouncing (400ms delay)
 * - Custom dropdown components for category and availability
 * - Real-time filter updates with type-safe event emission
 * - WCAG compliant accessibility with ARIA labels
 * - Glowing focus states matching the project's aesthetic
 */

interface Props {
  /**
   * Current filter state
   */
  filters: FilterState;

  /**
   * Whether a search is currently in progress
   */
  isSearching?: boolean;

  /**
   * Available categories for filtering
   */
  categories?: Array<{ id: number | string; name: string }>;

  /**
   * Whether to show price range controls
   */
  showPriceControls?: boolean;

  /**
   * Maximum price for range slider
   */
  maxPriceLimit?: number;
}

const props = withDefaults(defineProps<Props>(), {
  isSearching: false,
  categories: () => [],
  showPriceControls: true,
  maxPriceLimit: 1000,
});

/**
 * Event emitters for filter updates
 */
const emit = defineEmits<{
  (e: 'updateFilters', filters: FilterState): void;
  (e: 'clear-filters'): void;
}>();

// ==========================================
// STATE MANAGEMENT
// ==========================================

/**
 * Local reactive state for immediate UI feedback
 */
const localFilters = ref<FilterState>({ ...props.filters });

/**
 * Dropdown open states
 */
const isCategoryDropdownOpen = ref(false);
const isAvailabilityDropdownOpen = ref(false);

/**
 * New category creation state
 */
const showNewCategoryModal = ref(false);
const newCategoryName = ref('');
const isCreatingCategory = ref(false);

/**
 * Debounced filter update function
 */
const [debouncedUpdateFilters, cleanupDebounce] = useDebounceFn(
  () => {
    emit('updateFilters', { ...localFilters.value });
  },
  400 // 400ms delay as specified
);

// ==========================================
// COMPUTED PROPERTIES
// ==========================================

/**
 * Whether any filters are active
 */
const hasActiveFilters = computed(() => {
  return (
    localFilters.value.search?.trim() ||
    localFilters.value.categoryId ||
    localFilters.value.inStock !== null
  );
});

/**
 * Get category name by ID
 */
const getCategoryName = (id: string | number | null): string => {
  if (!id) return 'All Categories';
  const category = props.categories.find(cat => cat.id === id);
  return category?.name || 'Unknown Category';
};

/**
 * Get availability display text
 */
const getAvailabilityText = (inStock: boolean | null): string => {
  switch (inStock) {
    case true: return 'In Stock';
    case false: return 'Out of Stock';
    default: return 'All Items';
  }
};

// ==========================================
// EVENT HANDLERS
// ==========================================

/**
 * Handle search input changes with debouncing
 */
const handleSearchInput = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  localFilters.value.search = target.value;
  debouncedUpdateFilters();
};

/**
 * Clear search input
 */
const clearSearch = (): void => {
  localFilters.value.search = '';
  debouncedUpdateFilters();
};

/**
 * Handle category selection
 */
const selectCategory = (categoryId: string | number | null): void => {
  localFilters.value.categoryId = categoryId;
  isCategoryDropdownOpen.value = false;
  debouncedUpdateFilters();
};

/**
 * Handle availability selection
 */
const selectAvailability = (inStock: boolean | null): void => {
  localFilters.value.inStock = inStock;
  isAvailabilityDropdownOpen.value = false;
  debouncedUpdateFilters();
};

/**
 * Clear all filters
 */
const handleClearFilters = (): void => {
  localFilters.value = {
    search: '',
    categoryId: null,
    inStock: null,
    minPrice: null,
    maxPrice: null,
    page: 1,
  };
  emit('clear-filters');
};

/**
 * Close dropdowns when clicking outside
 */
const closeDropdowns = (): void => {
  isCategoryDropdownOpen.value = false;
  isAvailabilityDropdownOpen.value = false;
  showNewCategoryModal.value = false;
};

/**
 * Handle new category creation
 */
const createNewCategory = async (): Promise<void> => {
  if (!newCategoryName.value.trim()) return;

  isCreatingCategory.value = true;
  try {
    // Import the composable dynamically to avoid circular dependencies
    const { useCategories } = await import('@/composables/useCategories');
    const { addCategory } = useCategories();

    const newCategory = await addCategory({
      name: newCategoryName.value.trim(),
      description: '',
    });

    // Select the newly created category
    localFilters.value.categoryId = newCategory.id;

    // Reset modal state
    newCategoryName.value = '';
    showNewCategoryModal.value = false;

    // Emit filter update
    emit('updateFilters', { ...localFilters.value });

  } catch (error: any) {
    Logger.error('Failed to create category from filter bar', {
      error,
      categoryName: newCategoryName.value.trim(),
    });

    // Import toast composable for error notification
    const { useToast } = await import('@/composables/useToast');
    const { notify } = useToast();

    // Show error message
    const errorMessage = error?.message || 'Failed to create category. Please try again.';
    notify('error', errorMessage);
  } finally {
    isCreatingCategory.value = false;
  }
};

/**
 * Cancel new category creation
 */
const cancelNewCategory = (): void => {
  newCategoryName.value = '';
  showNewCategoryModal.value = false;
};

// ==========================================
// LIFECYCLE
// ==========================================

/**
 * Watch for prop changes to sync local state
 */
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters };
}, { deep: true });

/**
 * Cleanup debounced function on unmount
 */
onBeforeUnmount(() => {
  cleanupDebounce();
});
</script>

<template>
  <div
    class="w-full space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-2xl"
    data-cy="search-filter-bar"
    @click="closeDropdowns"
  >
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
      <div>
        <h4 class="text-sm font-black text-white uppercase tracking-[0.2em] mb-1">
          🔍 Search & Filter
        </h4>
        <p class="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">
          Refine your asset registry
        </p>
      </div>

      <!-- Clear Filters Button -->
      <button
        v-if="hasActiveFilters"
        @click.stop="handleClearFilters"
        data-cy="btn-clear-filters"
        class="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-800/30 border border-zinc-700/50 rounded-lg hover:bg-zinc-800/60 hover:text-white transition-all active:scale-95"
      >
        <XMarkIcon class="w-3 h-3" />
        Clear Filters
      </button>
    </div>

    <!-- Search Input -->
    <div class="relative">
      <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
        <MagnifyingGlassIcon
          class="w-4 h-4 transition-colors"
          :class="isSearching ? 'text-indigo-400 animate-pulse' : 'text-zinc-600'"
        />
      </div>
      <input
        v-model="localFilters.search"
        @input="handleSearchInput"
        type="text"
        placeholder="Search by name, SKU, or description..."
        data-cy="search-input"
        class="w-full pl-12 pr-10 py-3 bg-zinc-800/40 border border-zinc-700/50 text-white placeholder-zinc-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
      />
      <!-- Clear Search Button -->
      <button
        v-if="localFilters.search"
        @click.stop="clearSearch"
        type="button"
        class="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-500 hover:text-white transition-colors"
      >
        <XMarkIcon class="w-4 h-4" />
      </button>
    </div>

    <!-- Filter Controls Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Category Filter -->
      <div v-if="categories.length > 0" class="relative">
        <label class="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
          Category
        </label>
        <!-- Custom Dropdown Trigger -->
        <button
          @click.stop="isCategoryDropdownOpen = !isCategoryDropdownOpen"
          class="w-full px-4 py-2.5 bg-zinc-800/40 border border-zinc-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm text-left flex items-center justify-between hover:bg-zinc-800/60"
          :aria-expanded="isCategoryDropdownOpen"
          aria-haspopup="listbox"
          :aria-label="`Category filter: ${getCategoryName(localFilters.categoryId)}`"
        >
          <span class="truncate">{{ getCategoryName(localFilters.categoryId) }}</span>
          <ChevronDownIcon
            class="w-4 h-4 text-zinc-500 transition-transform"
            :class="{ 'rotate-180': isCategoryDropdownOpen }"
          />
        </button>

        <!-- Custom Dropdown Menu -->
        <div
          v-if="isCategoryDropdownOpen"
          class="absolute z-50 w-full mt-1 bg-zinc-800/95 border border-zinc-700/50 rounded-lg shadow-2xl backdrop-blur-sm max-h-48 overflow-y-auto"
          role="listbox"
        >
          <!-- New Category Option -->
          <button
            @click.stop="showNewCategoryModal = true; isCategoryDropdownOpen = false"
            class="w-full px-4 py-3 text-left text-sm text-indigo-400 hover:bg-indigo-500/20 transition-colors border-b border-zinc-700/50 flex items-center gap-2"
            role="option"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Category
          </button>

          <button
            @click.stop="selectCategory(null)"
            class="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-white transition-colors first:rounded-t-lg"
            role="option"
            :aria-selected="localFilters.categoryId === null"
          >
            All Categories
          </button>
          <button
            v-for="category in categories"
            :key="category.id"
            @click.stop="selectCategory(category.id)"
            class="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-white transition-colors"
            role="option"
            :aria-selected="localFilters.categoryId === category.id"
          >
            {{ category.name }}
          </button>
        </div>
      </div>

      <!-- Availability Filter -->
      <div class="relative">
        <label class="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
          Availability
        </label>
        <!-- Custom Dropdown Trigger -->
        <button
          @click.stop="isAvailabilityDropdownOpen = !isAvailabilityDropdownOpen"
          class="w-full px-4 py-2.5 bg-zinc-800/40 border border-zinc-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm text-left flex items-center justify-between hover:bg-zinc-800/60"
          :aria-expanded="isAvailabilityDropdownOpen"
          aria-haspopup="listbox"
          :aria-label="`Availability filter: ${getAvailabilityText(localFilters.inStock)}`"
        >
          <span class="truncate">{{ getAvailabilityText(localFilters.inStock) }}</span>
          <ChevronDownIcon
            class="w-4 h-4 text-zinc-500 transition-transform"
            :class="{ 'rotate-180': isAvailabilityDropdownOpen }"
          />
        </button>

        <!-- Custom Dropdown Menu -->
        <div
          v-if="isAvailabilityDropdownOpen"
          class="absolute z-50 w-full mt-1 bg-zinc-800/95 border border-zinc-700/50 rounded-lg shadow-2xl backdrop-blur-sm"
          role="listbox"
        >
          <button
            @click.stop="selectAvailability(null)"
            class="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-white transition-colors first:rounded-t-lg"
            role="option"
            :aria-selected="localFilters.inStock === null"
          >
            All Items
          </button>
          <button
            @click.stop="selectAvailability(true)"
            class="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-white transition-colors"
            role="option"
            :aria-selected="localFilters.inStock === true"
          >
            In Stock
          </button>
          <button
            @click.stop="selectAvailability(false)"
            class="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-indigo-500/20 hover:text-white transition-colors last:rounded-b-lg"
            role="option"
            :aria-selected="localFilters.inStock === false"
          >
            Out of Stock
          </button>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div v-if="isSearching" class="flex items-center justify-center">
        <div class="flex flex-col items-center gap-2">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
          <span class="text-[9px] text-zinc-500 font-semibold uppercase tracking-widest italic">
            Searching...
          </span>
        </div>
      </div>
    </div>

    <!-- Info Text -->
    <div class="text-[9px] text-zinc-600 font-medium italic mt-3 border-t border-zinc-800/50 pt-3">
      💡 Search filters are applied in real-time. Results update as you type (with 400ms debounce).
    </div>
  </div>

  <!-- New Category Modal -->
  <div
    v-if="showNewCategoryModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="cancelNewCategory"
  >
    <div class="w-full max-w-md mx-4">
      <div class="bg-zinc-900/95 border border-zinc-700/50 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-black text-white uppercase tracking-[0.2em]">
            ➕ New Category
          </h3>
          <button
            @click="cancelNewCategory"
            class="text-zinc-500 hover:text-white transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form @submit.prevent="createNewCategory" class="space-y-4">
          <div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
              Category Name
            </label>
            <input
              v-model="newCategoryName"
              type="text"
              placeholder="Enter category name..."
              class="w-full px-4 py-3 bg-zinc-800/40 border border-zinc-700/50 text-white placeholder-zinc-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
              :disabled="isCreatingCategory"
              required
              minlength="2"
              maxlength="50"
            />
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              @click="cancelNewCategory"
              class="flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-800/30 border border-zinc-700/50 rounded-lg hover:bg-zinc-800/60 hover:text-white transition-all"
              :disabled="isCreatingCategory"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 border border-indigo-500 rounded-lg hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isCreatingCategory || !newCategoryName.trim()"
            >
              <span v-if="isCreatingCategory" class="flex items-center justify-center gap-2">
                <div class="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                Creating...
              </span>
              <span v-else>Create</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* NYC Station Cyberpunk Theme Variables */
:root {
  --nyc-bg-primary: #09090b; /* zinc-950 */
  --nyc-bg-secondary: #27272a; /* zinc-800 */
  --nyc-bg-tertiary: #18181b; /* zinc-900 */
  --nyc-border-primary: #3f3f46; /* zinc-700 */
  --nyc-border-secondary: #27272a; /* zinc-800 */
  --nyc-text-primary: #ffffff;
  --nyc-text-secondary: #a1a1aa; /* zinc-400 */
  --nyc-text-muted: #71717a; /* zinc-500 */
  --nyc-text-placeholder: #52525b; /* zinc-600 */
  --nyc-accent-primary: #6366f1; /* indigo-500 */
  --nyc-accent-secondary: #4f46e5; /* indigo-600 */
  --nyc-accent-glow: rgba(99, 102, 241, 0.2);
  --nyc-shadow-primary: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
  --nyc-shadow-glow: 0 0 20px rgba(99, 102, 241, 0.1);
}

/* Smooth transitions for all interactive elements */
button,
input {
  transition: all 0.2s ease;
}

/* Focus-within styling for better UX */
button:focus-visible,
input:focus-visible {
  box-shadow: 0 0 0 2px var(--nyc-accent-glow);
  border-color: var(--nyc-accent-primary);
}

/* Custom dropdown animations */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-5px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* Hover effects for dropdown items */
.dropdown-item {
  position: relative;
  transition: all 0.15s ease;
}

.dropdown-item:hover {
  background-color: var(--nyc-accent-glow);
  color: var(--nyc-text-primary);
}

.dropdown-item:hover::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--nyc-accent-primary), var(--nyc-accent-secondary));
  border-radius: 0 2px 2px 0;
}

/* Loading spinner animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Backdrop blur for modern glass effect */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

/* Custom scrollbar for dropdowns */
.dropdown-scroll::-webkit-scrollbar {
  width: 6px;
}

.dropdown-scroll::-webkit-scrollbar-track {
  background: var(--nyc-bg-secondary);
  border-radius: 3px;
}

.dropdown-scroll::-webkit-scrollbar-thumb {
  background: var(--nyc-border-primary);
  border-radius: 3px;
}

.dropdown-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--nyc-accent-primary);
}
</style>
