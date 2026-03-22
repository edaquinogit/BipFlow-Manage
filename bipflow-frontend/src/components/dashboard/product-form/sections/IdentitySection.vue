<script setup lang="ts">
/**
 * 🛰️ BipFlow Registry Hub - Identity Section
 * Padrão de Engenharia: Vue 3.4+ defineModel
 */
import FormInput from '@/components/common/FormInput.vue';

// Definindo modelos reativos sincronizados automaticamente com o Root
const name = defineModel<string>('name', { default: '' });
const sku = defineModel<string>('sku', { default: '' });
const category = defineModel<string | number | null>('category', { default: null });

interface Props {
  categories: Array<{ id: number; name: string }>;
  errors: Record<string, string[]>;
}

defineProps<Props>();
</script>

<template>
  <section class="space-y-6 pb-10 border-b border-zinc-800/50">
    <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] mb-4">
      Identity & Registry
    </h3>
    
    <FormInput 
      label="Asset Name" 
      v-model="name" 
      placeholder="e.g. Premium Hub Gear" 
      :error="errors.name?.[0]" 
    />
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormInput 
        label="Global SKU" 
        v-model="sku" 
        placeholder="NYC-100-BPF" 
        :error="errors.sku?.[0]"
      />

      <div class="flex flex-col group">
        <label class="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-2 group-focus-within:text-indigo-400 transition-colors">
          Classification
        </label>
        
        <div class="relative">
          <select 
            v-model="category"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-4 text-sm text-zinc-100 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer hover:bg-zinc-900 shadow-inner"
          >
            <option :value="null" disabled>Select Hub Taxonomy...</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
          
          <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-indigo-500 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
               <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
             </svg>
          </div>
        </div>

        <p v-if="errors.category" class="text-[9px] text-red-500 font-black uppercase mt-2 tracking-widest animate-pulse">
          {{ errors.category[0] }}
        </p>
      </div>
    </div>
  </section>
</template>