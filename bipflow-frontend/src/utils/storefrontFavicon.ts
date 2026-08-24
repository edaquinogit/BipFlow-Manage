const STOREFRONT_FAVICON_SELECTOR = 'link[data-bipflow-storefront-favicon="true"]'

export function applyStorefrontFavicon(faviconUrl: string | null | undefined): void {
  if (typeof document === 'undefined') {
    return
  }

  const normalizedUrl = String(faviconUrl || '').trim()
  const existingLink = document.querySelector<HTMLLinkElement>(STOREFRONT_FAVICON_SELECTOR)

  if (!normalizedUrl) {
    existingLink?.remove()
    return
  }

  const link = existingLink ?? document.createElement('link')
  link.rel = 'icon'
  link.href = normalizedUrl
  link.dataset.bipflowStorefrontFavicon = 'true'

  if (!existingLink) {
    document.head.appendChild(link)
  }
}
