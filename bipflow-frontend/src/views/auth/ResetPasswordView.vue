<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Nova Senha</h1>
    <p>Token recebido: {{ token }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ token: string }>()
</script>
