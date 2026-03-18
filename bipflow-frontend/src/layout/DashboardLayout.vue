<script setup lang="ts">
import Sidebar from '../components/common/Sidebar.vue';
</script>

<template>
  <div class="flex min-h-screen bg-zinc-950">
    <Sidebar />

    <div class="flex-1">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>