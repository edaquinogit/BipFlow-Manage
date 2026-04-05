<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';

/**
 * 🛰️ BipFlow Registry Interface
 */
interface AvatarProps {
  image?: string | File | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<AvatarProps>(), {
  image: null,
  size: 'md'
});

// ==========================================
// 1. INFRASTRUCTURE & CONSTANTS
// ==========================================
// Fallback inteligente para garantir que nunca fiquemos sem a URL do Backend
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// ==========================================
// 2. REACTIVE STATE (TELEMETRY)
// ==========================================
const hasError = ref<boolean>(false);
const cacheNonce = ref<number>(Date.now());
const objectUrl = ref<string | null>(null);

// ==========================================
// 3. MEMORY MANAGEMENT (NYC CLEANUP)
// ==========================================
const releaseMemory = (): void => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
};

onUnmounted(releaseMemory);

// ==========================================
// 4. THE RESOLVER (A Lógica que "Aparece" a Foto)
// ==========================================
const resolvedUrl = computed<string | null>(() => {
  if (hasError.value || !props.image) return null;

  // 🚀 CASO A: Preview Local (Upload de Arquivo)
  if (props.image instanceof File) {
    return objectUrl.value;
  }

  // 🌍 CASO B: Asset Remoto (String do Banco de Dados)
  if (typeof props.image === 'string') {
    // Se a string já for uma URL completa, não mexemos nela
    if (props.image.startsWith('http') || props.image.startsWith('blob:')) {
      return props.image;
    }

    // Garante que o path comece com / mas não duplique
    const cleanPath = props.image.startsWith('/') ? props.image : `/${props.image}`;
    
    // Concatenação robusta: evita http://localhost:8000//media
    const fullUrl = `${BASE_URL}${cleanPath}`;
    
    // Cache Busting: Importante para refletir trocas de imagem no Dashboard
    const separator = fullUrl.includes('?') ? '&' : '?';
    return `${fullUrl}${separator}v=${cacheNonce.value}`;
  }

  return null;
});

const fallbackInitials = computed<string>(() => {
  if (!props.name) return '??';
  return props.name.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase();
});

// ==========================================
// 5. OBSERVERS
// ==========================================
watch(() => props.image, (newImage) => {
  hasError.value = false;
  // Só atualizamos o Nonce se for String (URL), para evitar flickering em Files
  if (typeof newImage === 'string') cacheNonce.value = Date.now();
  
  if (newImage instanceof File) {
    releaseMemory();
    objectUrl.value = URL.createObjectURL(newImage);
  } else {
    releaseMemory();
  }
}, { immediate: true });

const onImageError = (e: Event): void => {
  const target = e.target as HTMLImageElement;
  console.warn(`[BipFlow] Asset broken at: ${target.src}. Switching to initials.`);
  hasError.value = true;
};
</script>

<template>
  <div 
    class="relative flex-none overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-inner group transition-all duration-300"
    :class="{
      'h-8 w-8': size === 'sm',
      'h-11 w-11': size === 'md',
      'h-20 w-20': size === 'lg'
    }"
  >
    <transition name="fade" mode="out-in">
      <img 
        v-if="resolvedUrl" 
        :key="resolvedUrl"
        :src="resolvedUrl" 
        @error="onImageError"
        class="absolute inset-0 h-full w-full object-cover z-10 transition-transform duration-500 group-hover:scale-110" 
        loading="eager" 
        fetchpriority="high"
      />

      <div 
        v-else
        class="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-500 font-black uppercase italic select-none"
        :class="size === 'lg' ? 'text-lg' : 'text-[10px]'"
      >
        {{ fallbackInitials }}
      </div>
    </transition>

    <div class="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/5 rounded-lg z-20" />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>