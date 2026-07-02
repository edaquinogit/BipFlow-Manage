<script setup lang="ts">
import { ref, toRef } from 'vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { useDialogA11y } from '@/composables/useDialogA11y';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  show: boolean;
  title: string;
  message: string;
  isLoading?: boolean;
}>();

const emit = defineEmits<{ close: []; confirm: [] }>();

const containerRef = ref<HTMLElement | null>(null);
const cancelButtonRef = ref<HTMLButtonElement | null>(null);

useDialogA11y(toRef(props, 'show'), () => emit('close'), containerRef, cancelButtonRef);
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="modal-overlay">

        <div
          ref="containerRef"
          class="modal-container"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <div class="alert-line"></div>

          <div class="flex flex-col items-center text-center">
            <div class="w-16 h-16 bg-[#FCE7F3] rounded-2xl flex items-center justify-center mb-6 border border-[#D81B60]/20">
              <ExclamationTriangleIcon class="w-8 h-8 text-[#D81B60]" />
            </div>

            <h3 class="text-xl font-black text-[#05050A] italic uppercase tracking-tighter mb-2">
              {{ title }}
            </h3>
            <p class="text-[11px] text-bip-muted font-bold uppercase tracking-[0.2em] leading-relaxed mb-8">
              {{ message }}
            </p>

            <div class="flex w-full gap-4">
              <Button
                ref="cancelButtonRef"
                variant="outline"
                size="sm"
                class="flex-1"
                @click="emit('close')"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                class="flex-1"
                :disabled="isLoading"
                :loading="isLoading"
                @click="emit('confirm')"
              >
                {{ isLoading ? 'Processando...' : 'Confirmar exclusão' }}
              </Button>
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
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 2.5rem;
  padding: 2rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden;
}

.alert-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(to right, transparent, #d81b60, transparent);
  opacity: 0.5;
}

/* Transições de Fade */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>