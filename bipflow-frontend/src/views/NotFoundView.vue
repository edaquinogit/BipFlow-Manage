<script setup lang="ts">
/**
 * 🛰️ BipFlow Asset Recovery
 * Página de fallback para rotas não mapeadas no ecossistema.
 */
</script>

<template>
  <div class="h-screen bg-zinc-950 flex flex-col items-center justify-center text-white overflow-hidden relative">
    
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
      <div class="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-zinc-500/5 blur-[120px] rounded-full"></div>
    </div>

    <div class="relative z-10 flex flex-col items-center">
      
      <h1 class="text-9xl md:text-[12rem] font-black italic uppercase tracking-tighter leading-none select-none glitch-text">
        404
      </h1>
      
      <div class="flex flex-col items-center mt-4 gap-2 info-block">
        <div class="h-px w-12 bg-indigo-500 mb-2"></div>
        
        <h2 class="text-sm font-bold uppercase tracking-widest text-white">
          Asset Not Found
        </h2>
        
        <p class="text-xs text-zinc-500 font-mono uppercase tracking-widest text-center max-w-xs">
          The requested registry entry does not exist in the BipFlow ecosystem.
        </p>
      </div>

      <router-link 
        to="/" 
        class="mt-12 group relative flex items-center gap-3 px-8 py-3 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-full transition-all duration-500 hover:bg-indigo-600 hover:text-white"
      >
        <span>Re-route to Dashboard</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </router-link>
    </div>

    <div class="absolute bottom-8 flex flex-col items-center gap-1 opacity-20">
      <span class="text-[8px] font-mono uppercase tracking-[0.5em]">BipFlow Core Registry</span>
      <span class="text-[8px] font-mono">v1.0.4-stable</span>
    </div>

  </div>
</template>

<style scoped>
/* 🎨 SOLUÇÃO DE SINTAXE: Centralização de estilos para evitar conflitos no PostCSS */
.glitch-text {
  background: linear-gradient(to bottom, #ffffff, #27272a);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: pulse-subtle 4s ease-in-out infinite;
}

.info-block {
  margin-top: -1.5rem; /* Sobe o texto para encostar no 404 de forma elegante */
}

p {
  font-size: 10px;
  line-height: 1.5;
}

@keyframes pulse-subtle {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.02); opacity: 0.8; }
}
</style>