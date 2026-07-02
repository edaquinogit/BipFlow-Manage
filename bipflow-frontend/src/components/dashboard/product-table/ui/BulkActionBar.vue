<script setup lang="ts">
import { ref, computed } from 'vue';
import { XMarkIcon, TagIcon, CheckIcon } from '@heroicons/vue/24/outline';
import type { Category } from '@/schemas/category.schema';

/**
 * 🛰️ COMPONENT CONTRACT
 */
const props = defineProps<{
  selectedCount: number;
  categories: Category[];
  isUpdating?: boolean;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'confirm-bulk-update', categoryId: number): void;
}>();

/**
 * 🛡️ VALIDATION GUARD
 */
const hasValidSelection = computed(() => props.selectedCount > 0);
const hasCategories = computed(() => props.categories && props.categories.length > 0);

/**
 * 🎨 NYC STATION THEME UTILITIES
 */
const getGlowClass = (isActive: boolean) => {
  return isActive ? 'shadow-lg shadow-[#D81B60]/15' : '';
};

/**
 * 📊 LOCAL STATE
 */
const selectedCategoryId = ref<number | null>(null);
const hasSelectedCategory = computed(() => selectedCategoryId.value !== null);

/**
 * 🚀 ACTIONS
 */
const handleCategorySelect = (categoryId: number) => {
  selectedCategoryId.value = categoryId;
};

const handleConfirm = () => {
  if (selectedCategoryId.value) {
    emit('confirm-bulk-update', selectedCategoryId.value);
  }
};
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 transform translate-y-4 scale-95"
    enter-to-class="opacity-100 transform translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 transform translate-y-0 scale-100"
    leave-to-class="opacity-0 transform -translate-y-2 scale-95"
  >
    <div
      v-if="hasValidSelection"
      class="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 transform -translate-x-1/2 z-50"
      :class="getGlowClass(true)"
    >
      <div class="bg-white/95 backdrop-blur-xl border border-[#E5E7EB] rounded-2xl px-6 py-4 shadow-2xl shadow-black/10">
        <div class="flex items-center gap-6">

          <!-- Selection Count -->
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-[#FCE7F3] border border-[#D81B60]/30 flex items-center justify-center">
              <span class="text-xs font-black text-[#D81B60]">{{ selectedCount }}</span>
            </div>
            <span class="text-sm font-bold text-[#05050A] uppercase tracking-wide">
              {{ selectedCount }} produto{{ selectedCount === 1 ? '' : 's' }} selecionado{{ selectedCount === 1 ? '' : 's' }}
            </span>
          </div>

          <!-- Category Selector -->
          <div v-if="hasCategories" class="flex items-center gap-3">
            <TagIcon class="w-5 h-5 text-bip-muted" />
            <select
              v-model="selectedCategoryId"
              @change="(e) => handleCategorySelect(parseInt((e.target as HTMLSelectElement).value))"
              :disabled="isUpdating"
              class="bg-white border border-[#D1D5DB] rounded-lg px-4 py-2 text-sm font-medium text-[#05050A] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] focus:border-[#D81B60] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled selected>Escolher categoria</option>
              <option
                v-for="category in categories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
          </div>

          <!-- Confirm Button -->
          <button
            v-if="hasSelectedCategory"
            @click="handleConfirm"
            :disabled="isUpdating"
            class="flex items-center gap-2 px-4 py-2 bg-[#D81B60] hover:bg-[#D81B60]/90 border border-[#D81B60]/50 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon class="w-4 h-4" />
            <span class="uppercase tracking-wide">Confirmar</span>
          </button>

          <!-- Loading State -->
          <div v-if="isUpdating" class="flex items-center gap-2">
            <div class="w-4 h-4 border-2 border-[#D81B60] border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-bip-muted font-medium uppercase tracking-wider">Atualizando...</span>
          </div>

          <!-- Cancel Button -->
          <button
            @click="emit('cancel')"
            :disabled="isUpdating"
            class="flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-50 border border-[#E5E7EB] rounded-lg text-sm font-medium text-bip-muted hover:text-[#05050A] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon class="w-4 h-4" />
            <span class="uppercase tracking-wide">Cancelar</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Custom scrollbar for select dropdown */
select::-webkit-scrollbar {
  width: 6px;
}

select::-webkit-scrollbar-track {
  background: rgba(229, 231, 235, 0.5);
  border-radius: 3px;
}

select::-webkit-scrollbar-thumb {
  background: rgba(216, 27, 96, 0.4);
  border-radius: 3px;
}

select::-webkit-scrollbar-thumb:hover {
  background: rgba(216, 27, 96, 0.6);
}
</style>
