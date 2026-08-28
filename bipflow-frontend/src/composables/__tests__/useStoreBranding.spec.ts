import { describe, expect, it } from 'vitest'
import { buildStoreBranding } from '../useStoreBranding'

describe('buildStoreBranding', () => {
  it('uses neutral production fallbacks when no store branding has loaded', () => {
    const branding = buildStoreBranding(null)

    expect(branding.name).toBe('Sua loja')
    expect(branding.tagline).toBe('')
    expect(branding.theme).toEqual({
      primary: '#05050A',
      accent: '#111827',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#05050A',
      muted: '#6B7280',
    })
    expect(Object.values(branding.theme)).not.toContain('#D81B60')
  })
})
