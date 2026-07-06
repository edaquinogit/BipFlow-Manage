import { useRoute, useRouter } from 'vue-router'
import { createCustomerProfilePath } from '@/router/auth.routes'
import { authService } from '@/services/auth.service'
import { useCustomerProfile } from '@/composables/useCustomerProfile'
import { useToast } from '@/composables/useToast'

/**
 * Etapa 3 of docs/architecture/customer-profile-checkout-evolution.md:
 * checkout requires a CustomerProfile now. Shared by ProductsView.vue and
 * ProductDetailView.vue so the gate (and its redirect-back-here behavior)
 * never drifts between the two places "Finalizar no WhatsApp" can be
 * triggered from.
 */
export function useCheckoutProfileGate() {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const { hasProfile, fetchCustomerProfile } = useCustomerProfile()

  async function ensureCustomerProfile(): Promise<boolean> {
    if (authService.isAuthenticated()) {
      // Always refetch fresh here, never trust the cached singleton: this
      // gate runs right before finalizing a real order, and the cache can
      // be stale from a different store (e.g. the customer switched
      // stores client-side without a full page reload after it was
      // populated). Not a hot path, so the extra round trip is cheap
      // compared to gating a purchase on stale cross-store state.
      await fetchCustomerProfile()

      if (hasProfile.value) {
        return true
      }
    }

    toast.info('Crie seu perfil para finalizar o pedido.')

    const storeSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
    await router.push({
      path: createCustomerProfilePath(storeSlug),
      query: { redirect: route.fullPath },
    })

    return false
  }

  return { ensureCustomerProfile }
}
