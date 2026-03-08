<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/auth.service';
import { productService, type Product, type Category } from '../services/product.service';

const router = useRouter();
const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);

// --- ESTADOS DE FILTRO E PESQUISA ---
const selectedCategory = ref('All');

// --- ESTADOS DOS MODAIS ---
const isModalOpen = ref(false);
const isCategoryModalOpen = ref(false);
const newCategoryName = ref('');

// --- FORMULÁRIO DE PRODUTO ---
const selectedFile = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const newProduct = ref({
  name: '',
  price: '',
  category_name: '',
  is_available: true
});

// --- LÓGICA DE INTERFACE ---
const openModal = () => { isModalOpen.value = true; };
const closeModal = () => { 
  isModalOpen.value = false;
  resetForm();
};

const resetForm = () => {
  newProduct.value = { name: '', price: '', category_name: '', is_available: true };
  selectedFile.value = null;
  imagePreview.value = null;
};

// --- CARREGAMENTO DE DADOS ---
const fetchData = async () => {
  try {
    loading.value = true;
    const [productsRes, categoriesRes] = await Promise.all([
      productService.getAll(),
      productService.getCategories()
    ]);
    products.value = productsRes;
    categories.value = categoriesRes;
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);

// --- GESTÃO DE CATEGORIAS ---
const handleCreateCategory = async () => {
  if (!newCategoryName.value.trim()) return;
  try {
    const newCat = await productService.createCategory(newCategoryName.value);
    categories.value.push(newCat);
    newCategoryName.value = '';
    isCategoryModalOpen.value = false;
    alert("New category added! 🗽");
  } catch (error) {
    alert("Error creating category. Make sure it's unique.");
  }
};

// --- FILTRAGEM DINÂMICA ---
const filteredProducts = computed(() => {
  if (selectedCategory.value === 'All') return products.value;
  return products.value.filter(p => p.category === selectedCategory.value);
});

// --- CÁLCULOS DINÂMICOS ---
const totalRevenue = computed(() => {
  const total = filteredProducts.value.reduce((acc, product) => acc + parseFloat(product.price), 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total);
});

const getStats = computed(() => {
  const list = filteredProducts.value;
  return [
    { name: 'Revenue (Filtered)', value: totalRevenue.value, change: '+ dynamic', color: 'text-green-500' },
    { name: 'Shown Products', value: list.length.toString(), change: 'Live', color: 'text-blue-500' },
    { name: 'Available In Stock', value: list.filter(p => p.is_available).length.toString(), change: 'Stock', color: 'text-orange-500' },
  ];
});

// --- CRUD E LOGOUT ---
const handleLogout = () => { authService.logout(); router.push('/login'); };

const deleteProduct = async (id: number) => {
  if (confirm("Delete this product?")) {
    try {
      await productService.delete(id);
      await fetchData();
    } catch (error) {
      alert("Failed to delete.");
    }
  }
};

const handleFileUpload = (event: any) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    imagePreview.value = URL.createObjectURL(file);
  }
};

