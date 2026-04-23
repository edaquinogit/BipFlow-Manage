<template>
  <nav
    v-if="totalPages > 1"
    class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 rounded-lg shadow-sm"
    aria-label="Paginação de produtos"
  >
    <!-- Mobile pagination -->
    <div class="flex flex-1 justify-between sm:hidden">
      <button
        type="button"
        @click="previousPage"
        :disabled="!hasPreviousPage"
        class="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
        :class="hasPreviousPage
          ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
          : 'text-gray-400 bg-gray-100 border border-gray-300 cursor-not-allowed'"
        aria-label="Página anterior"
      >
        Anterior
      </button>
      <button
        type="button"
        @click="nextPage"
        :disabled="!hasNextPage"
        class="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
        :class="hasNextPage
          ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
          : 'text-gray-400 bg-gray-100 border border-gray-300 cursor-not-allowed'"
        aria-label="Próxima página"
      >
        Próxima
      </button>
    </div>

    <!-- Desktop pagination -->
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700">
          {{ showingRange }}
        </p>
      </div>

      <div>
        <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Paginação">
          <!-- Previous button -->
          <button
            type="button"
            @click="previousPage"
            :disabled="!hasPreviousPage"
            class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 transition-colors"
            :class="{ 'cursor-not-allowed': !hasPreviousPage }"
            aria-label="Página anterior"
          >
            <span class="sr-only">Anterior</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Page numbers -->
          <button
            type="button"
            v-for="pageNum in visiblePages"
            :key="pageNum"
            @click="goToPage(pageNum)"
            class="relative inline-flex items-center px-4 py-2 text-sm font-semibold transition-colors"
            :class="pageNum === currentPage
              ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'"
            :aria-label="`Ir para página ${pageNum}`"
            :aria-current="pageNum === currentPage ? 'page' : undefined"
          >
            {{ pageNum }}
          </button>

          <!-- Next button -->
          <button
            type="button"
            @click="nextPage"
            :disabled="!hasNextPage"
            class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 transition-colors"
            :class="{ 'cursor-not-allowed': !hasNextPage }"
            aria-label="Próxima página"
          >
            <span class="sr-only">Próxima</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
const props = defineProps<{
  currentPage: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  showingRange: string
}>()

// Emits
const emit = defineEmits<{
  goToPage: [page: number]
  nextPage: []
  previousPage: []
}>()

// Computed
const visiblePages = computed(() => {
  const current = props.currentPage
  const total = props.totalPages
  const delta = 2 // Number of pages to show on each side of current page
  const range = []
  const rangeWithDots = []

  // Calculate range
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i)
  }

  if (current - delta > 2) {
    rangeWithDots.push(1, '...')
  } else {
    rangeWithDots.push(1)
  }

  rangeWithDots.push(...range)

  if (current + delta < total - 1) {
    rangeWithDots.push('...', total)
  } else if (total > 1) {
    rangeWithDots.push(total)
  }

  return rangeWithDots.filter(item => typeof item === 'number') as number[]
})

// Methods
const goToPage = (page: number) => {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('goToPage', page)
  }
}

const nextPage = () => {
  if (props.hasNextPage) {
    emit('nextPage')
  }
}

const previousPage = () => {
  if (props.hasPreviousPage) {
    emit('previousPage')
  }
}
</script>
