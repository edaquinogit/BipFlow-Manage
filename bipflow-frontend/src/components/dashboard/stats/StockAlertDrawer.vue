<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { CheckCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { Product } from '@/schemas/product.schema';
import { DashboardRoutes } from '@/router/dashboard.routes';
import ProductAvatar from '@/components/dashboard/product-table/ui/ProductAvatar.vue';

const props = defineProps<{
  isOpen: boolean;
  outOfStockProducts: Product[];
  lowStockProducts: Product[];
  isLoading: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const closeButtonRef = ref<HTMLButtonElement | null>(null);

const totalAlertCount = computed(
  () => props.outOfStockProducts.length + props.lowStockProducts.length
);

const productMetaLabel = (product: Product): string => {
  const categoryName = typeof product.category === 'object' ? product.category?.name : undefined;
  const parts = [categoryName, product.sku].filter((part): part is string => Boolean(part));
  return parts.join(' · ');
};

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    emit('close');
  }
};

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown);
      void nextTick(() => closeButtonRef.value?.focus());
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Transition name="stock-alert-sheet">
    <div v-if="isOpen" class="fixed inset-0 z-50">
      <div
        class="absolute inset-0 bg-[#05050A]/55 backdrop-blur-sm"
        @click="emit('close')"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Alertas de estoque"
        class="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-[#FAFAFA] shadow-2xl"
      >
        <header class="border-b border-[#E5E7EB] bg-white px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-[#D81B60]">Estoque</p>
              <h2 class="mt-2 text-2xl font-semibold text-[#05050A]">
                {{ totalAlertCount }} produto<span v-if="totalAlertCount !== 1">s</span> em alerta
              </h2>
              <p class="mt-1 text-sm leading-6 text-[#6B7280]">
                Produtos zerados ou com poucas unidades, do mais critico para o menos critico.
              </p>
            </div>

            <button
              ref="closeButtonRef"
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition hover:border-[#D81B60] hover:text-[#D81B60]"
              aria-label="Fechar alertas de estoque"
              @click="emit('close')"
            >
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          <div v-if="isLoading" aria-live="polite" class="space-y-3">
            <span class="sr-only">Carregando alertas de estoque</span>
            <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-xl bg-zinc-100" />
          </div>

          <div
            v-else-if="totalAlertCount === 0"
            class="border-y border-dashed border-[#D1D5DB] py-10 text-center"
          >
            <CheckCircleIcon class="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
            <p class="mt-4 text-base font-semibold text-[#05050A]">Nenhum alerta agora</p>
            <p class="mt-2 text-sm leading-6 text-[#6B7280]">
              Todo o catalogo esta com estoque saudavel.
            </p>
          </div>

          <div v-else class="space-y-6">
            <section v-if="outOfStockProducts.length > 0">
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Sem estoque ({{ outOfStockProducts.length }})
              </h3>
              <ul class="space-y-2">
                <li
                  v-for="product in outOfStockProducts"
                  :key="`out-${product.id ?? product.name}`"
                  class="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3"
                >
                  <ProductAvatar :image="product.image" :name="product.name" size="sm" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-[#05050A]">{{ product.name }}</p>
                    <p class="truncate text-xs text-[#6B7280]">{{ productMetaLabel(product) }}</p>
                  </div>
                  <span class="shrink-0 rounded-full bg-[#D81B60] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Zerado
                  </span>
                </li>
              </ul>
            </section>

            <section v-if="lowStockProducts.length > 0">
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Estoque baixo ({{ lowStockProducts.length }})
              </h3>
              <ul class="space-y-2">
                <li
                  v-for="product in lowStockProducts"
                  :key="`low-${product.id ?? product.name}`"
                  class="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3"
                >
                  <ProductAvatar :image="product.image" :name="product.name" size="sm" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-[#05050A]">{{ product.name }}</p>
                    <p class="truncate text-xs text-[#6B7280]">{{ productMetaLabel(product) }}</p>
                  </div>
                  <span class="shrink-0 rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {{ product.stock_quantity }} un.
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <footer class="border-t border-[#E5E7EB] bg-white px-6 py-4">
          <RouterLink
            :to="{ name: DashboardRoutes.Products }"
            class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#05050A] text-sm font-semibold text-white transition hover:bg-[#D81B60]"
            @click="emit('close')"
          >
            Ver todos os produtos
          </RouterLink>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.stock-alert-sheet-enter-active,
.stock-alert-sheet-leave-active {
  transition: opacity 0.22s ease;
}

.stock-alert-sheet-enter-active aside,
.stock-alert-sheet-leave-active aside {
  transition: transform 0.26s ease;
}

.stock-alert-sheet-enter-from,
.stock-alert-sheet-leave-to {
  opacity: 0;
}

.stock-alert-sheet-enter-from aside,
.stock-alert-sheet-leave-to aside {
  transform: translateX(100%);
}
</style>
