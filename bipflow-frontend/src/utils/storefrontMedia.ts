import type { StorefrontMediaKind } from '@/types/store'

const MB = 1024 * 1024

const ALLOWED_TYPES_BY_EXTENSION: Record<string, string[]> = {
  jpg: ['image/jpeg', 'image/jpg'],
  jpeg: ['image/jpeg', 'image/jpg'],
  png: ['image/png'],
  webp: ['image/webp'],
}

export const STOREFRONT_MEDIA_RULES: Record<
  StorefrontMediaKind,
  { maxBytes: number; recommendedSize: string }
> = {
  logo: {
    maxBytes: 2 * MB,
    recommendedSize: '512 x 512 px',
  },
  banner: {
    maxBytes: 5 * MB,
    recommendedSize: '1600 x 600 px',
  },
  favicon: {
    maxBytes: 1 * MB,
    recommendedSize: '512 x 512 px',
  },
  promotion: {
    maxBytes: 5 * MB,
    recommendedSize: '1200 x 480 px',
  },
}

export function validateStorefrontMediaFile(
  kind: StorefrontMediaKind,
  file: File,
): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowedTypes = ALLOWED_TYPES_BY_EXTENSION[extension]

  if (!allowedTypes || !allowedTypes.includes(file.type)) {
    return 'Envie uma imagem PNG, JPG, JPEG ou WEBP.'
  }

  const maxBytes = STOREFRONT_MEDIA_RULES[kind].maxBytes
  if (file.size > maxBytes) {
    return `A imagem deve ter no maximo ${Math.floor(maxBytes / MB)} MB.`
  }

  return null
}
