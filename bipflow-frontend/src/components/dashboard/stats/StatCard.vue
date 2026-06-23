<script setup lang="ts">
import type { Component } from 'vue';

interface Props {
  label: string;
  value: string | number;
  icon: Component;
  color?: 'indigo' | 'orange' | 'emerald' | 'rose' | 'amber' | 'cyan';
  clickable?: boolean;
}

// Default values seguindo Clean Code
const props = withDefaults(defineProps<Props>(), {
  color: 'indigo',
  clickable: false,
});

const emit = defineEmits<{ click: [] }>();

// Mapeamento de cores para manter o CSS limpo no template
const colorMap = {
  indigo: 'text-[#D81B60] bg-[#FCE7F3] border-[#D81B60]/20',
  orange: 'text-amber-700 bg-amber-50 border-amber-200',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  rose: 'text-[#D81B60] bg-[#FCE7F3] border-[#D81B60]/20',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  cyan: 'text-cyan-700 bg-cyan-50 border-cyan-200',
};
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    :role="clickable ? undefined : 'group'"
    :aria-label="`${label}: ${value}`"
    class="group relative overflow-hidden bg-white border border-[#E5E7EB] p-8 rounded-[2.5rem] text-left transition-all duration-500 hover:border-[#D81B60]/30 hover:shadow-[0_18px_45px_-28px_rgba(5,5,10,0.65)]"
    :class="clickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FCE7F3] focus-visible:ring-offset-2' : ''"
    @click="clickable && emit('click')"
  >
    <div class="absolute -right-10 -top-10 w-32 h-32 bg-[#D81B60]/[0.06] blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

    <div class="flex justify-between items-start mb-8 relative z-10">
      <div :class="['p-4 rounded-2xl border transition-all duration-500 group-hover:scale-110 shadow-sm', colorMap[props.color]]">
        <component :is="icon" class="w-6 h-6" aria-hidden="true" />
      </div>

      <span class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCE7F3] border border-[#D81B60]/15">
        <span class="w-1 h-1 rounded-full bg-[#D81B60] animate-pulse"></span>
        <span class="text-[8px] font-black text-[#D81B60]/70 uppercase tracking-widest">Live</span>
      </span>
    </div>

    <div class="relative z-10">
      <p class="text-[10px] font-black text-bip-muted uppercase tracking-[0.4em] mb-2">{{ label }}</p>
      <h3 class="text-5xl font-black text-[#05050A] tracking-tighter italic transition-all duration-500 group-hover:translate-x-1">
        {{ value }}
      </h3>
    </div>
  </component>
</template>
