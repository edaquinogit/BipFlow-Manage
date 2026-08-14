<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeftIcon, EnvelopeIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { customerLoginPath } from '@/router/auth.routes'
import { setSelectedStoreSlug } from '@/services/store-scope'
import type { ApiError } from '@/types/auth'

const route = useRoute()
const routeStoreSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
if (routeStoreSlug) {
  setSelectedStoreSlug(routeStoreSlug)
}

const form = reactive({
  email: '',
})

const isSubmitting = ref(false)
const validationHint = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const redirectQuery = computed(() => (
  route.query.redirect ? { redirect: route.query.redirect } : {}
))

const loginRoute = computed(() => ({
  path: customerLoginPath(routeStoreSlug),
  query: redirectQuery.value,
}))

function extractErrorMessage(error: unknown): string {
  const data = (error as ApiError).response?.data
  if (!data) return 'Não foi possível enviar o link agora. Tente novamente.'
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message
  return 'Confira o email informado e tente novamente.'
}

async function handleSubmit(): Promise<void> {
  validationHint.value = ''
  errorMessage.value = ''

  if (!form.email.trim()) {
    validationHint.value = 'Informe o email da sua conta para continuar.'
    return
  }

  isSubmitting.value = true
  successMessage.value = ''

  try {
    const response = await authService.requestPasswordReset({
      email: form.email.trim().toLowerCase(),
    })
    successMessage.value = response.message || 'Enviamos as instruções para o seu email.'
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="storefront-shell min-h-screen">
    <div class="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <RouterLink
        :to="loginRoute"
        class="mb-7 inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#05050A] transition hover:border-[#D81B60] hover:text-[#D81B60]"
      >
        <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
        Voltar
      </RouterLink>

      <div class="mb-6 text-center">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#D81B60]">Minha conta</p>
        <h1 class="mt-2 text-2xl font-semibold text-[#05050A]">Recuperar senha</h1>
        <p class="mt-2 text-sm leading-6 text-[#6B7280]">
          Informe seu email para receber um link seguro e voltar a comprar com seu perfil.
        </p>
      </div>

      <div
        v-if="successMessage"
        data-cy="password-reset-success"
        class="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        <div class="flex gap-3">
          <EnvelopeIcon class="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p class="font-semibold">Email enviado</p>
            <p class="mt-1 leading-6 text-emerald-700">{{ successMessage }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="validationHint"
        data-cy="password-reset-hint"
        class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
      >
        {{ validationHint }}
      </div>

      <div
        v-if="errorMessage"
        data-cy="password-reset-error"
        class="mb-5 rounded-xl border border-[#FCE7F3] bg-[#FCE7F3] p-3 text-sm text-[#7A143D]"
      >
        {{ errorMessage }}
      </div>

      <form v-if="!successMessage" class="space-y-4" @submit.prevent="handleSubmit">
        <label class="block">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Email</span>
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            required
            class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="voce@email.com"
          />
        </label>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#05050A] text-sm font-semibold text-white transition hover:bg-[#D81B60] disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
        >
          {{ isSubmitting ? 'Enviando...' : 'Enviar link seguro' }}
        </button>
      </form>

      <RouterLink
        :to="loginRoute"
        class="mt-6 text-center text-sm font-semibold text-[#6B7280] transition hover:text-[#D81B60]"
      >
        Voltar para entrar
      </RouterLink>
    </div>
  </div>
</template>
