<script setup lang="ts">
import type { Category as ProductCategory } from '@/schemas/product.schema';
import type { Category as CategorySchema } from '@/schemas/category.schema';

/**
 * 🏷️ COMPONENT CONTRACT
 */
defineProps<{
  category: CategorySchema | ProductCategory | null;
}>();

/**
 * 🎨 COLOR CODING SYSTEM
 * Different glow colors for different category types based on ID
 */
const getCategoryGlowColor = (categoryId: number): string => {
  const colors = [
    'rgba(99, 102, 241, 0.3)',   // indigo
    'rgba(168, 85, 247, 0.3)',   // violet
    'rgba(236, 72, 153, 0.3)',   // pink
    'rgba(34, 197, 94, 0.3)',    // emerald
    'rgba(251, 191, 36, 0.3)',   // amber
    'rgba(239, 68, 68, 0.3)',    // red
    'rgba(6, 182, 212, 0.3)',    // cyan
    'rgba(245, 158, 11, 0.3)',   // yellow
  ];
  const index = ((categoryId % colors.length) + colors.length) % colors.length;
  return colors[index] as string;
};

const getCategoryBorderColor = (categoryId: number): string => {
  const colors = [
    'rgba(99, 102, 241, 0.6)',   // indigo
    'rgba(168, 85, 247, 0.6)',   // violet
    'rgba(236, 72, 153, 0.6)',   // pink
    'rgba(34, 197, 94, 0.6)',    // emerald
    'rgba(251, 191, 36, 0.6)',   // amber
    'rgba(239, 68, 68, 0.6)',    // red
    'rgba(6, 182, 212, 0.6)',    // cyan
    'rgba(245, 158, 11, 0.6)',   // yellow
  ];
  const index = ((categoryId % colors.length) + colors.length) % colors.length;
  return colors[index] as string;
};
</script>

<template>
  <span
    v-if="category"
    class="inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border backdrop-blur-sm transition-all duration-300 hover:scale-105"
    :style="{
      backgroundColor: 'rgba(39, 39, 46, 0.6)', // zinc-800/60
      borderColor: getCategoryBorderColor(category.id),
      boxShadow: `0 0 10px ${getCategoryGlowColor(category.id)}`,
      color: 'rgba(255, 255, 255, 0.9)'
    }"
  >
    <span class="truncate max-w-24">{{ category.name }}</span>
  </span>

  <span
    v-else
    class="inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-zinc-600/50 bg-zinc-800/40 text-zinc-500 backdrop-blur-sm"
  >
    Unclassified
  </span>
</template>

<style scoped>
/* NYC Station Cyberpunk Theme Variables */
:root {
  --nyc-bg-primary: #09090b; /* zinc-950 */
  --nyc-bg-secondary: #27272a; /* zinc-800 */
  --nyc-bg-tertiary: #18181b; /* zinc-900 */
  --nyc-border-primary: #3f3f46; /* zinc-700 */
  --nyc-border-secondary: #27272a; /* zinc-800 */
  --nyc-text-primary: #ffffff;
  --nyc-text-secondary: #a1a1aa; /* zinc-400 */
  --nyc-text-muted: #71717a; /* zinc-500 */
  --nyc-text-placeholder: #52525b; /* zinc-600 */
  --nyc-accent-primary: #6366f1; /* indigo-500 */
  --nyc-accent-secondary: #4f46e5; /* indigo-600 */
  --nyc-accent-glow: rgba(99, 102, 241, 0.2);
  --nyc-shadow-primary: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
  --nyc-shadow-glow: 0 0 20px rgba(99, 102, 241, 0.1);
}

/* Smooth transitions for all interactive elements */
span {
  transition: all 0.3s ease;
}

/* Hover effects for better UX */
span:hover {
  transform: scale(1.05);
  box-shadow: 0 0 15px currentColor;
}
</style>