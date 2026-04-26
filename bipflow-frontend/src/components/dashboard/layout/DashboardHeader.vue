<script setup lang="ts">
import { 
  Bars3Icon,
  CpuChipIcon, 
  GlobeAmericasIcon 
} from '@heroicons/vue/24/outline';

defineEmits<{
  openMenu: []
}>();
</script>

<template>
  <header class="border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
      
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-3">
          <div class="relative flex items-center justify-center">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 relative"></div>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-[0.2em] text-white italic leading-tight">NYC Station</span>
            <span class="text-[8px] font-bold uppercase tracking-widest text-emerald-500/80">System Live</span>
          </div>
        </div>

        <div class="hidden md:block h-8 border-l border-white/10 mx-2"></div>

        <div class="hidden lg:flex items-center gap-4 text-zinc-500">
          <div class="flex items-center gap-1.5">
            <CpuChipIcon class="w-3.5 h-3.5" />
            <span class="text-[9px] font-bold uppercase tracking-tighter">BipFlow v3.0</span>
          </div>
          <div class="flex items-center gap-1.5">
            <GlobeAmericasIcon class="w-3.5 h-3.5" />
            <span class="text-[9px] font-bold uppercase tracking-tighter">Lat: 24ms</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button 
          type="button"
          class="group inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/60 text-zinc-400 transition-all duration-300 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          aria-label="Abrir menu do dashboard"
          @click="$emit('openMenu')"
        >
          <Bars3Icon class="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>
      </div>

    </div>
  </header>
</template>
