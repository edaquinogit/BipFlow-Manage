<script setup lang="ts">
import { BanknotesIcon } from '@heroicons/vue/24/outline';

defineProps<{
  value: string | number;
}>();
</script>

<template>
  <div class="revenue-card-root">
    <div class="relative z-10">
      <p class="text-[10px] font-black text-rose-100 uppercase tracking-[0.3em] mb-1 opacity-80">
        Valor da vitrine
      </p>
      <h3 class="text-4xl font-black text-white italic tracking-tighter transition-all duration-700">
        {{ value }}
      </h3>
    </div>
    
    <BanknotesIcon 
      class="revenue-icon" 
    />
    
    <div class="glass-overlay"></div>
  </div>
</template>

<style scoped>
/* * BipFlow Executive Style Suite
 * Estilização isolada para evitar conflitos com o parser do Tailwind/Vite.
 */
.revenue-card-root {
  position: relative;
  overflow: hidden;
  padding: 2rem;
  border-radius: 2.5rem;
  background: linear-gradient(135deg, #05050a 0%, #5f1235 48%, #d81b60 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 50px -12px rgba(216, 27, 96, 0.32);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}

.revenue-card-root:hover {
  transform: scale(1.02);
  border-color: rgba(255, 255, 255, 0.2);
}

.revenue-icon {
  position: absolute;
  right: -1.5rem;
  bottom: -1.5rem;
  width: 9rem; /* w-36 */
  height: 9rem;
  color: white;
  opacity: 0.1;
  transition: all 1s ease;
}

.revenue-card-root:hover .revenue-icon {
  transform: scale(1.1) rotate(-12deg);
  opacity: 0.15;
}

.glass-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.7s ease;
  background: linear-gradient(to top right, rgba(255, 255, 255, 0.1), transparent);
}

.revenue-card-root:hover .glass-overlay {
  opacity: 1;
}
</style>
