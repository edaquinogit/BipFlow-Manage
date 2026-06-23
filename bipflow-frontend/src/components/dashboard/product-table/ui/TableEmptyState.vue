<template>
  <tr>
    <td :colspan="colspan" class="px-6 py-16 text-center">
      <div class="flex flex-col items-center gap-1.5">
        <p class="text-sm font-bold text-[#05050A]">
          Nenhum produto cadastrado.
        </p>
        <p class="text-xs text-bip-muted">
          Cadastre o primeiro produto para começar a vender.
        </p>
      </div>
    </td>
  </tr>
</template>

<script setup lang="ts">
defineProps<{
  colspan: number;
}>();
</script>
