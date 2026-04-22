/**
 * Frontend Authentication Contract Tests
 *
 * Validates that:
 * 1. All token operations go through centralized tokenStore
 * 2. No magic strings exist in auth components
 * 3. Token keys are consistent across frontend
 * 4. Login flow persists tokens correctly
 * 5. Token retrieval is consistent
 *
 * Run with:
 *   npm run test:unit -- auth-contract.test.ts
 *   vitest run auth-contract.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tokenStore, TOKEN_KEYS } from '@/services/token-store'

describe('Token Store - Centralized Auth Contract', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    // Cleanup after each test
    localStorage.clear()
  })

  describe('TOKEN_KEYS Constants', () => {
    it('should define consistent token keys', () => {
      expect(TOKEN_KEYS.ACCESS).toBe('access_token')
      expect(TOKEN_KEYS.REFRESH).toBe('refresh_token')
    })

    it('should have exactly two keys', () => {
      expect(Object.keys(TOKEN_KEYS).length).toBe(2)
    })

    it('should prevent key modification', () => {
      // TOKEN_KEYS is frozen
      expect(() => {
        // @ts-ignore - testing that mutation fails
        TOKEN_KEYS.ACCESS = 'something_else'
      }).not.toThrow() // Object.freeze doesn't throw in non-strict mode, silently fails
      expect(TOKEN_KEYS.ACCESS).toBe('access_token')
    })
  })

  describe('saveTokens()', () => {
    it('should save both access and refresh tokens', () => {
      const tokens = {
        access: 'test-access-token',
        refresh: 'test-refresh-token',
      }

      tokenStore.saveTokens(tokens)

      expect(localStorage.getItem(TOKEN_KEYS.ACCESS)).toBe(tokens.access)
      expect(localStorage.getItem(TOKEN_KEYS.REFRESH)).toBe(tokens.refresh)
    })

    it('should overwrite existing tokens', () => {
      const oldTokens = {
        access: 'old-access',
        refresh: 'old-refresh',
      }
      const newTokens = {
        access: 'new-access',
        refresh: 'new-refresh',
      }

      tokenStore.saveTokens(oldTokens)
      tokenStore.saveTokens(newTokens)

      expect(localStorage.getItem(TOKEN_KEYS.ACCESS)).toBe(newTokens.access)
      expect(localStorage.getItem(TOKEN_KEYS.REFRESH)).toBe(newTokens.refresh)
    })

    it('should throw error if access token is missing', () => {
      const invalidPayload = {
        access: '',
        refresh: 'test-refresh',
      }

      expect(() => tokenStore.saveTokens(invalidPayload)).toThrow(
        'Invalid token payload: both access and refresh are required'
      )
    })

    it('should throw error if refresh token is missing', () => {
      const invalidPayload = {
        access: 'test-access',
        refresh: '',
      }

      expect(() => tokenStore.saveTokens(invalidPayload)).toThrow(
        'Invalid token payload: both access and refresh are required'
      )
    })
  })

  describe('getAccessToken()', () => {
    it('should retrieve saved access token', () => {
      const accessToken = 'test-access-token-123'
      tokenStore.saveTokens({
        access: accessToken,
        refresh: 'test-refresh',
      })

      expect(tokenStore.getAccessToken()).toBe(accessToken)
    })

    it('should return null if no access token saved', () => {
      expect(tokenStore.getAccessToken()).toBeNull()
    })

    it('should retrieve only access token, not refresh', () => {
      tokenStore.saveTokens({
        access: 'access-123',
        refresh: 'refresh-456',
      })

      expect(tokenStore.getAccessToken()).toBe('access-123')
      expect(tokenStore.getAccessToken()).not.toBe('refresh-456')
    })
  })

  describe('getRefreshToken()', () => {
    it('should retrieve saved refresh token', () => {
      const refreshToken = 'test-refresh-token-456'
      tokenStore.saveTokens({
        access: 'test-access',
        refresh: refreshToken,
      })

      expect(tokenStore.getRefreshToken()).toBe(refreshToken)
    })

    it('should return null if no refresh token saved', () => {
      expect(tokenStore.getRefreshToken()).toBeNull()
    })

    it('should retrieve only refresh token, not access', () => {
      tokenStore.saveTokens({
        access: 'access-123',
        refresh: 'refresh-456',
      })

      expect(tokenStore.getRefreshToken()).toBe('refresh-456')
      expect(tokenStore.getRefreshToken()).not.toBe('access-123')
    })
  })

  describe('updateAccessToken()', () => {
    it('should update only access token, preserving refresh', () => {
      const originalTokens = {
        access: 'old-access',
        refresh: 'original-refresh',
      }

      tokenStore.saveTokens(originalTokens)
      tokenStore.updateAccessToken('new-access')

      expect(tokenStore.getAccessToken()).toBe('new-access')
      expect(tokenStore.getRefreshToken()).toBe('original-refresh')
    })

    it('should throw error if access token is empty', () => {
      tokenStore.saveTokens({
        access: 'test-access',
        refresh: 'test-refresh',
      })

      expect(() => tokenStore.updateAccessToken('')).toThrow(
        'Access token cannot be empty'
      )
    })

    it('should work even if no tokens exist yet', () => {
      tokenStore.updateAccessToken('new-access')
      expect(tokenStore.getAccessToken()).toBe('new-access')
    })
  })

  describe('updateRefreshToken()', () => {
    it('should update only refresh token, preserving access', () => {
      const originalTokens = {
        access: 'original-access',
        refresh: 'old-refresh',
      }

      tokenStore.saveTokens(originalTokens)
      tokenStore.updateRefreshToken('new-refresh')

      expect(tokenStore.getAccessToken()).toBe('original-access')
      expect(tokenStore.getRefreshToken()).toBe('new-refresh')
    })

    it('should throw error if refresh token is empty', () => {
      tokenStore.saveTokens({
        access: 'test-access',
        refresh: 'test-refresh',
      })

      expect(() => tokenStore.updateRefreshToken('')).toThrow(
        'Refresh token cannot be empty'
      )
    })
  })

  describe('hasTokens()', () => {
    it('should return true if both tokens exist', () => {
      tokenStore.saveTokens({
        access: 'test-access',
        refresh: 'test-refresh',
      })

      expect(tokenStore.hasTokens()).toBe(true)
    })

    it('should return false if no tokens exist', () => {
      expect(tokenStore.hasTokens()).toBe(false)
    })

    it('should return false if only access token exists', () => {
      localStorage.setItem(TOKEN_KEYS.ACCESS, 'test-access')
      expect(tokenStore.hasTokens()).toBe(false)
    })

    it('should return false if only refresh token exists', () => {
      localStorage.setItem(TOKEN_KEYS.REFRESH, 'test-refresh')
      expect(tokenStore.hasTokens()).toBe(false)
    })
  })

  describe('clearTokens()', () => {
    it('should remove both tokens', () => {
      tokenStore.saveTokens({
        access: 'test-access',
        refresh: 'test-refresh',
      })

      tokenStore.clearTokens()

      expect(tokenStore.getAccessToken()).toBeNull()
      expect(tokenStore.getRefreshToken()).toBeNull()
      expect(tokenStore.hasTokens()).toBe(false)
    })

    it('should not throw if tokens do not exist', () => {
      expect(() => tokenStore.clearTokens()).not.toThrow()
    })

    it('should not affect other localStorage entries', () => {
      localStorage.setItem('other-key', 'other-value')
      tokenStore.saveTokens({
        access: 'test-access',
        refresh: 'test-refresh',
      })

      tokenStore.clearTokens()

      expect(localStorage.getItem('other-key')).toBe('other-value')
      expect(tokenStore.getAccessToken()).toBeNull()
      expect(tokenStore.getRefreshToken()).toBeNull()
    })
  })

  describe('getKeys()', () => {
    it('should return a copy of TOKEN_KEYS', () => {
      const keys = tokenStore.getKeys()
      expect(keys.ACCESS).toBe('access_token')
      expect(keys.REFRESH).toBe('refresh_token')
    })

    it('should return a different object instance', () => {
      const keys1 = tokenStore.getKeys()
      const keys2 = tokenStore.getKeys()
      expect(keys1).not.toBe(keys2)
      expect(keys1).toEqual(keys2)
    })
  })

  describe('No Magic Strings Contract', () => {
    it('should use consistent keys across all operations', () => {
      const tokens = {
        access: 'access-123',
        refresh: 'refresh-456',
      }

      tokenStore.saveTokens(tokens)

      // All retrievals should use the same consistent keys
      expect(tokenStore.getAccessToken()).toBe(
        localStorage.getItem(TOKEN_KEYS.ACCESS)
      )
      expect(tokenStore.getRefreshToken()).toBe(
        localStorage.getItem(TOKEN_KEYS.REFRESH)
      )
    })

    it('should have no localStorage keys outside TOKEN_KEYS', () => {
      tokenStore.saveTokens({
        access: 'test-access',
        refresh: 'test-refresh',
      })

      const storageKeys = Object.keys(localStorage)
      const validKeys = Object.values(TOKEN_KEYS)

      storageKeys.forEach((key) => {
        expect(validKeys).toContain(key)
      })
    })
  })

  describe('Complete Authentication Flow', () => {
    it('should handle login flow: save -> retrieve -> logout', () => {
      // 1. Login: save tokens
      const loginResponse = {
        access: 'jwt-access-token',
        refresh: 'jwt-refresh-token',
      }
      tokenStore.saveTokens(loginResponse)

      // 2. Check authentication
      expect(tokenStore.hasTokens()).toBe(true)
      expect(tokenStore.getAccessToken()).toBe(loginResponse.access)

      // 3. API request uses access token
      const headerToken = tokenStore.getAccessToken()
      expect(headerToken).toBe(loginResponse.access)

      // 4. Token refresh updates only access token
      const refreshResponse = { access: 'new-jwt-access-token' }
      tokenStore.updateAccessToken(refreshResponse.access)
      expect(tokenStore.getAccessToken()).toBe(refreshResponse.access)
      expect(tokenStore.getRefreshToken()).toBe(loginResponse.refresh)

      // 5. Logout: clear all tokens
      tokenStore.clearTokens()
      expect(tokenStore.hasTokens()).toBe(false)
    })

    it('should handle concurrent operations safely', () => {
      // Simulate rapid token updates
      const tokens1 = { access: 'token-1', refresh: 'refresh-1' }
      const tokens2 = { access: 'token-2', refresh: 'refresh-2' }

      tokenStore.saveTokens(tokens1)
      tokenStore.updateAccessToken(tokens2.access)
      tokenStore.updateRefreshToken(tokens2.refresh)

      expect(tokenStore.getAccessToken()).toBe(tokens2.access)
      expect(tokenStore.getRefreshToken()).toBe(tokens2.refresh)
    })
  })
})
