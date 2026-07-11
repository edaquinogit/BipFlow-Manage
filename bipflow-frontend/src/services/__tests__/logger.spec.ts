import { describe, it, expect, afterEach, vi } from 'vitest'
import { Logger } from '../logger'

// Logger is a singleton created at module load with isDevelopment captured
// from import.meta.env.DEV (true under Vitest by default). Toggling that
// already-set private field directly is far more reliable here than trying
// to re-stub import.meta.env and re-import the module for each case.
function setDevelopment(isDev: boolean): void {
  ;(Logger as unknown as { isDevelopment: boolean }).isDevelopment = isDev
}

describe('Logger', () => {
  afterEach(() => {
    setDevelopment(true)
    vi.restoreAllMocks()
  })

  it('never prints the context object in production -- it can carry bearer tokens, request bodies, or PII', () => {
    setDevelopment(false)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    Logger.error('Request failed', { token: 'Bearer secret-token', password: 'hunter2' })

    expect(spy).toHaveBeenCalledTimes(1)
    const loggedArgs = spy.mock.calls[0]
    expect(JSON.stringify(loggedArgs)).not.toContain('secret-token')
    expect(JSON.stringify(loggedArgs)).not.toContain('hunter2')
  })

  it('still prints the bare message string in production, for on-call triage', () => {
    setDevelopment(false)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    Logger.error('Request failed')

    expect(spy.mock.calls[0]?.[0]).toContain('Request failed')
  })

  it('applies the same production gating to warn()', () => {
    setDevelopment(false)
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    Logger.warn('Slow operation', { token: 'Bearer secret-token' })

    expect(JSON.stringify(spy.mock.calls[0])).not.toContain('secret-token')
  })

  it('prints the context object in development, where it is useful for debugging', () => {
    setDevelopment(true)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    Logger.error('Request failed', { statusCode: 400 })

    expect(JSON.stringify(spy.mock.calls[0])).toContain('400')
  })

  it('never calls console.info/debug outside development, matching existing behavior', () => {
    setDevelopment(false)
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    Logger.info('Some info', { detail: 'secret-detail' })
    Logger.debug('Some debug', { detail: 'secret-detail' })

    expect(infoSpy).not.toHaveBeenCalled()
    expect(debugSpy).not.toHaveBeenCalled()
  })
})
