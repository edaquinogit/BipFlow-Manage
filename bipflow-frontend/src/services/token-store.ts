/**
 * 🔐 Centralized Token Storage Module
 *
 * Single source of truth for all authentication token management.
 * Prevents fragmentation and inconsistency in token key naming.
 *
 * Contract:
 * - access_token: JWT access token (short-lived)
 * - refresh_token: JWT refresh token (long-lived)
 *
 * All token operations must go through this module.
 */

/**
 * Standard authentication storage keys
 */
const TOKEN_KEYS = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
} as const

type TokenKey = typeof TOKEN_KEYS[keyof typeof TOKEN_KEYS]

/**
 * Token storage interface for type safety
 */
interface TokenPayload {
  access: string
  refresh: string
}

/**
 * Centralized token store
 * Single module responsible for all token persistence operations
 */
export const tokenStore = {
  /**
   * Save both access and refresh tokens atomically
   * @param payload - { access, refresh } from auth endpoint
   */
  saveTokens(payload: TokenPayload): void {
    if (!payload.access || !payload.refresh) {
      throw new Error('Invalid token payload: both access and refresh are required')
    }
    localStorage.setItem(TOKEN_KEYS.ACCESS, payload.access)
    localStorage.setItem(TOKEN_KEYS.REFRESH, payload.refresh)
  },

  /**
   * Get access token for Authorization header
   */
  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEYS.ACCESS)
  },

  /**
   * Get refresh token for token refresh requests
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(TOKEN_KEYS.REFRESH)
  },

  /**
   * Update only access token (after refresh)
   * Preserves existing refresh token
   */
  updateAccessToken(accessToken: string): void {
    if (!accessToken) {
      throw new Error('Access token cannot be empty')
    }
    localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken)
  },

  /**
   * Update only refresh token if needed
   */
  updateRefreshToken(refreshToken: string): void {
    if (!refreshToken) {
      throw new Error('Refresh token cannot be empty')
    }
    localStorage.setItem(TOKEN_KEYS.REFRESH, refreshToken)
  },

  /**
   * Check if user has valid tokens
   */
  hasTokens(): boolean {
    return Boolean(this.getAccessToken() && this.getRefreshToken())
  },

  /**
   * Clear all authentication tokens (logout)
   */
  clearTokens(): void {
    localStorage.removeItem(TOKEN_KEYS.ACCESS)
    localStorage.removeItem(TOKEN_KEYS.REFRESH)
  },

  /**
   * Get token keys for reference (avoid magic strings elsewhere)
   */
  getKeys(): typeof TOKEN_KEYS {
    return { ...TOKEN_KEYS }
  },
}

export { TOKEN_KEYS }
export type { TokenPayload, TokenKey }
