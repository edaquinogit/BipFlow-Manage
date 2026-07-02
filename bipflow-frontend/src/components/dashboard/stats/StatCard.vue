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
  indigo: 'text-bip-rose bg-bip-blush border-bip-rose/20',
  orange: 'text-amber-700 bg-amber-50 border-amber-200',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  rose: 'text-bip-rose bg-bip-blush border-bip-rose/20',
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
    class="group relative overflow-hidden bg-white border border-bip-line p-5 rounded-card text-left transition-all duration-500 hover:border-bip-rose/30 hover:shadow-card-hover"
    :class="clickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bip-blush focus-visible:ring-offset-2' : ''"
    @click="clickable && emit('click')"
  >
    <div class="absolute -right-10 -top-10 w-32 h-32 bg-bip-rose/[0.06] blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

    <div class="flex items-center gap-3 relative z-10">
      <div :class="['p-3 rounded-xl border transition-all duration-500 group-hover:scale-110 shadow-sm', colorMap[props.color]]">
        <component :is="icon" class="w-5 h-5" aria-hidden="true" />
      </div>

      <p class="text-2xs font-black text-bip-muted uppercase tracking-[0.3em]">{{ label }}</p>
    </div>

    <h3 class="relative z-10 mt-3 text-4xl font-black text-bip-black tracking-tighter italic transition-all duration-500 group-hover:translate-x-1">
      {{ value }}
    </h3>
  </component>
</template>
