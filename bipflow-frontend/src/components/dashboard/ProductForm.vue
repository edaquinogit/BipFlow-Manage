<script setup lang="ts">
import { ref, watch } from 'vue';
import { ProductSchema, type Product } from '../../schemas/product.schema';
import type { Category } from '../../schemas/category.schema';
import FormInput from '../common/FormInput.vue';

// --- PROPS & EMITS ---
const props = defineProps<{ 
  isOpen: boolean;
  initialData: Product | null; 
  categories: Category[]; // Recebendo a lista de categorias do Dashboard
}>();

const emit = defineEmits(['close', 'save']);

// --- STATE MANAGEMENT ---
const initialState: Partial<Product> = {
  name: '',
  price: 0,
  stock_quantity: 0,
  category: null as any, // Null para forçar a seleção no select
  sku: '',
  size: '',
  image: '' 
};

// Usamos Record<string, any> para suportar File Objects no lugar de Strings
const form = ref<Record<string, any>>({ ...initialState });
const errors = ref<Record<string, any>>({});
const imagePreview = ref<string | null>(null); // Gerencia o preview visual separadamente

/**
 * ENGINE DE SINCRONIZAÇÃO (WATCHER)
 */
watch(() => props.initialData, (newData) => {
  if (newData) {
    form.value = { ...newData };
    // Se a imagem vinda do banco for uma string (URL), carregamos no preview
    imagePreview.value = typeof newData.image === 'string' ? newData.image : null;
    errors.value = {};
  } else {
    form.value = { ...initialState };
    imagePreview.value = null; // Limpa o preview ao criar novo produto
    errors.value = {};
  }
}, { immediate: true });

/**
 * UPLOAD HANDLER (NYC UX)
 * Transforma o arquivo selecionado em um Preview DataURL e salva o File no form.
 */
const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    
    // Gera o preview visual em tempo real
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Salva o binário para o Zod validar e o Service enviar via FormData
    form.value.image = file;
  }
};

/**
 * LOGIC HANDLER
 */
const handleSubmit = () => {
  const result = ProductSchema.safeParse(form.value);

  if (!result.success) {
    console.error("❌ Validação Falhou:", result.error.flatten().fieldErrors);
    errors.value = result.error.flatten().fieldErrors;
    return; 
  }

  console.log("✅ Payload validado para envio:", result.data);
  emit('save', result.data);
};
</script>

<template>
  <Transition name="slide">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')" />

      <aside class="relative w-full max-w-lg bg-zinc-900 border-l border-white/5 shadow-2xl p-8 flex flex-col">
        <header class="flex justify-between items-center mb-10">
          <div>
            <h2 class="text-3xl font-black text-white italic tracking-tighter uppercase">
              {{ initialData ? 'Update Asset' : 'New Product' }}
            </h2>
            <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              {{ initialData ? `Registry ID: ${initialData.id}` : 'Inventory Expansion Hub' }}
            </p>
          </div>
          <button @click="emit('close')" class="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-all hover:rotate-90">✕</button>
        </header>

        <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto pr-4 space-y-8 custom-scrollbar">
          
          <section class="space-y-6">
            <h3 class="section-title">Identity & Registry</h3>
            
            <FormInput label="Product Name" v-model="form.name" placeholder="e.g. Premium Hub Gear" :error="errors.name?.[0]" />
            
            <div class="grid grid-cols-2 gap-4">
              <FormInput label="SKU" v-model="form.sku" placeholder="NYC-100" />

              <div class="flex flex-col justify-end group">
                <label class="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-2 group-focus-within:text-indigo-400 transition-colors">
                  Classification
                </label>
                
                <div class="relative">
                  <select 
                    v-model.number="form.category"
                    :class="[
                      'w-full bg-zinc-950 border rounded-lg py-2.5 px-3 text-sm text-white outline-none transition-all appearance-none cursor-pointer font-medium',
                      errors.category ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-800 focus:border-indigo-500'
                    ]"
                  >
                    <option :value="null" disabled>Select Hub...</option>
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id" class="bg-zinc-900 text-white">
                      {{ cat.name }}
                    </option>
                  </select>

                  <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <Transition name="fade">
                  <p v-if="errors.category" class="text-[9px] text-red-500 font-black uppercase mt-1.5 tracking-wider animate-pulse">
                    {{ errors.category[0] }}
                  </p>
                </Transition>
              </div>
            </div>
          </section>

          <section class="space-y-6">
            <h3 class="section-title">Valuation & Metrics</h3>
            <div class="grid grid-cols-2 gap-4">
              <FormInput label="Price (USD)" v-model.number="form.price" type="number" step="0.01" :error="errors.price?.[0]" />
              <FormInput label="Stock Units" v-model.number="form.stock_quantity" type="number" />
            </div>
            <FormInput label="Size / Version" v-model="form.size" placeholder="e.g. Large, 42, 1TB" />
          </section>

          <section class="space-y-6 pb-10">
            <h3 class="section-title">Visual Asset (Max 2MB)</h3>
            
            <div class="relative group h-32 w-full rounded-xl border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 transition-all flex items-center justify-center overflow-hidden bg-zinc-950 cursor-pointer">
              <img v-if="imagePreview" :src="imagePreview" class="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-20 transition-opacity duration-300" />
              
              <input type="file" @change="handleFileChange" accept="image/jpeg, image/png, image/webp" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              
              <div class="text-center z-0 pointer-events-none flex flex-col items-center gap-2">
                <svg v-if="!imagePreview" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-zinc-600 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span class="text-xs font-bold text-zinc-400 group-hover:text-indigo-400 transition-colors uppercase tracking-wider">
                  {{ imagePreview ? 'Replace Media' : 'Upload File' }}
                </span>
              </div>
            </div>
            <p v-if="errors.image" class="text-[10px] text-red-500 font-bold uppercase">{{ errors.image[0] }}</p>
          </section>

        </form>

        <footer class="mt-10">
          <button type="submit" @click="handleSubmit" class="submit-btn">
            {{ initialData ? 'Confirm Changes' : 'Deploy to Inventory' }}
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
/* O CSS permaneceu exatamente igual ao seu original, não alterei as classes. */
.section-title {
  font-size: 0.75rem; 
  font-weight: 900; 
  color: #6366f1; 
  text-transform: uppercase;
  letter-spacing: 0.3em;
  margin-bottom: 1rem;
}

.submit-btn {
  width: 100%;
  background-color: #ffffff;
  color: #000000;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 1rem 0;
  border-radius: 0.75rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 25px 50px -12px rgba(255, 255, 255, 0.05);
  border: none;
  cursor: pointer;
}

.submit-btn:hover {
  background-color: #e4e4e7; 
  transform: translateY(-1px);
}

.submit-btn:active {
  transform: scale(0.98);
}

.slide-enter-active, .slide-leave-active { 
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1); 
}
.slide-enter-from, .slide-leave-to { 
  transform: translateX(100%); 
}

.custom-scrollbar::-webkit-scrollbar { width: 3px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
</style>