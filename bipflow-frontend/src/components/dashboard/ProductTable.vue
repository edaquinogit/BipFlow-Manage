<script setup lang="ts">
import type { Product } from '../../schemas/product.schema';

defineProps<{ products: Product[] }>();
const emit = defineEmits(['delete']);
</script>

<template>
  <table class="min-w-full divide-y divide-gray-700">
    <thead>
      <tr>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Price</th>
        <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-800">
      <tr v-for="product in products" :key="product.id">
        <td class="px-6 py-4 whitespace-nowrap text-white">{{ product.name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-green-400">${{ product.price }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right">
          <button @click="emit('delete', product.id)" class="text-red-500 hover:text-red-400">Delete</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>