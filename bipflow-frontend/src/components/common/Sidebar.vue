<script setup lang="ts">
import { useRoute } from 'vue-router';
import { navigationItems } from '../../config/navigation';

const route = useRoute();

// Função para verificar se a rota está ativa (Clean Code)
const isActive = (path: string) => route.path === path;
</script>

<template>
  <aside class="w-72 min-h-screen bg-zinc-950/80 backdrop-blur-xl border-r border-white/5 flex flex-col p-6 sticky top-0 z-40 transition-all duration-500">
  
  <div class="mb-12 px-2 group cursor-default">
    <h1 class="text-2xl font-black text-white tracking-tighter italic uppercase transition-all duration-300 group-hover:tracking-normal">
      Bip<span class="text-indigo-500 transition-colors duration-300 group-hover:text-white">Flow</span>
    </h1>
    
    <div class="flex items-center gap-2 mt-1">
      <span class="w-1 h-1 rounded-full bg-indigo-500 group-hover:animate-ping"></span>
      <p class="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em] transition-colors group-hover:text-zinc-400">
        NYC Inventory Hub
      </p>
    </div>
  </div>

    <nav class="flex-1 space-y-2">
      <router-link 
        v-for="item in navigationItems" 
        :key="item.name"
        :to="item.disabled ? '#' : item.path"
        :class="[
          'flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group',
          isActive(item.path) 
            ? 'bg-white text-black shadow-xl shadow-white/5' 
            : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200',
          item.disabled ? 'opacity-30 cursor-not-allowed' : ''
        ]"
      >
        <component 
          :is="item.icon" 
          class="w-5 h-5 transition-transform group-hover:scale-110" 
          :class="isActive(item.path) ? 'text-black' : 'text-zinc-600 group-hover:text-indigo-400'"
        />
        <span class="text-xs font-black uppercase tracking-widest">{{ item.name }}</span>
      </router-link>
    </nav>

    <div class="mt-auto pt-6 border-t border-white/5 flex items-center gap-4 px-2">
      <div class="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center font-black text-xs text-indigo-500">
        ED
      </div>
      <div>
        <p class="text-[10px] font-black text-white uppercase tracking-tighter">Ednaldo</p>
        <p class="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Dev Full Stack</p>
      </div>
    </div>
  </aside>
</template>