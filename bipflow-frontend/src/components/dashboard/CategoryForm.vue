<script setup lang="ts">
/**
 * 🛰️ BIPFLOW REGISTRY HUB - CATEGORY CLASSIFICATION
 */
import { ref } from 'vue';
import FormInput from '@/components/common/FormInput.vue';

interface Props {
  isOpen: boolean;
  isSaving: boolean;
  errors?: Record<string, string[]>;
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'save']);

// Estado inicial reativo e estrito
const form = ref({
  name: '',
  description: ''
});

const handleSubmit = () => {
  if (!form.value.name || form.value.name.length < 2) return;
  emit('save', { ...form.value });
  form.value = { name: '', description: '' };
};

const handleClose = () => {
  form.value = { name: '', description: '' };
  emit('close');
};
</script>

<template>
  <Transition name="slide-panel">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
      
      <div 
        class="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" 
        @click="handleClose" 
      />
      
      <aside class="relative w-full max-w-lg bg-zinc-950 border-l border-zinc-800/50 p-10 shadow-2xl flex flex-col h-full overflow-y-auto">
        <header class="mb-12">
          <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] mb-2">Taxonomy Engine</h3>
          <h2 class="text-4xl font-black text-white uppercase tracking-tighter italic">Registry</h2>
        </header>
        
        <form @submit.prevent="handleSubmit" class="space-y-10 flex-1 flex flex-col">
          <FormInput 
            label="Classification Name" 
            v-model="form.name" 
            name="category-name"
            data-cy="input-category-name"
            placeholder="Luxury Goods..." 
            :error="errors?.name?.[0]"
          />
          
          <div class="space-y-3 group">
            <label class="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] group-focus-within:text-indigo-400 transition-colors">
              Context / Description
            </label>
            <textarea 
              v-model="form.description"
              name="category-description"
              data-cy="input-category-description"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 h-44 resize-none transition-all shadow-inner" 
            />
          </div>

          <div class="mt-auto pt-10">
            <button 
              type="submit"
              :disabled="isSaving || form.name.length < 2"
              data-cy="btn-confirm-category"
              class="w-full bg-white text-black font-black uppercase text-[11px] tracking-[0.2em] py-5 rounded-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-20"
            >
              {{ isSaving ? 'Processing...' : 'Confirm Creation' }}
            </button>
          </div>
        </form>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.slide-panel-enter-active, .slide-panel-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-panel-enter-from, .slide-panel-leave-to {
  transform: translateX(100%);
}
</style>