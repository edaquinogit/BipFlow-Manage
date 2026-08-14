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
const SESSION_HINT_KEY = 'bipflow_auth_session_hint'

function hasBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function writeSessionHint(): void {
  if (!hasBrowserStorage()) return

  try {
    window.localStorage.setItem(SESSION_HINT_KEY, '1')
  } catch {
    // Storage can be disabled in private/embedded contexts. Auth still works
    // for the current page because the access token remains in memory.
  }
}

function clearSessionHint(): void {
  if (!hasBrowserStorage()) return

  try {
    window.localStorage.removeItem(SESSION_HINT_KEY)
  } catch {
    // Best effort only; never block logout/auth cleanup on storage failure.
  }
}

function readSessionHint(): boolean {
  if (!hasBrowserStorage()) return false

  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1'
  } catch {
    return false
  }
}

export const tokenStore = {
  /**
   * Store the access token returned by login or refresh.
   */
  setAccessToken(token: string): void {
    if (!token) {
      throw new Error('Access token cannot be empty')
    }
    accessToken = token
    writeSessionHint()
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
   * Non-sensitive client hint that a refresh cookie may exist.
   *
   * It deliberately stores only a boolean marker, never the access token or
   * refresh token. Public anonymous pages use this to avoid noisy refresh
   * attempts when there is clearly no session to restore.
   */
  hasSessionHint(): boolean {
    return Boolean(accessToken) || readSessionHint()
  },

  /**
   * Drop the in-memory access token (logout / auth failure).
   */
  clearAccessToken(): void {
    accessToken = null
    clearSessionHint()
  },
}
