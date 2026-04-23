<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import { PublicRoutes } from '@/router/public.routes'
import type { ApiError } from '@/types/auth'

const route = useRoute()
const isLoading = ref(true)
const status = ref<'success' | 'error'>('success')
const message = ref('Validando seu email com seguranca...')

const uid = computed(() => String(route.query.uid || ''))
const token = computed(() => String(route.query.token || ''))

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  const data = err.response?.data

  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.message === 'string') return data.message

  const firstFieldError = data
    ? Object.values(data).find((value) => Array.isArray(value) || typeof value === 'string')
    : null

  if (Array.isArray(firstFieldError)) {
    return String(firstFieldError[0] || 'Link invalido ou expirado.')
  }

  return typeof firstFieldError === 'string'
    ? firstFieldError
    : 'Nao foi possivel validar este link. Solicite um novo cadastro.'
}

onMounted(async () => {
  if (!uid.value || !token.value) {
    status.value = 'error'
    message.value = 'Link de verificacao incompleto.'
    isLoading.value = false
    return
  }

  try {
    const response = await authService.verifyEmail({
      uid: uid.value,
      token: token.value,
    })
    status.value = 'success'
    message.value = response.message
  } catch (error) {
    status.value = 'error'
    message.value = extractErrorMessage(error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
    <main class="w-full max-w-lg rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-2xl shadow-black/30">
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border"
          :class="status === 'success'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
            : 'border-amber-400/30 bg-amber-400/10 text-amber-300'"
        >
          <CheckCircleIcon v-if="status === 'success'" class="h-8 w-8" />
          <ExclamationTriangleIcon v-else class="h-8 w-8" />
        </div>

        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Verificacao de email
        </p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight">
          {{ isLoading ? 'Validando acesso' : status === 'success' ? 'Conta ativada' : 'Link nao validado' }}
        </h1>
        <p class="mt-3 text-sm leading-6 text-gray-400">{{ message }}</p>
      </div>

      <div class="grid gap-3">
        <RouterLink
          :to="{ name: AuthRouteNames.Login }"
          class="rounded-xl bg-blue-600 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-700"
        >
          Ir para login
        </RouterLink>
        <RouterLink
          :to="{ name: PublicRoutes.Products }"
          class="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-cyan-200 transition-colors hover:bg-cyan-400/15"
        >
          Ver catalogo publico
        </RouterLink>
      </div>
    </main>
  </div>
</template>
