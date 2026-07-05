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
  <div
    role="group"
    aria-label="Selecionar periodo"
    class="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto scroll-smooth snap-x snap-mandatory rounded-full border border-[#E5E7EB] bg-zinc-100 p-1 sm:max-w-none sm:overflow-visible"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="modelValue === option.value"
      class="shrink-0 snap-start rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all duration-300"
      :class="modelValue === option.value
        ? 'bg-[#D81B60] text-white shadow-lg shadow-[#D81B60]/30'
        : 'text-bip-muted hover:text-[#05050A]'"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
