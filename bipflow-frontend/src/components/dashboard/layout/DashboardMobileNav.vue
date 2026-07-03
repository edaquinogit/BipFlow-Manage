<template>
  <Transition name="mobile-nav">
    <nav
      v-if="isOpen"
      aria-label="Secoes do dashboard (mobile)"
      class="border-t border-bip-line bg-white px-6 py-4 lg:hidden"
    >
      <RouterLink
        v-for="item in items"
        :key="item.label"
        :to="item.to"
        class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#05050A] transition hover:bg-[#FCE7F3]/60"
        active-class="bg-[#FCE7F3] text-[#D81B60]"
        exact-active-class="bg-[#FCE7F3] text-[#D81B60]"
        @click="closeMenu"
      >
        <component :is="item.icon" class="h-5 w-5" />
        {{ item.label }}
      </RouterLink>

      <button
        type="button"
        class="mt-2 flex w-full items-center gap-3 rounded-xl border border-[#D81B60]/20 bg-[#FCE7F3] px-3 py-3 text-sm font-bold text-[#D81B60] transition hover:bg-[#FCE7F3]/70"
        @click="logout"
      >
        <ArrowLeftOnRectangleIcon class="h-5 w-5" />
        Finalizar sessao
      </button>
    </nav>
  </Transition>
</template>

<script setup lang="ts">
import { ArrowLeftOnRectangleIcon } from '@heroicons/vue/24/outline';
import type { RouteLocationRaw } from 'vue-router';

const props = withDefaults(defineProps<{
  items: Array<{ label: string; to: RouteLocationRaw; icon: any }>;
  isOpen: boolean;
}>(), {
  items: () => [],
  isOpen: false,
});

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'logout'): void;
}>();

const closeMenu = (): void => emit('close');
const logout = (): void => emit('logout');
</script>
