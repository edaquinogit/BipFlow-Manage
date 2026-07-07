<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authService } from '@/services/auth.service'
import { useCustomerProfile } from '@/composables/useCustomerProfile'
import { AuthRouteNames, createCustomerProfilePath } from '@/router/auth.routes'
import { PublicRoutes } from '@/router/public.routes'
import { setSelectedStoreSlug } from '@/services/store-scope'
import type { ApiError } from '@/types/auth'

// Storefront customer login. Deliberately a separate component from the
// dashboard's LoginView.vue (see docs/architecture/customer-profile-
// checkout-evolution.md): a shopper clicking "Entrar" from the vitrine
// must land somewhere that reads as logging into their customer profile,
// reusing this same storefront-styled shell, not the admin panel branding.
const route = useRoute()
const router = useRouter()
const routeStoreSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
if (routeStoreSlug) {
  setSelectedStoreSlug(routeStoreSlug)
}

const { fetchCustomerProfile } = useCustomerProfile()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

// Same reasoning as LoginView.vue's sessionNotice: the router guard's
// requiresCustomerAuth redirect and the API's 401 handler both attach
// ?reason=, previously never surfaced to the shopper.
const sessionNotice = computed(() => {
  switch (route.query.reason) {
    case 'session_expired':
      return 'Sua sessão expirou. Entre novamente para continuar.'
    case 'customer_auth_required':
      return 'Entre na sua conta para continuar.'
    default:
      return ''
  }
})

function extractErrorMessage(error: unknown): string {
  const data = (error as ApiError).response?.data
  if (!data) return 'Não foi possível entrar agora. Tente novamente.'
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message
  return 'Email ou senha inválidos.'
}

function redirectAfterLogin(): void {
  const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : ''

  if (redirectTarget) {
    void router.push(redirectTarget)
    return
  }

  void router.push(
    routeStoreSlug
      ? { name: PublicRoutes.StoreProducts, params: { storeSlug: routeStoreSlug } }
      : { name: PublicRoutes.Products }
  )
}

async function handleSubmit(): Promise<void> {
  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Informe email e senha para continuar.'
    return
  }

  errorMessage.value = ''
  isSubmitting.value = true

  try {
    const result = await authService.login({ email: email.value.trim(), password: password.value })

    if ('mfa_required' in result) {
      // Storefront customer accounts never go through the dashboard's MFA
      // setup flow, so this should only happen for a shared email that
      // also has a dashboard/staff account with MFA enabled -- rare enough
      // that a clear message beats building a second MFA UI for it here.
      errorMessage.value = 'Esta conta exige verificação em duas etapas. Acesse pelo painel administrativo.'
      return
    }

    await fetchCustomerProfile()
    redirectAfterLogin()
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
      <div class="mb-6 text-center">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#D81B60]">Minha conta</p>
        <h1 class="mt-2 text-2xl font-semibold text-[#05050A]">Entrar</h1>
        <p class="mt-2 text-sm leading-6 text-[#6B7280]">
          Acesse seu perfil para finalizar pedidos mais rápido.
        </p>
      </div>

      <div
        v-if="sessionNotice"
        data-cy="session-notice"
        class="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800"
      >
        {{ sessionNotice }}
      </div>

      <div
        v-if="errorMessage"
        data-cy="login-error"
        class="mb-5 rounded-xl border border-[#FCE7F3] bg-[#FCE7F3] p-3 text-sm text-[#7A143D]"
      >
        {{ errorMessage }}
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <label class="block">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Email</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="voce@email.com"
          />
        </label>

        <label class="block">
          <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Senha</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="Sua senha"
          />
        </label>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#05050A] text-sm font-semibold text-white transition hover:bg-[#D81B60] disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
        >
          {{ isSubmitting ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>

      <div class="mt-6 flex flex-col items-center gap-2 text-sm">
        <RouterLink
          :to="{ path: createCustomerProfilePath(routeStoreSlug), query: route.query.redirect ? { redirect: route.query.redirect } : {} }"
          class="font-semibold text-[#D81B60] hover:underline"
        >
          Ainda não tem perfil? Criar agora
        </RouterLink>
        <RouterLink :to="{ name: AuthRouteNames.ForgotPassword }" class="text-[#6B7280] hover:underline">
          Esqueci minha senha
        </RouterLink>
      </div>
    </div>
  </div>
</template>
