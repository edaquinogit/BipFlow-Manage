<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useCategories } from '@/composables/useCategories';
import { useToast } from '@/composables/useToast';
import CategoryForm from '@/components/dashboard/category-form/CategoryForm.vue';
import type { Category } from '@/schemas/category.schema';

/**
 * --- 1. CORE ENGINE (Infrastructure) ---
 */
const {
  categories,
  loading: isFetching,
  fetchCategories,
  addCategory,
  deleteCategory
} = useCategories();

const { success, error: toastError } = useToast();

/**
 * --- 2. UI STATE MANAGEMENT ---
 */
const isPanelOpen = ref(false);
const isSaving = ref(false);
const activeError = ref<string | null>(null);

// Computed para estado de "Empty State" - Melhora a legibilidade do template
const hasNoData = computed(() => categories.value.length === 0 && !isFetching.value);

/**
 * --- 3. DOMAIN ACTIONS (Handlers) ---
 */

const togglePanel = (state: boolean) => {
  isPanelOpen.value = state;
  if (state) activeError.value = null; // Limpa erros ao abrir
};

const handleSaveCategory = async (categoryData: Partial<Category>) => {
  try {
    isSaving.value = true;
    activeError.value = null;

    await addCategory(categoryData);

    togglePanel(false);
    success('Categoria criada com sucesso.');
  } catch (err) {
    activeError.value = "Nao foi possivel sincronizar com o BipFlow. Verifique os dados.";
    toastError('Nao foi possivel salvar a categoria.');
  } finally {
    isSaving.value = false;
  }
};

const confirmDeletion = async (id: number | undefined) => {
  if (!id) return;

  const confirmed = confirm("SECURITY CHECK: Are you sure you want to remove this record?");
  if (confirmed) {
    try {
      await deleteCategory(id);
      success('Categoria removida com sucesso.');
    } catch (err) {
      toastError('Nao foi possivel remover a categoria.');
    }
  }
};

/**
 * --- 4. LIFECYCLE ---
 */
onMounted(async () => {
  await fetchCategories();
});
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30">
    <main class="max-w-7xl mx-auto px-6 py-12 space-y-12">

      <header class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div class="space-y-1">
          <h2 class="text-5xl font-black text-white tracking-tighter italic uppercase leading-none">
            Categories
          </h2>
          <div class="flex items-center gap-2">
             <span class="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]"></span>
             <p class="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">
               Inventory Classification Engine v1.0
             </p>
          </div>
        </div>

        <button
          @click="togglePanel(true)"
          class="group relative bg-white text-black px-10 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all active:scale-95 overflow-hidden"
        >
          <span class="relative z-10">+ New Category</span>
        </button>
      </header>

      <section class="relative bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl">

        <div v-if="isFetching" class="absolute inset-0 z-20 bg-zinc-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div class="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-[10px] text-zinc-400 font-black uppercase tracking-[0.3em] animate-pulse">Syncing NYC Hub...</p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-zinc-900/80 border-b border-white/5">
              <tr>
                <th class="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Category Detail</th>
                <th class="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Description</th>
                <th class="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-white/5">
              <tr
                v-for="cat in categories"
                :key="cat.id"
                class="hover:bg-indigo-500/5 transition-colors group"
              >
                <td class="px-8 py-6">
                  <div class="space-y-1">
                    <p class="font-bold text-white text-lg tracking-tight group-hover:text-indigo-400 transition-colors">
                      {{ cat.name }}
                    </p>
                    <p class="font-mono text-[9px] text-zinc-600 uppercase tracking-tighter">
                      ID: {{ cat.id }} // SLUG: {{ cat.slug || 'pending' }}
                    </p>
                  </div>
                </td>

                <td class="px-8 py-6 text-zinc-400 text-sm max-w-md font-medium">
                  <span v-if="cat.description" class="line-clamp-2 leading-relaxed italic">
                    "{{ cat.description }}"
                  </span>
                  <span v-else class="text-zinc-700 uppercase text-[10px] font-black">
                    No context provided
                  </span>
                </td>

                <td class="px-8 py-6 text-right">
                  <div class="flex justify-end gap-6 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button class="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest">
                      Edit
                    </button>
                    <button
                      @click="confirmDeletion(cat.id)"
                      class="text-zinc-700 hover:text-red-500 text-[10px] font-black uppercase tracking-widest"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="hasNoData" class="p-32 text-center border-t border-white/5">
          <div class="inline-block p-4 rounded-full bg-zinc-950 mb-4 border border-white/5">
            <svg class="w-8 h-8 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p class="text-zinc-700 uppercase font-black tracking-[0.5em] text-[10px]">
            Registry Empty / Waiting for Entry
          </p>
        </div>
      </section>
    </main>

    <CategoryForm
      :is-open="isPanelOpen"
      :is-saving="isSaving"
      :error-message="activeError"
      @close="togglePanel(false)"
      @save="handleSaveCategory"
    />
  </div>
</template>
