import { ref, type Ref } from 'vue'
import { Logger } from '@/services/logger'
import { storeSettingsService } from '@/services/store-settings.service'

export interface UsePublicStoreSettingsReturn {
  storeWhatsappDigits: Ref<string>
  fetchPublicStoreSettings: () => Promise<void>
}

export function usePublicStoreSettings(context = 'catalog'): UsePublicStoreSettingsReturn {
  const storeWhatsappDigits = ref('')

  async function fetchPublicStoreSettings(): Promise<void> {
    try {
      const settings = await storeSettingsService.getPublic()
      storeWhatsappDigits.value = settings.is_whatsapp_configured
        ? settings.whatsapp_phone_digits
        : ''
    } catch (error) {
      storeWhatsappDigits.value = ''
      Logger.warn('Failed to load public store settings', {
        context,
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  }

  return {
    storeWhatsappDigits,
    fetchPublicStoreSettings,
  }
}
