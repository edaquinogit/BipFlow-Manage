const STORE_SCOPE_STORAGE_KEY = 'bipflow_selected_store_slug'

let selectedStoreSlug = readPersistedStoreSlug()
let selectedStoreSlugIsTrusted = selectedStoreSlug === null
const listeners = new Set<(slug: string | null) => void>()

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

export function getRequestStoreSlug(): string | null {
  return selectedStoreSlugIsTrusted ? selectedStoreSlug : null
}

export function setSelectedStoreSlug(slug: string | null): void {
  setSelectedStoreSlugInternal(slug, true)
}

export function clearSelectedStore(): void {
  setSelectedStoreSlugInternal(null, true)
}

export function subscribeStoreScopeChange(listener: (slug: string | null) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setSelectedStoreSlugInternal(slug: string | null, trusted: boolean): void {
  const previousSlug = selectedStoreSlug
  const previousTrust = selectedStoreSlugIsTrusted
  selectedStoreSlug = slug?.trim() || null
  selectedStoreSlugIsTrusted = selectedStoreSlug ? trusted : true

  if (!canUseBrowserStorage()) {
    notifyStoreScopeChange(previousSlug, previousTrust)
    return
  }

  if (selectedStoreSlug) {
    window.localStorage.setItem(STORE_SCOPE_STORAGE_KEY, selectedStoreSlug)
  } else {
    window.localStorage.removeItem(STORE_SCOPE_STORAGE_KEY)
  }

  notifyStoreScopeChange(previousSlug, previousTrust)
}

function notifyStoreScopeChange(previousSlug: string | null, previousTrust: boolean): void {
  if (previousSlug === selectedStoreSlug && previousTrust === selectedStoreSlugIsTrusted) {
    return
  }

  listeners.forEach((listener) => {
    listener(selectedStoreSlug)
  })
}
