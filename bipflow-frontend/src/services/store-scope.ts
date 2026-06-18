const STORE_SCOPE_STORAGE_KEY = 'bipflow_selected_store_slug'

let selectedStoreSlug = readPersistedStoreSlug()

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readPersistedStoreSlug(): string | null {
  if (!canUseBrowserStorage()) {
    return null
  }

  return window.localStorage.getItem(STORE_SCOPE_STORAGE_KEY)
}

export function getSelectedStoreSlug(): string | null {
  return selectedStoreSlug
}

export function setSelectedStoreSlug(slug: string | null): void {
  selectedStoreSlug = slug?.trim() || null

  if (!canUseBrowserStorage()) {
    return
  }

  if (selectedStoreSlug) {
    window.localStorage.setItem(STORE_SCOPE_STORAGE_KEY, selectedStoreSlug)
    return
  }

  window.localStorage.removeItem(STORE_SCOPE_STORAGE_KEY)
}
