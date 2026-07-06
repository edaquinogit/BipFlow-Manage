<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { UserCircleIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { useCustomerProfile } from '@/composables/useCustomerProfile'
import { createCustomerProfilePath, customerAccountPath, customerLoginPath } from '@/router/auth.routes'

// Minimalist storefront profile icon: not logged in -> "Entrar"/"Criar
// perfil" menu; logged in with a profile for this store -> straight to
// the account page. Etapa 2 of docs/architecture/customer-profile-
// checkout-evolution.md.
const route = useRoute()
const { hasProfile, fetchCustomerProfile } = useCustomerProfile()

const isMenuOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const storeSlug = computed(() => (
  typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
))

const accountRoute = computed(() => ({ path: customerAccountPath(storeSlug.value) }))

const createProfileRoute = computed(() => ({
  path: createCustomerProfilePath(storeSlug.value),
  query: { redirect: route.fullPath },
}))

const loginRoute = computed(() => ({
  path: customerLoginPath(storeSlug.value),
  query: { redirect: route.fullPath },
}))

function handleIconClick(): void {
  if (authService.isAuthenticated() && hasProfile.value) {
    return // RouterLink below already navigates straight to the account page.
  }

  isMenuOpen.value = !isMenuOpen.value
}

function closeMenu(): void {
  isMenuOpen.value = false
}

function handleOutsideClick(event: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

onMounted(async () => {
  window.addEventListener('click', handleOutsideClick)

  // Only if not already checked this session: this component remounts
  // fresh on every navigation between the product list and a product
  // detail page, and re-fetching on each one would be wasted work given
  // the singleton cache already answers "hasProfile" for the storefront's
  // display purposes (the checkout gate re-verifies for real regardless,
  // see useCheckoutProfileGate).
  if (authService.isAuthenticated() && hasProfile.value === null) {
    await fetchCustomerProfile()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleOutsideClick)
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <RouterLink
      v-if="authService.isAuthenticated() && hasProfile"
      :to="accountRoute"
      class="storefront-outline-button inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
      aria-label="Minha conta"
      title="Minha conta"
    >
      <UserCircleIcon class="h-5 w-5" aria-hidden="true" />
    </RouterLink>

    <button
      v-else
      type="button"
      class="storefront-outline-button inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
      aria-haspopup="menu"
      :aria-expanded="isMenuOpen"
      aria-label="Entrar ou criar perfil"
      title="Entrar ou criar perfil"
      @click="handleIconClick"
    >
      <UserCircleIcon class="h-5 w-5" aria-hidden="true" />
    </button>

    <div
      v-if="isMenuOpen"
      role="menu"
      class="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-48 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg"
    >
      <RouterLink
        :to="createProfileRoute"
        role="menuitem"
        class="block px-4 py-3 text-sm font-semibold text-[#05050A] transition hover:bg-[#FAFAFA]"
        @click="closeMenu"
      >
        Criar perfil
      </RouterLink>
      <RouterLink
        :to="loginRoute"
        role="menuitem"
        class="block border-t border-[#E5E7EB] px-4 py-3 text-sm text-[#6B7280] transition hover:bg-[#FAFAFA]"
        @click="closeMenu"
      >
        Entrar
      </RouterLink>
    </div>
  </div>
</template>
