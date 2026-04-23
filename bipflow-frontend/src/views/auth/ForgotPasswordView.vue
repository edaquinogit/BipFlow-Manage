<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { EnvelopeIcon, ShieldCheckIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import type { ApiError } from '@/types/auth'

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  email: '',
})

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  return err.response?.data?.detail || err.response?.data?.message || 'Nao foi possivel enviar o link agora.'
}

const handlePasswordResetRequest = async () => {
  if (!form.email.trim()) {
    errorMessage.value = 'Informe o email cadastrado para continuar.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await authService.requestPasswordReset({
      email: form.email.trim().toLowerCase(),
    })
    successMessage.value = response.message
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
    <main class="w-full max-w-lg rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-2xl shadow-black/30">
      <div class="mb-8 text-center">
        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
          <ShieldCheckIcon class="h-8 w-8" />
        </div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Recuperacao segura
        </p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight">Redefinir senha</h1>
        <p class="mt-3 text-sm leading-6 text-gray-400">
          Enviaremos um link seguro para confirmar que voce controla o email cadastrado antes
          de permitir a troca da senha.
        </p>
      </div>

      <div
        v-if="successMessage"
        class="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"
      >
        <div class="flex gap-3">
          <EnvelopeIcon class="h-5 w-5 shrink-0 text-emerald-300" />
          <p class="leading-6">{{ successMessage }}</p>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300"
      >
        {{ errorMessage }}
      </div>

      <form v-if="!successMessage" @submit.prevent="handlePasswordResetRequest" class="space-y-5">
        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Email cadastrado
          </label>
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            placeholder="admin@bipflow.com"
            class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          />
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="flex w-full items-center justify-center rounded-xl bg-cyan-400 py-3 text-xs font-bold uppercase tracking-widest text-gray-950 transition-all hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
        >
          {{ isSubmitting ? 'Enviando link...' : 'Enviar link seguro' }}
        </button>
      </form>

      <div class="mt-8 text-center text-sm">
        <RouterLink :to="{ name: AuthRouteNames.Login }" class="font-semibold text-blue-400 hover:text-blue-300">
          Voltar para login
        </RouterLink>
      </div>
    </main>
  </div>
</template>
