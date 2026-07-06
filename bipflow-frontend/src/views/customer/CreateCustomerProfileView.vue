<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircleIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useCustomerProfile } from '@/composables/useCustomerProfile'
import { usePasswordStrength } from '@/composables/usePasswordStrength'
import { PublicRoutes } from '@/router/public.routes'
import { setSelectedStoreSlug } from '@/services/store-scope'
import type { ApiError } from '@/types/auth'

const route = useRoute()
const router = useRouter()
const routeStoreSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
if (routeStoreSlug) {
  setSelectedStoreSlug(routeStoreSlug)
}

const { selectedStore, fetchCurrentStore } = useCurrentStore()
const { hasProfile, fetchCustomerProfile } = useCustomerProfile()

const isAuthenticatedWithoutProfile = computed(() => (
  authService.isAuthenticated() && hasProfile.value === false
))

const isCheckingExistingProfile = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')
const validationHint = ref('')

const form = reactive({
  full_name: '',
  phone: '',
  email: '',
  password: '',
  confirm_password: '',
  address: '',
  neighborhood: '',
  city: '',
})

const {
  rules: passwordRules,
  label: strengthLabel,
  barClass: strengthBarClass,
  filledBars: strengthFilledBars,
  totalBars: strengthTotalBars,
  isValid: isPasswordValid,
} = usePasswordStrength(computed(() => form.password))

const confirmRule = computed(() => ({
  label: 'Confirmação igual à senha',
  passed: Boolean(form.confirm_password) && form.password === form.confirm_password,
}))

const allPasswordRules = computed(() => [...passwordRules.value, confirmRule.value])

const isFormReady = computed(() =>
  Boolean(form.full_name.trim())
  && Boolean(form.phone.trim())
  && Boolean(form.email.trim())
  && isPasswordValid.value
  && confirmRule.value.passed
)

function extractErrorMessage(error: unknown): string {
  const err = error as ApiError
  const data = err.response?.data

  if (!data) return 'Não foi possível criar seu perfil agora.'
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

function redirectAfterSuccess(): void {
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
  validationHint.value = ''
  errorMessage.value = ''

  if (!isFormReady.value) {
    validationHint.value = 'Preencha nome, WhatsApp, email e uma senha segura.'
    return
  }

  isSubmitting.value = true

  try {
    const email = form.email.trim().toLowerCase()

    await authService.register({
      email,
      password: form.password,
      confirm_password: form.confirm_password,
      registration_context: 'storefront_customer',
      store_slug: selectedStore.value?.slug || routeStoreSlug,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
    })

    await authService.login({ email, password: form.password })
    await fetchCustomerProfile()
    redirectAfterSuccess()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    fetchCurrentStore(),
    authService.isAuthenticated() ? fetchCustomerProfile() : Promise.resolve(),
  ])

  isCheckingExistingProfile.value = false
})
</script>

<template>
  <div class="storefront-shell min-h-screen">
    <div class="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <div v-if="isCheckingExistingProfile" class="animate-pulse text-center text-sm text-[#6B7280]">
        Carregando...
      </div>

      <div v-else-if="hasProfile" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircleIcon class="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
        <p class="mt-3 text-base font-semibold text-emerald-900">Você já tem um perfil nesta loja.</p>
        <button
          type="button"
          class="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#05050A] px-5 text-sm font-semibold text-white transition hover:bg-[#D81B60]"
          @click="redirectAfterSuccess"
        >
          Voltar para a loja
        </button>
      </div>

      <div
        v-else-if="isAuthenticatedWithoutProfile"
        class="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"
      >
        <p class="text-base font-semibold text-amber-900">
          Sua conta já existe, mas ainda não tem perfil nesta loja.
        </p>
        <p class="mt-2 text-sm leading-6 text-amber-800">
          Hoje só é possível criar um perfil novo com um email ainda não cadastrado. Fale com a loja
          se precisar de ajuda para comprar por aqui com a conta atual.
        </p>
        <button
          type="button"
          class="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-[#05050A] px-5 text-sm font-semibold text-white transition hover:bg-[#D81B60]"
          @click="redirectAfterSuccess"
        >
          Voltar para a loja
        </button>
      </div>

      <template v-else>
        <div class="mb-6 text-center">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#D81B60]">Criar perfil</p>
          <h1 class="mt-2 text-2xl font-semibold text-[#05050A]">Seus dados para comprar mais rápido</h1>
          <p class="mt-2 text-sm leading-6 text-[#6B7280]">
            Guardamos seu nome, WhatsApp e endereço para você não precisar redigitar em todo pedido.
          </p>
        </div>

        <div
          v-if="validationHint"
          class="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          {{ validationHint }}
        </div>

        <div
          v-if="errorMessage"
          class="mb-5 rounded-xl border border-[#FCE7F3] bg-[#FCE7F3] p-3 text-sm text-[#7A143D]"
        >
          {{ errorMessage }}
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Nome</span>
            <input
              v-model="form.full_name"
              type="text"
              autocomplete="name"
              required
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              placeholder="Seu nome"
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">WhatsApp</span>
              <input
                v-model="form.phone"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                required
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                placeholder="+55 71 99999-9999"
              />
            </label>

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
          </div>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Endereço <span class="normal-case text-[#9CA3AF]">(opcional agora, necessário para entrega)</span>
            </span>
            <input
              v-model="form.address"
              type="text"
              autocomplete="street-address"
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              placeholder="Rua, número e complemento"
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Bairro</span>
              <input
                v-model="form.neighborhood"
                type="text"
                autocomplete="address-level3"
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                placeholder="Bairro"
              />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Cidade</span>
              <input
                v-model="form.city"
                type="text"
                autocomplete="address-level2"
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                placeholder="Cidade"
              />
            </label>
          </div>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Senha</span>
            <input
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              required
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              placeholder="Crie uma senha segura"
            />

            <div v-if="form.password" class="mt-2 space-y-1">
              <div class="flex gap-1">
                <span
                  v-for="index in strengthTotalBars"
                  :key="index"
                  class="h-1.5 flex-1 rounded-full transition-colors"
                  :class="index <= strengthFilledBars ? strengthBarClass : 'bg-zinc-200'"
                />
              </div>
              <p class="text-xs font-semibold text-[#6B7280]">Força: {{ strengthLabel }}</p>
            </div>
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Confirmar senha
            </span>
            <input
              v-model="form.confirm_password"
              type="password"
              autocomplete="new-password"
              required
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              placeholder="Repita a senha"
            />
          </label>

          <ul class="grid gap-2 border-t border-[#E5E7EB] pt-4">
            <li
              v-for="rule in allPasswordRules"
              :key="rule.label"
              class="flex items-center gap-2 text-xs"
              :class="rule.passed ? 'text-emerald-700' : 'text-[#6B7280]'"
            >
              <span class="h-2 w-2 rounded-full" :class="rule.passed ? 'bg-emerald-500' : 'bg-zinc-300'"></span>
              {{ rule.label }}
            </li>
          </ul>

          <button
            type="submit"
            :disabled="isSubmitting || !isFormReady"
            class="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#05050A] text-sm font-semibold text-white transition hover:bg-[#D81B60] disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
          >
            {{ isSubmitting ? 'Criando perfil...' : 'Criar perfil' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
