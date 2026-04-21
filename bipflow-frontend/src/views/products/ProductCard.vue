<template>
  <article
    class="group relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden"
    :class="{ 'opacity-75': !product.is_available }"
  >
    <!-- Product Image -->
    <div class="aspect-square overflow-hidden bg-gray-50">
      <img
        :src="imageSource"
        :alt="`Imagem do produto ${product.name}`"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        loading="lazy"
        @error="handleImageError"
      />

      <!-- Out of stock overlay -->
      <div
        v-if="!product.is_available"
        class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      >
        <span class="text-white font-medium text-sm bg-red-600 px-3 py-1 rounded-full">
          Fora de estoque
        </span>
      </div>
    </div>

    <!-- Product Info -->
    <div class="p-4">
      <!-- Category Badge -->
      <div class="mb-2">
        <span
          class="inline-block px-2 py-1 text-xs font-medium rounded-full"
          :class="getCategoryColor(product.category.name)"
        >
          {{ product.category.name }}
        </span>
      </div>

      <!-- Product Name -->
      <h3 class="font-semibold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
        {{ product.name }}
      </h3>

      <!-- Price and Stock Status -->
      <div class="flex items-center justify-between">
        <span class="text-xl font-bold text-gray-900">
          {{ formatBRL(product.price) }}
        </span>

        <div class="flex items-center space-x-1">
          <div
            class="w-2 h-2 rounded-full"
            :class="product.is_available ? 'bg-green-500' : 'bg-red-500'"
            aria-hidden="true"
          ></div>
          <span
            class="text-sm font-medium"
            :class="product.is_available ? 'text-green-700' : 'text-red-700'"
          >
            {{ product.is_available ? 'Em estoque' : 'Fora de estoque' }}
          </span>
        </div>
      </div>

      <!-- Stock Quantity (only show if low stock) -->
      <div
        v-if="product.is_available && product.stock_quantity <= 10"
        class="mt-2 text-sm text-orange-600 font-medium"
      >
        Apenas {{ product.stock_quantity }} restantes
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

// Props
const props = defineProps<{
  product: Product
}>()

const FALLBACK_IMAGE_URL = 'https://via.placeholder.com/540x540?text=Imagem+indispon%C3%ADvel'

const imageSource = computed(() => props.product.image || FALLBACK_IMAGE_URL)

// Image error handler
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = FALLBACK_IMAGE_URL
}

// Category color mapping
const getCategoryColor = (categoryName: string): string => {
  const colors: Record<string, string> = {
    'Roupas': 'bg-blue-100 text-blue-800',
    'Eletrônicos': 'bg-green-100 text-green-800',
    'Casa': 'bg-purple-100 text-purple-800',
    'Esportes': 'bg-orange-100 text-orange-800',
    'Livros': 'bg-yellow-100 text-yellow-800',
  }

  return colors[categoryName] || 'bg-gray-100 text-gray-800'
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
