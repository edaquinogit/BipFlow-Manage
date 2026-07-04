import { onBeforeUnmount, onMounted, ref } from 'vue'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const POLL_INTERVAL_MS = 1000
const DEFAULT_IDLE_MS = 5 * 60 * 1000
const ENTRY_SHOWN_KEY_PREFIX = 'bipflow:storefront-intro-shown:'

export interface UseIdleIntroOptions {
  /** Distinguishes stores on the same session so each gets its own entry greeting. */
  storeKey?: string
  /** Inactivity window before the next interaction re-triggers the intro. */
  idleMs?: number
}

function hasShownEntryIntro(storeKey: string): boolean {
  try {
    return window.sessionStorage.getItem(ENTRY_SHOWN_KEY_PREFIX + storeKey) === '1'
  } catch {
    // sessionStorage can throw in private-browsing/locked-down contexts --
    // fail open so the entry intro still shows rather than crashing the page.
    return false
  }
}

function markEntryIntroShown(storeKey: string): void {
  try {
    window.sessionStorage.setItem(ENTRY_SHOWN_KEY_PREFIX + storeKey, '1')
  } catch {
    // ignore -- see hasShownEntryIntro
  }
}

/**
 * Drives the storefront's welcome splash: shown once per browser session when
 * a store is first entered, and again any time the visitor returns after
 * `idleMs` of no interaction (mirrors a kiosk "attract screen" reset without
 * touching cart/scroll/filter state -- see IntroSplash.vue for the visual).
 */
export function useIdleIntro(options: UseIdleIntroOptions = {}) {
  const storeKey = options.storeKey?.trim() || 'default'
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS

  const showIntro = ref(false)

  let lastActivityAt = Date.now()
  let hasBeenIdle = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function dismissIntro(): void {
    showIntro.value = false
    lastActivityAt = Date.now()
    hasBeenIdle = false
  }

  function handleActivity(): void {
    lastActivityAt = Date.now()

    if (hasBeenIdle && !showIntro.value) {
      hasBeenIdle = false
      showIntro.value = true
    }
  }

  function checkIdle(): void {
    if (!hasBeenIdle && !showIntro.value && Date.now() - lastActivityAt >= idleMs) {
      hasBeenIdle = true
    }
  }

  onMounted(() => {
    if (!hasShownEntryIntro(storeKey)) {
      showIntro.value = true
      markEntryIntroShown(storeKey)
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })
    pollTimer = setInterval(checkIdle, POLL_INTERVAL_MS)
  })

  onBeforeUnmount(() => {
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, handleActivity)
    })
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })

  return { showIntro, dismissIntro }
}
