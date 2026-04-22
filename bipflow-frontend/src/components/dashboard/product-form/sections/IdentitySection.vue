<script setup lang="ts">
/**
 * 🛰️ BIPFLOW REGISTRY HUB - IDENTITY SECTION
 * Padrão de Engenharia: Vue 3.4+ Atomic Synchronization
 */
import FormInput from '@/components/common/FormInput.vue';

/**
 * 🔄 TWO-WAY BINDING (Vue 3.4+)
 * Sincroniza automaticamente com o v-model do componente pai (ProductFormRoot).
 */
const name = defineModel<string>('name', { default: '' });
const sku = defineModel<string>('sku', { default: '' });
const description = defineModel<string>('description', { default: '' });
const category = defineModel<string | number | null>('category', { default: null });

interface Props {
  categories: Array<{ id: number; name: string }>;
  errors: Record<string, string[]>;
}

defineProps<Props>();
</script>

<template>
  <section class="space-y-8 pb-10 border-b border-zinc-800/50">
    <header>
      <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] mb-1">
        Identity & Registry
      </h3>
      <p class="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
        Asset classification and global naming
      </p>
    </header>
    
    <FormInput 
      label="Asset Name" 
      v-model="name" 
      name="name"
      data-cy="input-product-name"
      placeholder="e.g. Premium Hub Gear" 
      :error="errors.name?.[0]" 
    />
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <FormInput 
        label="Global SKU" 
        v-model="sku" 
        name="sku"
        data-cy="input-product-sku"
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
            name="category"
            data-cy="select-category"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer hover:bg-zinc-900 shadow-inner"
          >
            <option :value="null" disabled>Select Hub Taxonomy...</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
          
          <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-indigo-500 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
               <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
             </svg>
          </div>
        </div>

        <p v-if="errors.category" class="text-[9px] text-red-500 font-black uppercase mt-2 tracking-widest animate-pulse">
          {{ errors.category[0] }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2 group">
      <label class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] group-focus-within:text-indigo-400 transition-colors">
        Public Description
      </label>
      <textarea
        v-model="description"
        name="description"
        data-cy="input-product-description"
        rows="4"
        class="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-zinc-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all outline-none placeholder:text-zinc-700 shadow-inner resize-none"
        placeholder="Describe the product for the public storefront: ingredients, materials, diferencials or usage details."
      />
      <p v-if="errors.description" class="text-[9px] text-red-500 font-black uppercase tracking-widest animate-pulse">
        {{ errors.description[0] }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Estilização focada em UX para o estado de erro do select */
select:invalid {
  color: #52525b;
}

/* Garante que o dropdown acompanhe o estilo do app em sistemas modernos */
option {
  background-color: #09090b;
  color: #fafafa;
}
</style>
