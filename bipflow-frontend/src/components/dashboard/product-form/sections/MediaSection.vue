<script setup lang="ts">
/**
 * 🛰️ BIPFLOW MEDIA HUB - ASSET VISUALIZATION
 * Padrão de Engenharia: Vue 3.4+ Atomic Synchronization
 * Foco: Upload Binário, Preview Reativo e Memory Leak Prevention.
 */
import { ref, watch, onUnmounted } from 'vue';

// modelValue: Sincroniza o arquivo (File) ou URL (string) com o Root
const modelValue = defineModel<string | File | null>();

interface Props {
  error?: string;
}

defineProps<Props>();

const imagePreview = ref<string | null>(null);

/**
 * 🧠 INTELLIGENT PREVIEW ENGINE
 * Resolve URLs do backend ou gera previews locais para novos uploads.
 */
watch(modelValue, (newValue) => {
  if (!newValue) {
    imagePreview.value = null;
    return;
  }

  // Caso 1: Já é uma string (URL do Cloud/Django)
  if (typeof newValue === 'string') {
    imagePreview.value = newValue;
    return;
  }

  // Caso 2: É um objeto File (Novo upload via input)
  if (newValue instanceof File) {
    if (imagePreview.value?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview.value);
    }
    imagePreview.value = URL.createObjectURL(newValue);
  }
}, { immediate: true });

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    modelValue.value = file;
  }
};

/**
 * 🧹 MEMORY SAFETY (NYC Standard)
 * Evita memory leaks limpando as URLs temporárias do navegador ao destruir o componente.
 */
onUnmounted(() => {
  if (imagePreview.value?.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreview.value);
  }
});
</script>

<template>
  <section class="space-y-6 pb-4">
    <header>
      <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] mb-1">
        Visual Asset
      </h3>
      <p class="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
        Digital twin representation (Max 2MB)
      </p>
    </header>
    
    <div 
      class="relative group h-40 w-full rounded-2xl border-2 border-dashed border-zinc-800 
             hover:border-indigo-500/50 transition-all flex items-center justify-center 
             overflow-hidden bg-zinc-950 cursor-pointer shadow-inner"
      :class="{ 'border-red-500/40 bg-red-500/5': error }"
    >
      <Transition name="fade">
        <img 
          v-if="imagePreview" 
          :src="imagePreview" 
          class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-30 transition-opacity duration-500" 
          data-cy="product-image-preview"
          alt="Product Identity Preview"
        />
      </Transition>
      
      <input 
        type="file" 
        name="image"
        data-cy="input-product-image"
        @change="handleFileChange" 
        accept="image/jpeg, image/png, image/webp" 
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        aria-label="Upload product image"
      />
      
      <div class="text-center z-10 pointer-events-none flex flex-col items-center gap-3">
        <div 
          class="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all duration-300"
          :class="{ 'text-indigo-400 bg-indigo-500/10': imagePreview }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path v-if="!imagePreview" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
        <span class="text-[10px] font-black text-zinc-400 group-hover:text-white transition-colors uppercase tracking-[0.2em]">
          {{ imagePreview ? 'Replace Media Asset' : 'Provision Asset File' }}
        </span>
      </div>
    </div>

    <Transition name="slide-up">
      <p v-if="error" class="text-[9px] text-red-500 font-black uppercase tracking-widest text-center animate-pulse">
        {{ error }}
      </p>
    </Transition>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition: all 0.3s ease-out;
}
.slide-up-enter-from {
  transform: translateY(10px);
  opacity: 0;
}
</style>