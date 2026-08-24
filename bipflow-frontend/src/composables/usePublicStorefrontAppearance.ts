import { ref, watch, type Ref } from 'vue'
import { storefrontAppearanceService } from '@/services/storefront-appearance.service'
import type { PublicStorefrontAppearance } from '@/types/store'

export function usePublicStorefrontAppearance(storeSlug: Ref<string | null | undefined>) {
  const appearance = ref<PublicStorefrontAppearance | null>(null)
  const isLoading = ref(false)
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
      const loadedAppearance = await storefrontAppearanceService.getPublic(slug)
      if (requestId === loadRequestId && storeSlug.value === slug) {
        appearance.value = loadedAppearance
      }
    } catch {
      if (requestId === loadRequestId && storeSlug.value === slug) {
        appearance.value = null
        loadError.value = 'Nao foi possivel carregar a aparencia publica da vitrine.'
      }
    } finally {
      if (requestId === loadRequestId && storeSlug.value === slug) {
        isLoading.value = false
      }
    }
  }

  watch(storeSlug, () => {
    void load()
  }, { immediate: true })

  return { appearance, isLoading, loadError, load }
}
