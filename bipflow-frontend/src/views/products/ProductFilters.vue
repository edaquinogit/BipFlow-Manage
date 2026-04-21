<template>
  <aside class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">Filtros</h2>
        <button
          type="button"
          @click="clearAllFilters"
          class="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          :disabled="!hasActiveFilters"
          aria-label="Limpar todos os filtros"
        >
          Limpar filtros
        </button>
      </div>

      <!-- Search Input -->
      <div>
        <label for="search" class="block text-sm font-medium text-gray-700 mb-2">
          Buscar produtos
        </label>
        <div class="relative">
          <input
            id="search"
            v-model="localFilters.search"
            type="text"
            placeholder="Digite o nome do produto..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            aria-label="Buscar produtos por nome"
            @input="handleSearchInput"
          />
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Category Filter -->
      <div>
        <label for="category" class="block text-sm font-medium text-gray-700 mb-2">
          Categoria
        </label>
        <select
          id="category"
          v-model="localFilters.categoryId"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          aria-label="Filtrar por categoria"
          @change="applyFilters"
        >
          <option value="">Todas as categorias</option>
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}
          </option>
        </select>
      </div>

      <!-- Price Range Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Faixa de preço
        </label>
        <div class="space-y-3">
          <!-- Min Price -->
          <div>
            <label for="minPrice" class="block text-xs text-gray-600 mb-1">
              Preço mínimo
            </label>
            <input
              id="minPrice"
              v-model.number="localFilters.priceMin"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              aria-label="Preço mínimo"
              @input="applyFilters"
            />
          </div>

          <!-- Max Price -->
          <div>
            <label for="maxPrice" class="block text-xs text-gray-600 mb-1">
              Preço máximo
            </label>
            <input
              id="maxPrice"
              v-model.number="localFilters.priceMax"
              type="number"
              min="0"
              step="0.01"
              placeholder="999,99"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              aria-label="Preço máximo"
              @input="applyFilters"
            />
          </div>
        </div>
      </div>

      <!-- Availability Filter -->
      <div>
        <label class="flex items-center">
          <input
            v-model="localFilters.inStockOnly"
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
            aria-label="Mostrar apenas produtos em estoque"
            @change="applyFilters"
          />
          <span class="ml-2 text-sm text-gray-700">Apenas produtos em estoque</span>
        </label>
      </div>

      <!-- Active Filters Summary -->
      <div v-if="hasActiveFilters" class="pt-4 border-t border-gray-200">
        <h3 class="text-sm font-medium text-gray-900 mb-2">Filtros ativos:</h3>
        <div class="flex flex-wrap gap-2">
          <span
            v-if="localFilters.search"
            class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
          >
            Busca: "{{ localFilters.search }}"
            <button
              type="button"
              @click="removeSearchFilter"
              class="ml-1 hover:bg-blue-200 rounded-full p-0.5"
              aria-label="Remover filtro de busca"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </span>

          <span
            v-if="localFilters.categoryId"
            class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
          >
            Categoria: {{ getCategoryName(localFilters.categoryId) }}
            <button
              type="button"
              @click="removeCategoryFilter"
              class="ml-1 hover:bg-green-200 rounded-full p-0.5"
              aria-label="Remover filtro de categoria"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </span>

          <span
            v-if="localFilters.priceMin || localFilters.priceMax"
            class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800"
          >
            Preço: {{ formatPriceRange() }}
            <button
              type="button"
              @click="removePriceFilter"
              class="ml-1 hover:bg-purple-200 rounded-full p-0.5"
              aria-label="Remover filtro de preço"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </span>

          <span
            v-if="localFilters.inStockOnly"
            class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800"
          >
            Em estoque
            <button
              type="button"
              @click="removeStockFilter"
              class="ml-1 hover:bg-orange-200 rounded-full p-0.5"
              aria-label="Remover filtro de estoque"
            >
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ProductFilterCategory, ProductFilters } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

// Props
const props = defineProps<{
  filters: ProductFilters
  categories: ProductFilterCategory[]
}>()

// Emits
const emit = defineEmits<{
  updateFilters: [filters: Partial<ProductFilters>]
  clearFilters: []
}>()

// Local filters state
const localFilters = ref<ProductFilters>({ ...props.filters })

const normalizeFilters = (): ProductFilters => ({
  search: localFilters.value.search?.trim() || '',
  categoryId: typeof localFilters.value.categoryId === 'number'
    ? localFilters.value.categoryId
    : undefined,
  priceMin: typeof localFilters.value.priceMin === 'number'
    ? localFilters.value.priceMin
    : undefined,
  priceMax: typeof localFilters.value.priceMax === 'number'
    ? localFilters.value.priceMax
    : undefined,
  inStockOnly: Boolean(localFilters.value.inStockOnly),
})

// Computed
const hasActiveFilters = computed(() => {
  return !!(
    localFilters.value.search?.trim() ||
    localFilters.value.categoryId ||
    localFilters.value.priceMin ||
    localFilters.value.priceMax ||
    localFilters.value.inStockOnly
  )
})

// Watch for prop changes
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters }
}, { deep: true })

// Methods
const handleSearchInput = () => {
  // Debounced by parent component
  emit('updateFilters', { search: normalizeFilters().search })
}

const applyFilters = () => {
  emit('updateFilters', normalizeFilters())
}

const clearAllFilters = () => {
  localFilters.value = {
    search: '',
    categoryId: undefined,
    priceMin: undefined,
    priceMax: undefined,
    inStockOnly: false,
  }
  emit('clearFilters')
}

const removeSearchFilter = () => {
  localFilters.value.search = ''
  emit('updateFilters', { search: '' })
}

const removeCategoryFilter = () => {
  localFilters.value.categoryId = undefined
  emit('updateFilters', { categoryId: undefined })
}

const removePriceFilter = () => {
  localFilters.value.priceMin = undefined
  localFilters.value.priceMax = undefined
  emit('updateFilters', { priceMin: undefined, priceMax: undefined })
}

const removeStockFilter = () => {
  localFilters.value.inStockOnly = false
  emit('updateFilters', { inStockOnly: false })
}

const getCategoryName = (categoryId: number | undefined): string => {
  if (!categoryId) return ''
  const category = props.categories.find(c => c.id === categoryId)
  return category?.name || 'Desconhecida'
}

const formatPriceRange = (): string => {
  const min = localFilters.value.priceMin
  const max = localFilters.value.priceMax

  if (min && max) {
    return `${formatBRL(min)} - ${formatBRL(max)}`
  } else if (min) {
    return `A partir de ${formatBRL(min)}`
  } else if (max) {
    return `Até ${formatBRL(max)}`
  }

  return ''
}
</script>
