const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"])

interface BuildPublicStorefrontUrlOptions {
  runtimeOrigin?: string
}

interface BuildPublicProductUrlOptions extends BuildPublicStorefrontUrlOptions {
  storeSlug?: string
  productSlug?: string
  productCode?: string
}

const ROUTE_SEGMENT_PATTERN = /^[^/?#\s]+$/

function getConfiguredStorefrontBaseUrl(): string {
  return (import.meta.env.VITE_PUBLIC_STOREFRONT_BASE_URL as string | undefined)?.trim() || ''
}

function isPrivateOrLoopbackIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map((part) => Number(part))

  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  const first = octets[0] ?? -1
  const second = octets[1] ?? -1

  return (
    first === 10
    || first === 127
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254)
  )
}

function isLocalHttpHost(hostname: string): boolean {
  const normalizedHost = hostname.trim().toLowerCase()

  return (
    LOCALHOST_HOSTS.has(normalizedHost)
    || normalizedHost.endsWith('.localhost')
    || isPrivateOrLoopbackIpv4(normalizedHost)
  )
}

function canUseHttpProtocol(url: URL): boolean {
  return url.protocol === 'http:' && isLocalHttpHost(url.hostname)
}

function isSupportedPublicProtocol(url: URL): boolean {
  return url.protocol === 'https:' || canUseHttpProtocol(url)
}

function normalizePath(path: string): string {
  const trimmedPath = path.trim()
  if (!trimmedPath) {
    return ''
  }

  return trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
}

function normalizeRouteSegment(segment: string | undefined): string {
  const normalizedSegment = (segment || '').trim()

  if (!normalizedSegment || !ROUTE_SEGMENT_PATTERN.test(normalizedSegment)) {
    return ''
  }

  return normalizedSegment
}

function resolveBaseUrl(runtimeOrigin?: string): URL | null {
  const configuredBaseUrl = getConfiguredStorefrontBaseUrl()
  const baseCandidate = configuredBaseUrl || runtimeOrigin || ''

  if (!baseCandidate) {
    return null
  }

  try {
    const baseUrl = new URL(baseCandidate)
    if (!isSupportedPublicProtocol(baseUrl)) {
      return null
    }

    return baseUrl
  } catch {
    return null
  }
}

export function buildPublicStorefrontUrl(
  storefrontPath: string,
  options: BuildPublicStorefrontUrlOptions = {},
): string | null {
  const normalizedPath = normalizePath(storefrontPath)
  if (!normalizedPath) {
    return null
  }

  const baseUrl = resolveBaseUrl(options.runtimeOrigin)
  if (!baseUrl) {
    return null
  }

  try {
    const resolvedUrl = new URL(normalizedPath, `${baseUrl.origin}/`)
    if (!isSupportedPublicProtocol(resolvedUrl)) {
      return null
    }

    return resolvedUrl.toString()
  } catch {
    return null
  }
}

export function buildPublicProductUrl(options: BuildPublicProductUrlOptions): string | null {
  const storeSlug = normalizeRouteSegment(options.storeSlug)
  const productSlug = normalizeRouteSegment(options.productSlug)
  const productCode = normalizeRouteSegment(options.productCode)

  let canonicalPath = ''

  if (storeSlug && productCode) {
    canonicalPath = `/l/${encodeURIComponent(storeSlug)}/p/${encodeURIComponent(productCode)}`
  } else if (storeSlug && productSlug) {
    canonicalPath = `/l/${encodeURIComponent(storeSlug)}/produtos/${encodeURIComponent(productSlug)}`
  } else if (productSlug) {
    canonicalPath = `/produtos/${encodeURIComponent(productSlug)}`
  }

  if (!canonicalPath) {
    return null
  }

  return buildPublicStorefrontUrl(canonicalPath, options)
}

export function isValidPublicStorefrontUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return isSupportedPublicProtocol(parsedUrl)
  } catch {
    return false
  }
}