const handleCreateProduct = async () => {
  try {
    const formData = new FormData();
    formData.append('name', newProduct.value.name);
    formData.append('price', newProduct.value.price);
    formData.append('category', newProduct.value.category_name); 
    formData.append('is_available', String(newProduct.value.is_available));
    
    if (selectedFile.value) {
      formData.append('image', selectedFile.value);
    }

    await productService.create(formData);
    await fetchData(); 
    closeModal();
    alert("Success! Product created in dollars! 🗽");
  } catch (error: any) {
    alert("Check if all fields are correct.");
  }
};
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-white p-8">
    <header class="mb-10 flex justify-between items-center border-b border-gray-800 pb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-blue-500">BipFlow Manage</h1>
        <p class="text-gray-400">Welcome back, Chief. Monitoring your dollar revenue.</p>
      </div>
      
      <div class="flex gap-4">
        <button @click="handleLogout" class="border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg transition-all">
          Sign Out
        </button>
        <button @click="openModal" class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium shadow-lg transition-all">
          + New Product
        </button>
      </div>
    </header>

    <div v-if="loading" class="text-center py-20 text-blue-500 animate-pulse text-xl">
      Syncing with Backend...
    </div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div v-for="stat in getStats" :key="stat.name" class="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-md">
          <p class="text-sm font-medium text-gray-400">{{ stat.name }}</p>
          <div class="flex items-baseline justify-between mt-2">
            <h2 class="text-2xl font-bold">{{ stat.value }}</h2>
            <span :class="['text-xs font-bold px-2 py-1 bg-gray-900 rounded', stat.color]">
              {{ stat.change }}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-10">
        <div class="flex flex-col md:flex-row justify-between items-end mb-4 gap-4">
          <div>
            <h2 class="text-xl font-bold mb-3">Inventory Overview</h2>
            <div class="flex flex-wrap gap-2">
              <button 
                @click="selectedCategory = 'All'"
                :class="selectedCategory === 'All' ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700 text-gray-400'"
                class="px-4 py-1 rounded-full text-xs border transition-all"
              >
                All
              </button>
              <button 
                v-for="cat in categories" :key="cat.id"
                @click="selectedCategory = cat.name"
                :class="selectedCategory === cat.name ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700 text-gray-400'"
                class="px-4 py-1 rounded-full text-xs border transition-all"
              >
                {{ cat.name }}
              </button>
            </div>
          </div>
          
          <button @click="isCategoryModalOpen = true" class="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
            <span class="text-lg">+</span> Manage Categories
          </button>
        </div>

        <div class="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-xl">
          <table class="w-full text-left">
            <thead class="bg-gray-700/50 text-gray-300 text-sm uppercase">
              <tr>
                <th class="p-4">Product</th>
                <th class="p-4">Category</th>
                <th class="p-4 text-right">Price (USD)</th>
                <th class="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-gray-750 transition-colors">
                <td class="p-4 font-medium flex items-center gap-3">
                  <img 
                    :src="product.image || 'https://via.placeholder.com/40'" 
                    class="w-10 h-10 rounded-full object-cover border border-gray-600"
                  >
                  {{ product.name }}
                </td>
                <td class="p-4">
                   <span class="bg-gray-900 px-2 py-1 rounded text-xs border border-gray-700 text-gray-300">
                     {{ product.category }}
                   </span>
                </td>
                <td class="p-4 text-right text-green-400 font-bold">${{ product.price }}</td>
                <td class="p-4 text-center">
                  <button @click="deleteProduct(product.id)" class="text-red-500 hover:text-red-400 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="filteredProducts.length === 0" class="p-10 text-center text-gray-500 italic">
            No products found in this category.
          </div>
        </div>
      </div>
    </template>

    <div v-if="isModalOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-gray-800 border border-gray-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 class="text-2xl font-bold mb-6 text-blue-500">Add New Product</h2>
        <form @submit.prevent="handleCreateProduct" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1">Product Name</label>
            <input v-model="newProduct.name" type="text" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1">Price (USD)</label>
              <input v-model="newProduct.price" type="number" step="0.01" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1">Category</label>
              <select v-model="newProduct.category_name" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="" disabled>Select category</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.name">{{ cat.name }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1">Product Image</label>
            <input type="file" @change="handleFileUpload" accept="image/*" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer">
          </div>
          <div class="flex gap-4 pt-4">
            <button type="button" @click="closeModal" class="flex-1 px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors">Save Product</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="isCategoryModalOpen" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-gray-800 border border-gray-700 p-8 rounded-2xl w-full max-w-sm shadow-2xl">
        <h2 class="text-xl font-bold mb-4 text-blue-500">New Category</h2>
        <form @submit.prevent="handleCreateCategory" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1">Category Name</label>
            <input v-model="newCategoryName" type="text" placeholder="Ex: Drinks, Desserts" class="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required>
          </div>
          <div class="flex gap-3 pt-2">
            <button type="button" @click="isCategoryModalOpen = false" class="flex-1 px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-sm">Cancel</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors text-sm">Add Category</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>