import { ref } from 'vue'
import { customerService } from '@/services/customer.service'
import { Logger } from '@/services/logger'
import type { CustomerProfile } from '@/types/customer'

// Singleton (mesmo padrao de useCurrentUser/useCurrentStore): a vitrine
// resolve o perfil uma vez e tanto o icone do header quanto o checkout leem
// o mesmo estado sem refazer a chamada.
const profile = ref<CustomerProfile | null>(null)
// null = ainda nao verificado; true/false = resultado da ultima checagem.
const hasProfile = ref<boolean | null>(null)
const loading = ref(false)

export function useCustomerProfile() {
  const fetchCustomerProfile = async (): Promise<boolean> => {
    loading.value = true

    try {
      profile.value = await customerService.getMe()
      hasProfile.value = true
      return true
    } catch (error: unknown) {
      profile.value = null
      hasProfile.value = false
      Logger.info('No customer profile for the current store', { error })
      return false
    } finally {
      loading.value = false
    }
  }

  const resetCustomerProfile = (): void => {
    profile.value = null
    hasProfile.value = null
  }

  return {
    profile,
    hasProfile,
    loading,
    fetchCustomerProfile,
    resetCustomerProfile,
  }
}
