<script setup lang="ts">
import { ref } from 'vue';
import { ProductSchema, type Product } from '../../schemas/product.schema';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits(['close', 'save']);

const form = ref<Partial<Product>>({
  name: '',
  price: 0,
  stock_quantity: 0,
  category: 1, // Default para 'Geral'
  sku: '',
});

const errors = ref<Record<string, string>>({});

const handleSubmit = () => {
  const result = ProductSchema.safeParse(form.value);
  
  if (!result.success) {
    errors.value = result.error.flatten().fieldErrors as any;
    return;
  }

  emit('save', result.data);
  form.value = { name: '', price: 0, stock_quantity: 0, category: 1, sku: '' }; // Reset
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')"></div>

    <div class="absolute inset-y-0 right-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl p-8 flex flex-col">
      <div class="flex justify-between items-center mb-10">
        <h2 class="text-2xl font-black text-white italic uppercase tracking-tighter">New Product</h2>
        <button @click="emit('close')" class="text-zinc-500 hover:text-white">✕</button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6 flex-1">
        <div>
          <label class="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Product Name</label>
          <input v-model="form.name" type="text" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all" placeholder="e.g. Vintage Camera">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Price (USD)</label>
            <input v-model.number="form.price" type="number" step="0.01" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all">
          </div>
          <div>
            <label class="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Initial Stock</label>
            <input v-model.number="form.stock_quantity" type="number" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all">
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">SKU Identifier</label>
          <input v-model="form.sku" type="text" class="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-400 font-mono focus:border-indigo-500 outline-none transition-all" placeholder="NYC-001">
        </div>

        <div class="pt-10">
          <button type="submit" class="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 active:scale-95">
            Add to Inventory
          </button>
        </div>
      </form>
    </div>
  </div>
</template>