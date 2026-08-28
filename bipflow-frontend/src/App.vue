<script setup lang="ts">
import ToastHost from '@/components/common/ToastHost.vue'
import FeedbackDialog from '@/components/feedback/FeedbackDialog.vue'
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
  <ToastHost />
  <FeedbackDialog />
</template>
