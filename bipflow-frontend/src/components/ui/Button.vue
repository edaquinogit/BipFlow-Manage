<script setup lang="ts">
import { ref } from 'vue';

withDefaults(defineProps<{
  variant?: 'primary' | 'outline';
  size?: 'md' | 'sm';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
});

const buttonRef = ref<HTMLButtonElement | null>(null);

defineExpose({
  focus: () => buttonRef.value?.focus(),
});
</script>

<template>
  <button
    ref="buttonRef"
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bip-blush focus-visible:ring-offset-2"
    :class="[
      variant === 'primary'
        ? 'bg-bip-rose text-white shadow-sm hover:bg-[#b8154f] disabled:bg-zinc-300'
        : 'border border-bip-line text-bip-muted hover:bg-zinc-50',
      size === 'md'
        ? 'h-11 w-full rounded-lg text-sm font-bold'
        : 'rounded-xl px-6 py-4 text-2xs',
    ]"
  >
    <span
      v-if="loading"
      class="mr-2 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
