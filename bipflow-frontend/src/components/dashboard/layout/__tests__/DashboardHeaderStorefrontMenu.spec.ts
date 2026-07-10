import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { useToast } from '@/composables/useToast'
import DashboardHeaderStorefrontMenu from '../DashboardHeaderStorefrontMenu.vue'

vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))

const STOREFRONT_PATH = '/l/minha-loja/produtos'
const ABSOLUTE_URL = `${window.location.origin}${STOREFRONT_PATH}`

const toastMock = { success: vi.fn(), error: vi.fn() }

function mountMenu(): VueWrapper {
  return mount(DashboardHeaderStorefrontMenu, {
    props: { storefrontPath: STOREFRONT_PATH },
    attachTo: document.body,
  })
}

async function openMenu(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('button[title="Ver vitrine"]').trigger('click')
}

describe('DashboardHeaderStorefrontMenu', () => {
  let wrapper: VueWrapper | null = null
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    vi.mocked(useToast).mockReturnValue(toastMock as unknown as ReturnType<typeof useToast>)

    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('opens the popover on trigger click and toggles aria-expanded', async () => {
    wrapper = mountMenu()
    const trigger = wrapper.find('button[title="Ver vitrine"]')

    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await openMenu(wrapper)

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('shows the absolute storefront URL in the readonly input', async () => {
    wrapper = mountMenu()
    await openMenu(wrapper)

    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.value).toBe(ABSOLUTE_URL)
    expect(input.readOnly).toBe(true)
  })

  it('closes when clicking outside the popover', async () => {
    wrapper = mountMenu()
    await openMenu(wrapper)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('closes on Escape', async () => {
    wrapper = mountMenu()
    await openMenu(wrapper)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('copies the absolute link and shows success feedback', async () => {
    wrapper = mountMenu()
    await openMenu(wrapper)

    await wrapper.find('button[title="Copiar link"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith(ABSOLUTE_URL)
    expect(toastMock.success).toHaveBeenCalledWith('Link da vitrine copiado.')
    expect(wrapper.find('button[title="Copiado"]').exists()).toBe(true)
  })

  it('shows an error toast when the clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    wrapper = mountMenu()
    await openMenu(wrapper)

    await wrapper.find('button[title="Copiar link"]').trigger('click')
    await flushPromises()

    expect(toastMock.error).toHaveBeenCalledWith('Nao foi possivel copiar o link.')
    expect(wrapper.find('button[title="Copiado"]').exists()).toBe(false)
  })

  it('links to the storefront in a new tab and closes the menu on click', async () => {
    wrapper = mountMenu()
    await openMenu(wrapper)

    const enterLink = wrapper.find('a')
    expect(enterLink.attributes('href')).toBe(ABSOLUTE_URL)
    expect(enterLink.attributes('target')).toBe('_blank')
    expect(enterLink.attributes('rel')).toBe('noopener noreferrer')

    await enterLink.trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
