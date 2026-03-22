<script setup lang="ts">
import { ref, watch } from 'vue';

// 🎯 Path Mapping profissional
import { ProductSchema, type Product } from '@/schemas/product.schema';
import IdentitySection from '@/components/dashboard/product-form/sections/IdentitySection.vue';
import ValuationSection from '@/components/dashboard/product-form/sections/ValuationSection.vue';
import MediaSection from '@/components/dashboard/product-form/sections/MediaSection.vue';

const props = defineProps<{ 
  isOpen: boolean;
  initialData: Product | null; 
  categories: any[]; 
}>();

const emit = defineEmits(['close', 'save']);

// --- STATE MANAGEMENT ---
const form = ref<Record<string, any>>({});
const errors = ref<Record<string, string[]>>({});

/**
 * 🛰️ ENGINE SYNC: Sincronização de Estado (NYC Standard)
 * Quando o painel abre, resetamos ou populamos o formulário.
 */
watch(() => props.isOpen, (open) => {
  if (open) {
    if (props.initialData) {
      form.value = { ...props.initialData };
    } else {
      // Estado Inicial (Clean Slate)
      form.value = {
        name: '',
        price: 0,
        stock_quantity: 0,
        category: null,
        sku: '',
        size: '',
        image: null
      };
    }
    errors.value = {};
  }
}, { immediate: true });

/**
 * 🧠 DISPATCHER: Validação Atômica com Zod
 * Aqui é onde o "cinto de segurança" de 2MB e tipos numéricos atua.
 */
const handleSubmit = () => {
  // 1. Limpa erros anteriores
  errors.value = {};

  // 2. Executa a validação do Schema
  const result = ProductSchema.safeParse(form.value);

  if (!result.success) {
    // Flatten transforma o erro do Zod em um objeto fácil de ler: { field: ['error'] }
    errors.value = result.error.flatten().fieldErrors;
    console.warn("⚠️ BipFlow: Validation failed at Hub Level.", errors.value);
    return; 
  }

  // 3. Emite os dados limpos e validados para o Dashboard
  emit('save', result.data);
};
</script>

<template>
  <Transition name="slide">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')" />

      <aside class="relative w-full max-w-lg bg-zinc-900 border-l border-white/5 shadow-2xl p-8 flex flex-col overflow-hidden">
        
        <header class="flex justify-between items-center mb-10">
          <div>
            <h2 class="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
              {{ initialData ? 'Update Asset' : 'New Product' }}
            </h2>
            <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">
              Inventory Expansion Hub
            </p>
          </div>
          <button 
            @click="emit('close')" 
            class="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
          >
            ✕
          </button>
        </header>

        <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto pr-4 space-y-12 custom-scrollbar">
          
          <IdentitySection 
            v-model:name="form.name" 
            v-model:sku="form.sku" 
            v-model:category="form.category"
            :categories="categories"
            :errors="errors"
          />

          <ValuationSection 
            v-model:price="form.price" 
            v-model:stock="form.stock_quantity"
            v-model:size="form.size"
            :errors="errors"
          />

          <MediaSection 
            v-model="form.image"
            :error="errors.image?.[0]"
          />

        </form>

        <footer class="mt-10 pt-6 border-t border-zinc-800">
          <button 
            type="submit" 
            @click="handleSubmit" 
            class="submit-btn active:scale-95 disabled:opacity-50"
          >
            {{ initialData ? 'Confirm Changes' : 'Deploy to Inventory' }}
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.submit-btn {
  width: 100%;
  background-color: #ffffff;
  color: #000000;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 1.25rem 0;
  border-radius: 0.75rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.submit-btn:hover {
  background-color: #e4e4e7;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -10px rgba(255, 255, 255, 0.2);
}

.slide-enter-active, .slide-leave-active { 
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); 
}
.slide-enter-from, .slide-leave-to { 
  transform: translateX(100%); 
}

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
</style>