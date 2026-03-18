<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCategories } from '../composables/useCategories';
import CategoryForm from '../components/dashboard/CategoryForm.vue';
import type { Category } from '../schemas/category.schema';

/**
 * --- 1. INFRAESTRUTURA & ENGINE ---
 * Consumimos o motor de categorias do BipFlow
 */
const { 
  categories, 
  loading: isFetching, 
  fetchCategories,
  addCategory,
  deleteCategory 
} = useCategories();

/**
 * --- 2. ESTADO DE UI ---
 */
const isPanelOpen = ref(false);
const isSaving = ref(false);

/**
 * --- 3. AÇÕES (HANDLERS) ---
 */

// Salva nova categoria conectando com o Django via Composable
const handleSave = async (categoryData: Partial<Category>) => {
  try {
    isSaving.value = true;
    
    // Chamada real ao motor do sistema
    await addCategory(categoryData);
    
    // Sucesso: Fecha o painel
    isPanelOpen.value = false;
    console.log("🚀 BipFlow: Registry updated successfully");
  } catch (err) {
    // Se der erro (ex: nome duplicado no Django), o painel continua aberto para correção
    console.error("❌ Registry Error:", err);
    alert("Erro ao salvar categoria. Verifique os dados.");
  } finally {
    isSaving.value = false;
  }
};

// Remove categoria com confirmação (Padrão Profissional)
const handleDelete = async (id: number | undefined) => {
  if (!id) return;
  
  if (confirm("Are you sure you want to remove this classification?")) {
    await deleteCategory(id);
  }
};

onMounted(fetchCategories);
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30">
    <main class="max-w-7xl mx-auto px-6 py-12 space-y-12">
      
      <header class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 class="text-5xl font-black text-white tracking-tighter mb-2 italic uppercase">Categories</h2>
          <div class="flex items-center gap-2">
             <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
             <p class="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Inventory Classification Engine</p>
          </div>
        </div>
        <button 
          @click="isPanelOpen = true" 
          class="bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl shadow-white/5"
        >
          + New Category
        </button>
      </header>

      <section class="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-sm shadow-inner">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-zinc-900/80 border-b border-white/5">
              <tr>
                <th class="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Category Detail</th>
                <th class="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Description</th>
                <th class="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right font-mono">Actions</th>
              </tr>
            </thead>
            
            <tbody class="divide-y divide-white/5">
              <tr v-for="cat in categories" :key="cat.id" class="hover:bg-white hover:bg-opacity-[0.02] transition-colors group">
                <td class="px-8 py-6">
                  <p class="font-bold text-white text-lg tracking-tight">{{ cat.name }}</p>
                  <p class="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">{{ cat.slug || 'generating...' }}</p>
                </td>
                <td class="px-8 py-6 text-zinc-400 text-sm max-w-md truncate font-medium">
                  {{ cat.description || '— No context provided —' }}
                </td>
                <td class="px-8 py-6 text-right">
                  <div class="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Edit</button>
                    <button 
                      @click="handleDelete(cat.id)"
                      class="text-zinc-700 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="isFetching" class="p-24 flex flex-col items-center justify-center gap-4">
          <div class="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em]">Syncing NYC Hub...</p>
        </div>

        <div v-if="categories.length === 0 && !isFetching" class="p-32 text-center border-t border-white/5">
          <p class="text-zinc-700 uppercase font-black tracking-[0.5em] text-[10px]">Registry Empty / Waiting for Entry</p>
        </div>
      </section>
    </main>

    <CategoryForm 
      :is-open="isPanelOpen" 
      :is-saving="isSaving"
      @close="isPanelOpen = false"
      @save="handleSave"
    />
  </div>
</template>