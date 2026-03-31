<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import productService from '@/services/product.service'
import { categoryService } from '@/services/category.service'
import type { Category } from '@/schemas/category.schema'

const router = useRouter()
const isLoading = ref(false)
const errorMessage = ref('')
const categories = ref<Category[]>([])

const form = reactive({
  name: '',
  sku: `BIP-${Math.floor(1000 + Math.random() * 9000)}`, // Gera SKU único inicial
  description: '',
  price: 0,
  stock_quantity: 0,
  category: ''
})

onMounted(async () => {
  try {
    const data = await categoryService.getAll()
    categories.value = data
  } catch (err) {
    console.error('Falha ao carregar categorias', err)
  }
})

const handleSubmit = async () => {
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const formData = new FormData(); Object.entries(form).forEach(([key, val]) => formData.append(key, String(val))); await productService.create(formData)
    // Redireciona de volta para a lista após o sucesso
    router.push({ name: 'dashboard.products' })
  } catch (error: any) {
    // Captura o erro específico do SKU ou outros do Django
    const apiError = error.response?.data
    if (apiError?.sku) {
      errorMessage.value = `SKU Error: ${apiError.sku[0]}`
    } else {
      errorMessage.value = 'Falha ao salvar produto. Verifique os dados.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Provisioning Asset</h1>
        <p class="text-gray-400">Register new inventory items into the BipFlow Engine.</p>
      </div>
      <button @click="router.back()" class="text-gray-400 hover:text-white transition-colors">
        Cancel
      </button>
    </div>

    <form @submit.prevent="handleSubmit" class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
      
      <div v-if="errorMessage" class="col-span-full p-4 bg-red-500/10 border border-red-500/50 text-red-500 rounded-xl text-sm mb-4">
        {{ errorMessage }}
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Product Name</label>
        <input v-model="form.name" name="name" type="text" required placeholder="Ex: High-End Server"
          class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest">SKU (Stock Keeping Unit)</label>
        <input v-model="form.sku" name="sku" type="text" required
          class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all font-mono" />
      </div>

      <div class="space-y-2 col-span-full">
        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Category</label>
        <select v-model="form.category" name="category" required
          class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all appearance-none">
          <option value="" disabled>Select a category...</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Price (USD)</label>
        <input v-model.number="form.price" name="price" type="number" step="0.01" required
          class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest">Initial Stock</label>
        <input v-model.number="form.stock_quantity" name="stock_quantity" type="number" required
          class="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all" />
      </div>

      <div class="col-span-full mt-4">
        <button type="submit" :disabled="isLoading" data-cy="btn-save-product"
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 uppercase tracking-widest text-xs">
          {{ isLoading ? 'Syncing with Ledger...' : 'Commit Asset to Registry' }}
        </button>
      </div>
    </form>
  </div>
</template>
