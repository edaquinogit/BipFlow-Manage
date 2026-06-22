<script setup lang="ts">
interface PeriodOption {
  value: string;
  label: string;
}

defineProps<{
  modelValue: string;
  options: PeriodOption[];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();
</script>

<template>
  <div class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-950 p-1">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all duration-300"
      :class="modelValue === option.value
        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
        : 'text-zinc-500 hover:text-zinc-200'"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
