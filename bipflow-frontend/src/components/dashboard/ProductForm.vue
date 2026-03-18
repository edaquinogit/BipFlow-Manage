<script setup lang="ts">
import { ref } from 'vue';
import { ProductSchema, type Product } from '../../schemas/product.schema';
import FormInput from '../common/FormInput.vue';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits(['close', 'save']);

const initialState: Partial<Product> = {
  name: '',
  price: 0,
  stock_quantity: 0,
  category: 1,
  sku: '',
  size: '',
  image: ''
};

const form = ref({ ...initialState });
const errors = ref<Record<string, any>>({});

const handleSubmit = () => {
  const result = ProductSchema.safeParse(form.value);
  
  if (!result.success) {
    errors.value = result.error.flatten().fieldErrors;
    return;
  }

  emit('save', result.data);
  form.value = { ...initialState }; // Reset
  errors.value = {};
};
</script>

<template>
  <Transition name="slide">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')" />

      <aside class="relative w-full max-w-lg bg-zinc-900 border-l border-white/5 shadow-2xl p-8 flex flex-col">
        <header class="flex justify-between items-center mb-10">
          <div>
            <h2 class="text-3xl font-black text-white italic tracking-tighter uppercase">New Product</h2>
            <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Inventory Expansion Hub</p>
          </div>
          <button @click="emit('close')" class="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors">✕</button>
        </header>

        <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto pr-4 space-y-8 custom-scrollbar">
          
          <section class="space-y-6">
            <h3 class="text-xs font-black text-indigo-500 uppercase tracking-[0.3em]">Basic Info</h3>
            <FormInput label="Product Name" v-model="form.name" placeholder="e.g. Premium Hub Gear" :error="errors.name?.[0]" />
            <div class="grid grid-cols-2 gap-4">
              <FormInput label="SKU" v-model="form.sku" placeholder="NYC-100" />
              <FormInput label="Category ID" v-model="form.category" type="number" />
            </div>
          </section>

          <section class="space-y-6">
            <h3 class="text-xs font-black text-indigo-500 uppercase tracking-[0.3em]">Specifications</h3>
            <div class="grid grid-cols-2 gap-4">
              <FormInput label="Price (USD)" v-model="form.price" type="number" :error="errors.price?.[0]" />
              <FormInput label="Stock" v-model="form.stock_quantity" type="number" />
            </div>
            <FormInput label="Size / Version" v-model="form.size" placeholder="e.g. Large, 42, 1TB" />
          </section>

          <section class="space-y-6">
            <h3 class="text-xs font-black text-indigo-500 uppercase tracking-[0.3em]">Media</h3>
            <FormInput label="Image URL" v-model="form.image" placeholder="https://images.unsplash.com/..." />
            <div v-if="form.image" class="mt-4 h-32 w-full rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
               <img :src="form.image" class="w-full h-full object-cover opacity-50" />
            </div>
          </section>
        </form>

        <footer class="mt-10">
          <button type="submit" @click="handleSubmit" class="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5">
            Add to Inventory
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
</style>