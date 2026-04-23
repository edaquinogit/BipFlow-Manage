<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import { PublicRoutes } from '@/router/public.routes'
import type { ApiError } from '@/types/auth'

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  email: '',
  password: '',
  confirm_password: '',
})

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
  Boolean(form.email.trim()) && passwordRules.value.every((rule) => rule.passed)
)

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  const data = err.response?.data

  if (!data) return 'Nao foi possivel criar sua conta agora.'
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

const handleRegister = async () => {
  if (!isFormReady.value) {
    errorMessage.value = 'Preencha email, senha e confirmacao seguindo os criterios de seguranca.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await authService.register({
      email: form.email.trim().toLowerCase(),
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
  <div class="min-h-screen bg-gray-950 p-4 text-white">
    <main
      class="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/30 lg:grid-cols-[0.95fr_1.05fr]"
    >
      <section class="hidden border-r border-gray-800 bg-gray-950/70 p-10 lg:flex lg:flex-col lg:justify-between">
        <div class="space-y-6">
          <RouterLink
            :to="{ name: AuthRouteNames.Login }"
            class="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeftIcon class="h-4 w-4" />
            Voltar ao login
          </RouterLink>

          <div class="space-y-4">
            <span
              class="inline-flex w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200"
            >
              Conta segura
            </span>
            <h1 class="max-w-lg text-4xl font-bold tracking-tight text-white">
              Crie acesso administrativo com validacao por email.
            </h1>
            <p class="max-w-md text-sm leading-7 text-gray-300">
              Novas contas sao criadas ativas apos validacao de email e senha. A confirmacao por
              email fica reservada para recuperacao de senha.
            </p>
          </div>
        </div>

        <div class="grid gap-4">
          <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <ShieldCheckIcon class="mb-3 h-6 w-6 text-emerald-300" />
            <p class="text-sm font-semibold text-white">Padrao de seguranca</p>
            <p class="mt-2 text-sm leading-6 text-gray-400">
              Senha validada no frontend e no backend, com protecao contra emails duplicados.
            </p>
          </div>

          <RouterLink
            :to="{ name: PublicRoutes.Products }"
            class="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5 text-sm font-semibold text-cyan-200 transition-all hover:border-cyan-300/40 hover:bg-cyan-400/15"
          >
            Acessar catalogo publico sem criar conta
          </RouterLink>
        </div>
      </section>

      <section class="flex items-center p-6 sm:p-10">
        <div class="mx-auto w-full max-w-md">
          <div class="mb-8">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
              Novo usuario
            </p>
            <h2 class="mt-3 text-3xl font-bold tracking-tight text-white">Criar conta</h2>
            <p class="mt-2 text-sm leading-6 text-gray-400">
              Use um email valido e uma senha forte para liberar o acesso administrativo.
            </p>
          </div>

          <div
            v-if="successMessage"
            class="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"
          >
            <div class="flex gap-3">
              <CheckCircleIcon class="h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p class="font-semibold">Cadastro recebido</p>
                <p class="mt-1 leading-6 text-emerald-100/80">{{ successMessage }}</p>
              </div>
            </div>
          </div>

          <div
            v-if="errorMessage"
            class="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {{ errorMessage }}
          </div>

          <form v-if="!successMessage" @submit.prevent="handleRegister" class="space-y-5">
            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email
              </label>
              <input
                v-model="form.email"
                type="email"
                autocomplete="email"
                placeholder="admin@bipflow.com"
                class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Senha
              </label>
              <input
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                placeholder="Crie uma senha segura"
                class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Confirmar senha
              </label>
              <input
                v-model="form.confirm_password"
                type="password"
                autocomplete="new-password"
                placeholder="Repita a senha"
                class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              class="flex w-full items-center justify-center rounded-xl bg-emerald-500 py-3 text-xs font-bold uppercase tracking-widest text-gray-950 shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              {{ isSubmitting ? 'Criando conta...' : 'Criar conta segura' }}
            </button>
          </form>

          <div class="mt-8 flex flex-col gap-3 text-center text-sm text-gray-500">
            <RouterLink :to="{ name: AuthRouteNames.Login }" class="font-semibold text-blue-400 hover:text-blue-300">
              Ja tenho conta administrativa
            </RouterLink>
            <RouterLink :to="{ name: PublicRoutes.Products }" class="font-semibold text-cyan-300 hover:text-cyan-200">
              Ver catalogo publico
            </RouterLink>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
