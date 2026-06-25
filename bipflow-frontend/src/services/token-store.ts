/**
 * 🔐 In-Memory Access Token Store
 *
 * The refresh token lives exclusively in an httpOnly cookie set by the
 * backend (bipdelivery/api/views.py) -- it is never sent to or readable by
 * page JavaScript, so this module has nothing to do with it.
 *
 * The access token lives only in memory (never localStorage/sessionStorage),
 * so an XSS payload reading browser storage can't exfiltrate it. It is lost
 * on every full page reload by design; services/api.ts's `ensureAuthBooted`
 * restores it via a silent cookie-based refresh when the app boots.
 */

let accessToken: string | null = null

export const tokenStore = {
  /**
   * Store the access token returned by login or refresh.
   */
  setAccessToken(token: string): void {
    if (!token) {
      throw new Error('Access token cannot be empty')
    }
    accessToken = token
  },

  /**
   * Get access token for Authorization header.
   */
  getAccessToken(): string | null {
    return accessToken
  },

  /**
   * Check if an access token is currently held in memory.
   */
  hasAccessToken(): boolean {
    return Boolean(accessToken)
  },

  /**
   * Drop the in-memory access token (logout / auth failure).
   */
  clearAccessToken(): void {
    accessToken = null
  },
}
