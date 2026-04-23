<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CheckCircleIcon, KeyIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import type { ApiError } from '@/types/auth'

const route = useRoute()
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  password: '',
  confirm_password: '',
})

const uid = computed(() => String(route.query.uid || route.params.token || ''))
const token = computed(() => String(route.query.token || ''))
const hasValidLink = computed(() => Boolean(uid.value && token.value))

const passwordRules = computed(() => [
  { label: 'No minimo 8 caracteres', passed: form.password.length >= 8 },
  { label: 'Contem uma letra', passed: /[A-Za-z]/.test(form.password) },
  { label: 'Contem um numero', passed: /\d/.test(form.password) },
  {
    label: 'Confirmacao igual a senha',
    passed: Boolean(form.confirm_password) && form.password === form.confirm_password,
  },
])

const isFormReady = computed(() =>
  hasValidLink.value && passwordRules.value.every((rule) => rule.passed)
)

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  const data = err.response?.data

  if (!data) return 'Nao foi possivel redefinir a senha agora.'
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message

  const firstFieldError = Object.values(data).find((value) => Array.isArray(value) || typeof value === 'string')

  if (Array.isArray(firstFieldError)) {
    return String(firstFieldError[0] || 'Confira os dados informados.')
  }

  return typeof firstFieldError === 'string'
    ? firstFieldError
    : 'Confira os dados informados e tente novamente.'
}

const handlePasswordResetConfirm = async () => {
  if (!isFormReady.value) {
    errorMessage.value = hasValidLink.value
      ? 'Preencha a nova senha seguindo os criterios de seguranca.'
      : 'Link de recuperacao incompleto. Solicite um novo email.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await authService.confirmPasswordReset({
      uid: uid.value,
      token: token.value,
      password: form.password,
      confirm_password: form.confirm_password,
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
        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10 text-blue-200">
          <KeyIcon class="h-8 w-8" />
        </div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">
          Nova senha
        </p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight">Criar nova senha</h1>
        <p class="mt-3 text-sm leading-6 text-gray-400">
          O link recebido por email confirma sua identidade. Defina uma senha forte para
          recuperar o acesso administrativo.
        </p>
      </div>

      <div
        v-if="successMessage"
        class="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"
      >
        <div class="flex gap-3">
          <CheckCircleIcon class="h-5 w-5 shrink-0 text-emerald-300" />
          <p class="leading-6">{{ successMessage }}</p>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="!hasValidLink"
        class="mb-6 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"
      >
        Este link nao possui os parametros de seguranca necessarios. Solicite um novo email de recuperacao.
      </div>

      <form v-if="!successMessage" @submit.prevent="handlePasswordResetConfirm" class="space-y-5">
        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Nova senha
          </label>
          <input
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            placeholder="Digite a nova senha"
            class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Confirmar nova senha
          </label>
          <input
            v-model="form.confirm_password"
            type="password"
            autocomplete="new-password"
            placeholder="Repita a nova senha"
            class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <ul class="grid gap-2 rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
          <li
            v-for="rule in passwordRules"
            :key="rule.label"
            class="flex items-center gap-2 text-xs"
            :class="rule.passed ? 'text-emerald-300' : 'text-gray-500'"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="rule.passed ? 'bg-emerald-300' : 'bg-gray-700'"
            ></span>
            {{ rule.label }}
          </li>
        </ul>

        <button
          type="submit"
          :disabled="isSubmitting || !isFormReady"
          class="flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
        >
          {{ isSubmitting ? 'Redefinindo senha...' : 'Redefinir senha' }}
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
