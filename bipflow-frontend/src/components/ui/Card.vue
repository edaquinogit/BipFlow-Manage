<script setup lang="ts">
withDefaults(defineProps<{
  as?: string;
  overflowHidden?: boolean;
}>(), {
  as: 'section',
  overflowHidden: false,
});
</script>

<template>
  <component
    :is="as"
    class="rounded-card border border-bip-line bg-white p-8 shadow-card"
    :class="overflowHidden ? 'relative overflow-hidden' : ''"
  >
    <slot />
  </component>
</template>
