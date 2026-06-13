<script setup lang="ts">
import { computed } from 'vue';
import { 
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  ShoppingBagIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps<{
  userName: string | null
}>();

defineEmits<{
  openMenu: []
}>();

const welcomeMessage = computed(() => (
  props.userName ? `Bem-vindo, ${props.userName}` : 'Bem-vindo'
));

const BRAND_LOGO_URL = '/brand-logo.png';
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-rose-500/10 bg-[#05050A]/90 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
      
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-3">
          <div class="flex h-12 w-32 shrink-0 items-center justify-center overflow-hidden">
            <img
              :src="BRAND_LOGO_URL"
              alt="KN Boutique Fitness"
              class="h-full w-full object-contain"
            />
          </div>
          <div class="flex flex-col">
            <span class="brand-wordmark brand-wordmark-premium-dark text-lg">KN Boutique Fitness</span>
            <span class="text-[8px] font-bold uppercase tracking-widest text-rose-400/90">Dashboard da vitrine</span>
          </div>
        </div>

        <div class="hidden md:block h-8 border-l border-rose-500/15 mx-2"></div>

        <div class="hidden lg:flex items-center gap-4 text-zinc-400">
          <div class="flex items-center gap-1.5">
            <ShoppingBagIcon class="w-3.5 h-3.5" />
            <span class="text-[9px] font-bold uppercase tracking-tighter">Vitrine</span>
          </div>
          <div class="flex items-center gap-1.5">
            <ChatBubbleLeftRightIcon class="w-3.5 h-3.5" />
            <span class="text-[9px] font-bold uppercase tracking-tighter">Atendimento</span>
          </div>
        </div>
      </div>

      <div class="flex min-w-0 items-center gap-3 sm:gap-4">
        <div class="flex min-w-0 flex-col items-end">
          <span class="hidden text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 sm:block">
            Operador
          </span>
          <span class="max-w-[8rem] truncate text-xs font-bold text-white sm:max-w-[13rem] sm:text-sm">
            {{ welcomeMessage }}
          </span>
        </div>

        <button 
          type="button"
          class="group inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/20 bg-white/[0.03] text-zinc-300 transition-all duration-300 hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          aria-label="Abrir menu do dashboard"
          @click="$emit('openMenu')"
        >
          <Bars3Icon class="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>
      </div>

    </div>
  </header>
</template>
