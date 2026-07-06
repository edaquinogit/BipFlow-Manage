<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { customerService } from '@/services/customer.service'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useCustomerProfile } from '@/composables/useCustomerProfile'
import { useToast } from '@/composables/useToast'
import { PublicRoutes } from '@/router/public.routes'
import { setSelectedStoreSlug } from '@/services/store-scope'
import type { ApiError } from '@/types/auth'

const route = useRoute()
const routeStoreSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
if (routeStoreSlug) {
  setSelectedStoreSlug(routeStoreSlug)
}

const toast = useToast()
const { selectedStore, fetchCurrentStore } = useCurrentStore()
const { profile, fetchCustomerProfile } = useCustomerProfile()

const isLoading = ref(true)
const isSaving = ref(false)

const form = reactive({
  full_name: '',
  phone: '',
  address: '',
  neighborhood: '',
  city: '',
})

function extractErrorMessage(error: unknown): string {
  const data = (error as ApiError).response?.data
  if (!data) return 'Não foi possível salvar agora.'
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message
  return 'Confira os dados informados e tente novamente.'
}

async function handleSave(): Promise<void> {
  isSaving.value = true

  try {
    const updated = await customerService.updateMe({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
    })
    profile.value = updated
    toast.success('Perfil atualizado.')
  } catch (error) {
    toast.error(extractErrorMessage(error))
  } finally {
    isSaving.value = false
  }
}

const catalogRoute = routeStoreSlug
  ? { name: PublicRoutes.StoreProducts, params: { storeSlug: routeStoreSlug } }
  : { name: PublicRoutes.Products }

async function handleLogout(): Promise<void> {
  await authService.logout()
}

onMounted(async () => {
  const [, found] = await Promise.all([fetchCurrentStore(), fetchCustomerProfile()])

  if (found && profile.value) {
    form.full_name = profile.value.full_name
    form.phone = profile.value.phone
    form.address = profile.value.address
    form.neighborhood = profile.value.neighborhood
    form.city = profile.value.city
  }

  isLoading.value = false
})
</script>

<template>
  <div class="storefront-shell min-h-screen">
    <div class="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <RouterLink
        :to="catalogRoute"
        class="storefront-outline-button inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-[11px] font-bold uppercase tracking-[0.14em]"
      >
        <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
        Voltar ao catálogo
      </RouterLink>

      <div v-if="isLoading" class="mt-8 animate-pulse text-center text-sm text-[#6B7280]">
        Carregando...
      </div>

      <template v-else-if="!profile">
        <div class="mt-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
          <p class="text-sm text-[#6B7280]">Você ainda não tem um perfil nesta loja.</p>
        </div>
      </template>

      <template v-else>
        <div class="mt-8 mb-6">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#D81B60]">Minha conta</p>
          <h1 class="mt-2 text-2xl font-semibold text-[#05050A]">{{ selectedStore?.name }}</h1>
          <p class="mt-1 text-sm text-[#6B7280]">{{ profile.email }}</p>
        </div>

        <form class="space-y-4" @submit.prevent="handleSave">
          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Nome</span>
            <input
              v-model="form.full_name"
              type="text"
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">WhatsApp</span>
            <input
              v-model="form.phone"
              type="tel"
              inputmode="tel"
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Endereço</span>
            <input
              v-model="form.address"
              type="text"
              autocomplete="street-address"
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Bairro</span>
              <input
                v-model="form.neighborhood"
                type="text"
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Cidade</span>
              <input
                v-model="form.city"
                type="text"
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              />
            </label>
          </div>

          <button
            type="submit"
            :disabled="isSaving"
            class="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#05050A] text-sm font-semibold text-white transition hover:bg-[#D81B60] disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
          >
            {{ isSaving ? 'Salvando...' : 'Salvar' }}
          </button>
        </form>

        <button
          type="button"
          class="mt-6 w-full text-center text-sm font-semibold text-[#6B7280] transition hover:text-[#D81B60]"
          @click="handleLogout"
        >
          Sair da conta
        </button>
      </template>
    </div>
  </div>
</template>
