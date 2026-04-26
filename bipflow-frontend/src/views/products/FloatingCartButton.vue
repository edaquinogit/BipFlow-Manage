<template>
  <Transition name="cart-fab">
    <button
      v-if="itemCount > 0"
      type="button"
      class="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_18px_35px_-18px_rgba(15,23,42,0.7)] ring-1 ring-white/70 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 active:translate-y-0 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6 sm:h-16 sm:w-16"
      :aria-label="cartAriaLabel"
      @click="$emit('openCart')"
    >
      <ShoppingCartIcon class="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ShoppingCartIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  itemCount: number
}>()

defineEmits<{
  openCart: []
}>()

const cartAriaLabel = computed(() => {
  const itemLabel = props.itemCount === 1 ? 'item' : 'itens'

  return `Abrir carrinho com ${props.itemCount} ${itemLabel}`
})
</script>

<style scoped>
.cart-fab-enter-active,
.cart-fab-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.cart-fab-enter-from,
.cart-fab-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.94);
}
</style>
