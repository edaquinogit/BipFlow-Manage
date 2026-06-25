/**
 * In-Memory Access Token Store Contract Tests
 *
 * The refresh token lives exclusively in an httpOnly cookie set by the
 * backend -- this module never touches it. These tests cover the access
 * token only, and explicitly guard against it ever leaking into
 * localStorage/sessionStorage again (that regression is exactly the XSS
 * exposure this module was built to close).
 *
 * Run with:
 *   vitest run token-store.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { tokenStore } from '@/services/token-store'

describe('Token Store - in-memory access token', () => {
  beforeEach(() => {
    tokenStore.clearAccessToken()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('setAccessToken() / getAccessToken()', () => {
    it('stores and retrieves the access token', () => {
      tokenStore.setAccessToken('test-access-token')
      expect(tokenStore.getAccessToken()).toBe('test-access-token')
    })

    it('returns null if no access token was set', () => {
      expect(tokenStore.getAccessToken()).toBeNull()
    })

    it('overwrites a previously set access token', () => {
      tokenStore.setAccessToken('old-access')
      tokenStore.setAccessToken('new-access')
      expect(tokenStore.getAccessToken()).toBe('new-access')
    })

    it('throws if the access token is empty', () => {
      expect(() => tokenStore.setAccessToken('')).toThrow(
        'Access token cannot be empty'
      )
    })

    it('never writes the access token to localStorage or sessionStorage', () => {
      tokenStore.setAccessToken('test-access-token')

      expect(localStorage.length).toBe(0)
      expect(sessionStorage.length).toBe(0)
    })
  })

  describe('hasAccessToken()', () => {
    it('returns false before any token is set', () => {
      expect(tokenStore.hasAccessToken()).toBe(false)
    })

    it('returns true once a token is set', () => {
      tokenStore.setAccessToken('test-access-token')
      expect(tokenStore.hasAccessToken()).toBe(true)
    })

    it('returns false after the token is cleared', () => {
      tokenStore.setAccessToken('test-access-token')
      tokenStore.clearAccessToken()
      expect(tokenStore.hasAccessToken()).toBe(false)
    })
  })

  describe('clearAccessToken()', () => {
    it('removes the stored access token', () => {
      tokenStore.setAccessToken('test-access-token')
      tokenStore.clearAccessToken()
      expect(tokenStore.getAccessToken()).toBeNull()
    })

    it('does not throw if no token was ever set', () => {
      expect(() => tokenStore.clearAccessToken()).not.toThrow()
    })
  })
})
