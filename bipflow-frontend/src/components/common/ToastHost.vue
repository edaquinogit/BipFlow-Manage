<script setup lang="ts">
import { useToast, type ToastType } from '@/composables/useToast';

const { toasts, removeToast } = useToast();

const toastClasses: Record<ToastType, string> = {
  success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-50',
  error: 'border-red-500/40 bg-red-950/90 text-red-50',
  warning: 'border-amber-500/40 bg-amber-950/90 text-amber-50',
  info: 'border-sky-500/40 bg-sky-950/90 text-sky-50',
};

const toastLabels: Record<ToastType, string> = {
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="toasts.length"
      class="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
      data-cy="toast-container"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl backdrop-blur"
        :class="toastClasses[toast.type]"
        :data-cy="`toast-${toast.type}`"
        role="status"
        aria-live="polite"
      >
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-black uppercase tracking-widest opacity-70">
            {{ toastLabels[toast.type] }}
          </p>
          <p class="mt-1 leading-snug">
            {{ toast.message }}
          </p>
        </div>

        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs font-black opacity-70 transition hover:bg-white/10 hover:opacity-100"
          :aria-label="`Dismiss ${toast.type} notification`"
          @click="removeToast(toast.id)"
        >
          x
        </button>
      </div>
    </div>
  </Teleport>
</template>
