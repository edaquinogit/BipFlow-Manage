<template>
  <nav
    v-if="totalPages > 1"
    class="flex items-center justify-between border-y border-[#E5E7EB] py-4"
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
          ? 'border border-[#D1D5DB] bg-white text-[#05050A] hover:border-[#D81B60] hover:text-[#D81B60]'
          : 'cursor-not-allowed border border-[#E5E7EB] bg-[#F4F1F3] text-[#9CA3AF]'"
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
          ? 'border border-[#D1D5DB] bg-white text-[#05050A] hover:border-[#D81B60] hover:text-[#D81B60]'
          : 'cursor-not-allowed border border-[#E5E7EB] bg-[#F4F1F3] text-[#9CA3AF]'"
        aria-label="Próxima página"
      >
        Próxima
      </button>
    </div>

    <!-- Desktop pagination -->
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-[#6B7280]">
          {{ showingRange }}
        </p>
      </div>

      <div>
        <nav class="isolate inline-flex -space-x-px rounded-lg" aria-label="Paginação">
          <!-- Previous button -->
          <button
            type="button"
            @click="previousPage"
            :disabled="!hasPreviousPage"
            class="relative inline-flex items-center rounded-l-lg px-2 py-2 text-[#6B7280] ring-1 ring-inset ring-[#D1D5DB] transition-colors hover:bg-white hover:text-[#D81B60] focus:z-20 focus:outline-offset-0"
            :class="{ 'cursor-not-allowed': !hasPreviousPage }"
            aria-label="Página anterior"
          >
            <span class="sr-only">Anterior</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Page numbers -->
          <template v-for="(item, index) in visiblePages">
            <span
              v-if="item === ELLIPSIS"
              :key="`ellipsis-${index}`"
              class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-[#9CA3AF] ring-1 ring-inset ring-[#D1D5DB]"
              aria-hidden="true"
            >
              &hellip;
            </span>
            <button
              v-else
              :key="`page-${index}`"
              type="button"
              @click="goToPage(item)"
              class="relative inline-flex items-center px-4 py-2 text-sm font-semibold transition-colors"
              :class="item === currentPage
                ? 'z-10 bg-[#05050A] text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81B60]'
                : 'text-[#05050A] ring-1 ring-inset ring-[#D1D5DB] hover:bg-white hover:text-[#D81B60] focus:z-20 focus:outline-offset-0'"
              :aria-label="`Ir para página ${item}`"
              :aria-current="item === currentPage ? 'page' : undefined"
            >
              {{ item }}
            </button>
          </template>

          <!-- Next button -->
          <button
            type="button"
            @click="nextPage"
            :disabled="!hasNextPage"
            class="relative inline-flex items-center rounded-r-lg px-2 py-2 text-[#6B7280] ring-1 ring-inset ring-[#D1D5DB] transition-colors hover:bg-white hover:text-[#D81B60] focus:z-20 focus:outline-offset-0"
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
import { buildVisiblePages, ELLIPSIS } from './paginationRange'
import type { PaginationItem } from './paginationRange'

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
const visiblePages = computed<PaginationItem[]>(() =>
  buildVisiblePages(props.currentPage, props.totalPages)
)

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
