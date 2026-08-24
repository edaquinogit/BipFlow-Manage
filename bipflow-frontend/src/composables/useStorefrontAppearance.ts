import { ref, watch, type Ref } from 'vue'
import { storefrontAppearanceService } from '@/services/storefront-appearance.service'
import { Logger } from '@/services/logger'
import { buildErrorContext, type ApplicationError } from '@/types/errors'
import type { StorefrontAppearance, StorefrontAppearancePayload } from '@/types/store'

const STOREFRONT_APPEARANCE_ENDPOINT = 'v1/store/current/storefront-appearance/'

/**
 * Shared load/save for the dashboard's storefront appearance editor tabs
 * (Banner, Layout/Motion) -- keeps a single fetch per store slug instead of
 * each section tab hitting the endpoint independently.
 */
export function useStorefrontAppearance(storeSlug: Ref<string | null | undefined>) {
  const appearance = ref<StorefrontAppearance | null>(null)
  const isLoading = ref(false);
  const loadError = ref<string | null>(null)
  let loadRequestId = 0

  async function load(): Promise<void> {
    const slug = storeSlug.value
    const requestId = ++loadRequestId

    if (!slug) {
      appearance.value = null
      isLoading.value = false
      loadError.value = null
      return
    }

    appearance.value = null
    isLoading.value = true
    loadError.value = null

    try {
      const loadedAppearance = await storefrontAppearanceService.get()
      if (requestId === loadRequestId && storeSlug.value === slug) {
        appearance.value = loadedAppearance
      }
    } catch (error: unknown) {
      if (requestId === loadRequestId && storeSlug.value === slug) {
        appearance.value = null
        loadError.value = 'Nao foi possivel carregar a aparencia da vitrine.'
        Logger.error(
          'Storefront appearance load failed',
          buildErrorContext(error as ApplicationError, {
            endpoint: STOREFRONT_APPEARANCE_ENDPOINT,
            selectedStoreSlug: slug,
          }),
        )
      }
    } finally {
      if (requestId === loadRequestId && storeSlug.value === slug) {
        isLoading.value = false
      }
    }
  }

  async function save(payload: StorefrontAppearancePayload): Promise<StorefrontAppearance> {
    const slug = storeSlug.value
    if (!slug) {
      throw new Error('Nenhuma loja selecionada.')
    }

    const updated = await storefrontAppearanceService.update(payload)
    if (storeSlug.value === slug) {
      appearance.value = updated
    }
    return updated
  }

  watch(storeSlug, () => {
    void load()
  }, { immediate: true })

  return { appearance, isLoading, loadError, load, save }
}
