import { describe, expect, it } from 'vitest'
import {
  buildPublicProductUrl,
  buildPublicStorefrontUrl,
  isValidPublicStorefrontUrl,
} from '../publicStorefrontUrl'

describe('buildPublicStorefrontUrl', () => {
  it('builds an absolute URL from runtime origin and storefront path', () => {
    expect(
      buildPublicStorefrontUrl('/l/minha-loja/produtos', {
        runtimeOrigin: 'https://app.bipflow.com',
      }),
    ).toBe('https://app.bipflow.com/l/minha-loja/produtos')
  })

  it('returns null when path is blank', () => {
    expect(buildPublicStorefrontUrl('   ', { runtimeOrigin: 'https://app.bipflow.com' })).toBeNull()
  })

  it('returns null when runtime origin is invalid', () => {
    expect(
      buildPublicStorefrontUrl('/l/minha-loja/produtos', {
        runtimeOrigin: 'not a url',
      }),
    ).toBeNull()
  })
})

describe('isValidPublicStorefrontUrl', () => {
  it('accepts standard public https URLs', () => {
    expect(isValidPublicStorefrontUrl('https://app.bipflow.com/l/minha-loja/produtos')).toBe(true)
  })

  it('rejects malformed URLs', () => {
    expect(isValidPublicStorefrontUrl('not a url')).toBe(false)
  })
})

describe('buildPublicProductUrl', () => {
  it('builds a slug-scoped product URL for a store', () => {
    expect(
      buildPublicProductUrl({
        runtimeOrigin: 'https://app.bipflow.com',
        storeSlug: 'loja-a',
        productSlug: 'camiseta-x',
      }),
    ).toBe('https://app.bipflow.com/l/loja-a/produtos/camiseta-x')
  })

  it('builds a code-based deep link for QR share scenarios', () => {
    expect(
      buildPublicProductUrl({
        runtimeOrigin: 'https://app.bipflow.com',
        storeSlug: 'loja-a',
        productCode: 'ABC123XYZ',
      }),
    ).toBe('https://app.bipflow.com/l/loja-a/p/ABC123XYZ')
  })

  it('returns null when route params are invalid', () => {
    expect(
      buildPublicProductUrl({
        runtimeOrigin: 'https://app.bipflow.com',
        storeSlug: 'loja-a',
        productSlug: 'camiseta invalida',
      }),
    ).toBeNull()
  })
})
