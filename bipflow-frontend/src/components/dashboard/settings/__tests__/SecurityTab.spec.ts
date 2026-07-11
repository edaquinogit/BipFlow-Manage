import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SecurityTab from '../SecurityTab.vue'
import { authService } from '@/services/auth.service'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useToast } from '@/composables/useToast'

vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/services/logger', () => ({ Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/services/auth.service', () => ({
  authService: {
    setupMfa: vi.fn(),
    confirmMfaSetup: vi.fn(),
    disableMfa: vi.fn(),
    logoutAllDevices: vi.fn(),
  },
}))

async function openDisablePanel(mfaEnabled = true) {
  vi.mocked(useCurrentUser).mockReturnValue({
    mfaEnabled: ref(mfaEnabled),
    fetchCurrentUser: vi.fn().mockResolvedValue(true),
  } as any)

  const wrapper = mount(SecurityTab)
  await flushPromises()
  await wrapper.find('button:not([disabled])').trigger('click') // "Desativar MFA" toggle
  return wrapper
}

describe('SecurityTab', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useToast).mockReturnValue(toastState as any)
  })

  it('shows both a password field and a code field when confirming MFA disable', async () => {
    const wrapper = await openDisablePanel()

    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Codigo do app autenticador')
  })

  it('keeps the confirm button disabled until both password and code are filled', async () => {
    const wrapper = await openDisablePanel()

    const confirmButton = () => wrapper.findAll('button').find((b) => b.text().includes('Desativar MFA'))!

    expect(confirmButton().attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="password"]').setValue('my-password')
    expect(confirmButton().attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="text"]').setValue('123456')
    expect(confirmButton().attributes('disabled')).toBeUndefined()
  })

  it('submits password + TOTP code together to disableMfa', async () => {
    vi.mocked(authService.disableMfa).mockResolvedValue(undefined)
    const wrapper = await openDisablePanel()

    await wrapper.find('input[type="password"]').setValue('my-password')
    await wrapper.find('input[type="text"]').setValue('123456')
    await wrapper.findAll('button').find((b) => b.text().includes('Desativar MFA'))!.trigger('click')
    await flushPromises()

    expect(authService.disableMfa).toHaveBeenCalledWith({
      password: 'my-password',
      code: '123456',
    })
    expect(toastState.success).toHaveBeenCalledWith('MFA desativado.')
  })

  it('submits a backup_code instead of code when the toggle is used', async () => {
    vi.mocked(authService.disableMfa).mockResolvedValue(undefined)
    const wrapper = await openDisablePanel()

    await wrapper.find('input[type="password"]').setValue('my-password')
    await wrapper.findAll('button').find((b) => b.text().includes('Usar codigo de backup'))!.trigger('click')
    await wrapper.find('input[type="text"]').setValue('AB3K-9XQ2')
    await wrapper.findAll('button').find((b) => b.text().includes('Desativar MFA'))!.trigger('click')
    await flushPromises()

    expect(authService.disableMfa).toHaveBeenCalledWith({
      password: 'my-password',
      backup_code: 'AB3K-9XQ2',
    })
  })

  it('never logs the raw error (which would include the submitted password) on a failed disable', async () => {
    const { Logger } = await import('@/services/logger')
    vi.mocked(authService.disableMfa).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { detail: 'Codigo invalido.' } },
      config: { data: JSON.stringify({ password: 'my-password', code: '000000' }) },
    })

    const wrapper = await openDisablePanel()
    await wrapper.find('input[type="password"]').setValue('my-password')
    await wrapper.find('input[type="text"]').setValue('000000')
    await wrapper.findAll('button').find((b) => b.text().includes('Desativar MFA'))!.trigger('click')
    await flushPromises()

    expect(Logger.error).toHaveBeenCalledTimes(1)
    const loggedContext = JSON.stringify(vi.mocked(Logger.error).mock.calls[0])
    expect(loggedContext).not.toContain('my-password')
  })
})
