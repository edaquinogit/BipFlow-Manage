<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

defineProps<{
  show: boolean;
  title: string;
  message: string;
  isLoading?: boolean;
}>();

defineEmits(['close', 'confirm']);
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay">
        
        <div class="modal-container">
          <div class="alert-line"></div>

          <div class="flex flex-col items-center text-center">
            <div class="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
              <ExclamationTriangleIcon class="w-8 h-8 text-red-500" />
            </div>

            <h3 class="text-xl font-black text-white italic uppercase tracking-tighter mb-2">
              {{ title }}
            </h3>
            <p class="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.2em] leading-relaxed mb-8">
              {{ message }}
            </p>

            <div class="flex w-full gap-4">
              <button 
                @click="$emit('close')" 
                class="flex-1 px-6 py-4 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:bg-white/5 transition-all"
              >
                Abort
              </button>
              <button 
                @click="$emit('confirm')" 
                :disabled="isLoading"
                class="confirm-button"
              >
                {{ isLoading ? 'Processing...' : 'Confirm Purge' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Estilização Profissional Isolada - BipFlow Protocol */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background-color: rgba(9, 9, 11, 0.85); /* zinc-950/85 */
  backdrop-filter: blur(8px);
}

.modal-container {
  width: 100%;
  max-width: 28rem; /* max-w-md */
  background-color: #18181b; /* zinc-900 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2.5rem;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
}

.alert-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(to right, transparent, #ef4444, transparent);
  opacity: 0.5;
}

.confirm-button {
  flex: 1;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  background-color: #dc2626; /* red-600 */
  color: white;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: all 0.3s ease;
}

.confirm-button:hover:not(:disabled) {
  background-color: #ef4444;
  box-shadow: 0 0 20px rgba(220, 38, 38, 0.2);
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Transições de Fade */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>