<script setup lang="ts">
import type { Component } from 'vue';

interface Props {
  label: string;
  value: string | number;
  icon: Component;
  color?: 'indigo' | 'orange' | 'emerald' | 'rose';
}

// Default values seguindo Clean Code
const props = withDefaults(defineProps<Props>(), {
  color: 'indigo'
});

// Mapeamento de cores para manter o CSS limpo no template
const colorMap = {
  indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
};
</script>

<template>
  <div class="group relative overflow-hidden bg-zinc-900/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-md transition-all duration-500 hover:border-white/10 hover:bg-zinc-900/60">
    
    <div class="absolute -right-10 -top-10 w-32 h-32 bg-white/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

    <div class="flex justify-between items-start mb-8 relative z-10">
      <div :class="['p-4 rounded-2xl border transition-all duration-500 group-hover:scale-110 shadow-lg', colorMap[props.color]]">
        <component :is="icon" class="w-6 h-6" />
      </div>
      
      <span class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950 border border-white/5">
        <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Live</span>
      </span>
    </div>
    
    <div class="relative z-10">
      <p class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-2">{{ label }}</p>
      <h3 class="text-5xl font-black text-white tracking-tighter italic transition-all duration-500 group-hover:translate-x-1">
        {{ value }}
      </h3>
    </div>
  </div>
</template>