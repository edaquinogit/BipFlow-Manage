<template>
  <tr>
    <td :colspan="colspan" class="px-6 py-24 text-center">
      <div class="flex flex-col items-center opacity-40 space-y-2">
        <!-- Headline -->
        <span
          class="text-4xl italic font-black text-zinc-700 underline tracking-tight"
        >
          EMPTY
        </span>

        <!-- Subheadline -->
        <h3
          class="text-white font-bold uppercase text-xs tracking-widest"
        >
          No assets in registry
        </h3>

        <!-- Helper text -->
        <p
          class="text-[10px] mt-1 text-zinc-500 font-medium"
        >
          Provision new items to populate the hub.
        </p>
      </div>
    </td>
  </tr>
</template>

<script setup lang="ts">
/**
 * Props tipadas para manter integridade
 */
defineProps<{
  colspan: number;
}>();
</script>

<style scoped>
/* Transições suaves para consistência visual */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>