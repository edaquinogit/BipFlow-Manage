<script setup lang="ts">
import { ref, computed, toRef } from 'vue';
import { ProductSchema, type Product } from '@/schemas/product.schema';
import { useProductState } from '@/composables/useProductState';

// Sections
import IdentitySection from '@/components/dashboard/product-form/sections/IdentitySection.vue';
import ValuationSection from '@/components/dashboard/product-form/sections/ValuationSection.vue';
import MediaSection from '@/components/dashboard/product-form/sections/MediaSection.vue';

interface Props {
  isOpen: boolean;
  initialData?: Product | null;
  categories: Array<{ id: number; name: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  initialData: null,
  categories: () => []
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: Product): void;
}>();

const isSubmitting = ref(false);
const errors = ref<Record<string, string[]>>({});

const { form } = useProductState(
  toRef(props, 'isOpen'),
  () => props.initialData ?? null,
  () => {
    errors.value = {};
  },
);

const handleSubmit = async () => {
  isSubmitting.value = true;
  errors.value = {};

  await new Promise((resolve) => setTimeout(resolve, 50));

  const result = ProductSchema.safeParse(form);

  if (!result.success) {
    errors.value = result.error.flatten().fieldErrors;
    isSubmitting.value = false;
    return;
  }

  try {
    emit('save', result.data as Product);
  } finally {
    isSubmitting.value = false;
  }
};

const title = computed(() => props.initialData ? 'Update Asset' : 'New Product');
</script>

<template>
  <Transition name="slide">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
      
      <div 
        class="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        @click="emit('close')" 
      />

      <aside 
        class="relative w-full max-w-lg bg-zinc-900 border-l border-white/5 shadow-2xl p-8 flex flex-col overflow-hidden"
        data-cy="product-form-panel"
      >
        
        <header class="flex justify-between items-center mb-10 shrink-0">
          <div>
            <h2 class="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
              {{ title }}
            </h2>
            <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">
              Inventory Expansion Hub
            </p>
          </div>
          <button 
            @click="emit('close')" 
            class="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-90"
          >
            ✕
          </button>
        </header>

        <form 
          id="product-registry-form"
          @submit.prevent="handleSubmit" 
          class="flex-1 overflow-y-auto pr-2 space-y-12 custom-scrollbar"
        >
          <IdentitySection 
            v-model:name="form.name" 
            v-model:sku="form.sku" 
            v-model:category="form.category"
            :categories="categories"
            :errors="errors"
          />

          <ValuationSection 
            v-model:price.number="form.price" 
            v-model:stock="form.stock_quantity"
            v-model:size="form.size"
            :errors="errors"
          />

          <MediaSection 
            v-model="form.image"
            :error="errors.image?.[0]"
          />
        </form>

        <footer class="mt-10 pt-6 border-t border-zinc-800 shrink-0">
          <button 
            form="product-registry-form"
            type="submit" 
            data-cy="btn-submit-product"
            :disabled="isSubmitting"
            class="w-full bg-white text-black py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 shadow-xl shadow-white/5 hover:bg-zinc-200 hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div class="flex items-center justify-center gap-3">
              <span v-if="isSubmitting" class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              <span>{{ isSubmitting ? 'Processing...' : (initialData ? 'Confirm Changes' : 'Deploy to Inventory') }}</span>
            </div>
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.slide-enter-active, 
.slide-leave-active { 
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1); 
}
.slide-enter-from, 
.slide-leave-to { 
  transform: translateX(100%); 
}

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
</style>
