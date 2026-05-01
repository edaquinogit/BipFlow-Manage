<script setup lang="ts">
import ToastHost from '@/components/common/ToastHost.vue'
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
