<template>
  <section class="space-y-6 pb-10">
    <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em]">
      Visual Asset (Max 2MB)
    </h3>
    
    <div 
      class="relative group h-32 w-full rounded-xl border-2 border-dashed border-zinc-800 
             hover:border-indigo-500/50 transition-all flex items-center justify-center 
             overflow-hidden bg-zinc-950 cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500"
    >
      <img 
        v-if="imagePreview" 
        :src="imagePreview" 
        class="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-20 transition-opacity duration-300" 
        alt="Product Preview"
      />
      
      <input 
        type="file" 
        @change="handleFileChange" 
        accept="image/jpeg, image/png, image/webp" 
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        aria-label="Upload product image"
      />
      
      <div class="text-center z-0 pointer-events-none flex flex-col items-center gap-2">
        <svg v-if="!imagePreview" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-zinc-600 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span class="text-[10px] font-black text-zinc-400 group-hover:text-indigo-400 transition-colors uppercase tracking-widest">
          {{ imagePreview ? 'Replace Asset Media' : 'Provision File' }}
        </span>
      </div>
    </div>

    <Transition name="fade">
      <p v-if="error" class="text-[9px] text-red-500 font-black uppercase tracking-wider animate-pulse">
        {{ error }}
      </p>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

/**
 * 🛰️ NYC DATA HUB - MODULAR MEDIA
 * modelValue: Pode ser uma URL (string) ou um Arquivo (File)
 */
const modelValue = defineModel<string | File | null>();

defineProps<{
  error?: string;
}>();

const imagePreview = ref<string | null>(null);

/**
 * 🧠 INTELLIGENT PREVIEW ENGINE
 * Sincroniza o estado inicial e lida com objetos de memória (Blob URLs)
 */
watch(modelValue, (newValue) => {
  if (!newValue) {
    imagePreview.value = null;
    return;
  }

  if (typeof newValue === 'string') {
    // Se for string, é uma URL vinda do backend (ex: Django /media/)
    imagePreview.value = newValue.startsWith('http') 
      ? newValue 
      : `http://localhost:8000${newValue.startsWith('/') ? '' : '/'}${newValue}`;
  }
  // Se for File, o preview é gerado no handleFileChange
}, { immediate: true });

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    // Atualiza o v-model para o Root (Zod vai validar o binário)
    modelValue.value = file;

    // Gera preview otimizado usando URL.createObjectURL (mais rápido que FileReader)
    if (imagePreview.value?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview.value); // Limpa memória anterior
    }
    imagePreview.value = URL.createObjectURL(file);
  }
};

// 🧹 MEMORY SAFETY (NYC Best Practice)
onUnmounted(() => {
  if (imagePreview.value?.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreview.value);
  }
});
</script>