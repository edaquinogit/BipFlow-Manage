<template>
  <Transition name="cart-fab">
    <button
      v-if="itemCount > 0"
      type="button"
      class="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#05050A] px-4 pr-5 text-white shadow-[0_18px_35px_-18px_rgba(5,5,10,0.8)] ring-2 ring-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#D81B60] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FCE7F3] active:translate-y-0 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6"
      :aria-label="cartAriaLabel"
      @click="$emit('openCart')"
    >
      <ShoppingCartIcon class="h-5 w-5" aria-hidden="true" />
      <span class="text-sm font-semibold">Ver pedido</span>
      <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold leading-none text-[#05050A]">
        {{ visibleItemCount }}
      </span>
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

const visibleItemCount = computed(() => (props.itemCount > 99 ? '99+' : String(props.itemCount)))
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
