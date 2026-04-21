<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '@/services/auth.service'
import { DashboardRoutes } from '@/router/dashboard.routes'
import type { ApiError } from '@/types/auth'

const router = useRouter()
const isLoading = ref(false)
const errorMessage = ref('')

const form = reactive({
  email: '',
  password: ''
})

const handleLogin = async () => {
  if (!form.email || !form.password) {
    errorMessage.value = 'Please fill in all fields.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await authService.login(form)
    // authService now handles all token persistence through centralized tokenStore
    router.push({ name: DashboardRoutes.Root })
  } catch (error) {
    const err = error as ApiError
    errorMessage.value = err.response?.data?.detail || 'Connection failed. Check your backend.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl">

      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-white tracking-tight">BipFlow Manage</h1>
        <p class="text-gray-400 mt-2 text-sm">Sign in to manage your dollar revenue</p>
      </div>

      <div v-if="errorMessage" class="mb-6 p-3 bg-red-500/10 border border-red-500/50 text-red-500 text-sm rounded-lg animate-pulse">
        {{ errorMessage }}
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="ceo@bipflow.com"
            class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            required
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            class="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            required
          />
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex justify-center items-center font-sans tracking-widest uppercase text-xs"
        >
          <span v-if="isLoading" class="animate-spin mr-2 border-2 border-white/20 border-t-white rounded-full w-4 h-4"></span>
          {{ isLoading ? 'Authenticating...' : 'Sign In' }}
        </button>
      </form>

      <p class="mt-8 text-center text-sm text-gray-500">
        By signing in, you agree to our
        <a href="#" class="text-blue-500 hover:underline">Terms of Service</a>.
      </p>
    </div>
  </div>
</template>
