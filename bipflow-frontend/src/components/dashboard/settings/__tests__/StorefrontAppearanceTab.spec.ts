import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { computed, nextTick, ref, type Ref } from 'vue'
import DashboardSettingsView from '@/views/dashboard/DashboardSettingsView.vue'
import StorefrontAppearanceTab from '../StorefrontAppearanceTab.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useToast } from '@/composables/useToast'
import { storeService } from '@/services/store.service'
import { storefrontAppearanceService } from '@/services/storefront-appearance.service'
import type { Store, StorefrontAppearance } from '@/types/store'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/services/store.service', () => ({
  storeService: {
    updateAppearance: vi.fn(),
  },
}))
vi.mock('@/services/storefront-appearance.service', () => ({
  storefrontAppearanceService: {
    get: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('@/services/logger', () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

function buildStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 1,
    name: 'Loja A',
    slug: 'loja-a',
    logo_url: 'https://example.com/logo-a.png',
    tagline: 'Catalogo A',
    whatsapp_phone: '5571999990000',
    theme: {
      primary: '#05050A',
      accent: '#D81B60',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#05050A',
      muted: '#6B7280',
    },
    is_active: true,
    status: 'active',
    receipt_exchange_policy: '',
    receipt_paper_format: '80mm',
    ...overrides,
  }
}

function buildAppearance(overrides: Partial<StorefrontAppearance> = {}): StorefrontAppearance {
  return {
    secondary_color: '#E91E63',
    hero_enabled: false,
    hero_image_desktop: '',
    hero_image_mobile: '',
    hero_alt_text: '',
    hero_title: '',
    hero_subtitle: '',
    hero_cta_text: '',
    hero_cta_url: '',
    card_style: 'clean',
    radius_style: 'rounded',
    density: 'comfortable',
    motion_enabled: true,
    motion_intensity: 'standard',
    decoration_enabled: false,
    decoration_style: 'none',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('DashboardSettingsView storefront appearance tab', () => {
  it('renders and selects the storefront appearance tab', async () => {
    const wrapper = shallowMount(DashboardSettingsView)

    expect(wrapper.text()).toContain('Aparencia da vitrine')

    const tab = wrapper.find('[data-cy="settings-tab-aparencia"]')
    await tab.trigger('click')

    expect(tab.attributes('aria-selected')).toBe('true')
  })
})

describe('StorefrontAppearanceTab', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }
  const fetchCurrentStore = vi.fn().mockResolvedValue(undefined)
  let selectedStore: Ref<Store | null>

  function mockCurrentStore(store: Store | null = buildStore()) {
    selectedStore = ref(store)
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore,
      storefrontPath: computed(() => (
        selectedStore.value?.slug ? `/l/${selectedStore.value.slug}/produtos` : '/produtos'
      )),
      fetchCurrentStore,
    } as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentStore.mockClear()
    mockCurrentStore()
    vi.mocked(useToast).mockReturnValue(toastState as any)
    vi.mocked(storefrontAppearanceService.get).mockResolvedValue(buildAppearance())
    vi.mocked(storefrontAppearanceService.update).mockImplementation((_slug, payload) => (
      Promise.resolve(buildAppearance(payload))
    ))
    vi.mocked(storeService.updateAppearance).mockImplementation((_slug, payload) => (
      Promise.resolve(buildStore({
        logo_url: payload.logo_url ?? 'https://example.com/logo-a.png',
        tagline: payload.tagline ?? 'Catalogo A',
        theme: payload.theme ?? buildStore().theme,
      }))
    ))
  })

  it('shows loading while fetching the current store appearance', async () => {
    const deferred = createDeferred<StorefrontAppearance>()
    vi.mocked(storefrontAppearanceService.get).mockReturnValueOnce(deferred.promise)

    const wrapper = mount(StorefrontAppearanceTab)

    expect(wrapper.find('[data-cy="storefront-appearance-loading"]').exists()).toBe(true)
    expect(storefrontAppearanceService.get).toHaveBeenCalledWith('loja-a')

    deferred.resolve(buildAppearance())
    await flushPromises()

    expect(wrapper.find('[data-cy="storefront-appearance-loading"]').exists()).toBe(false)
  })

  it('loads appearance into the identity form and opens the selected store storefront', async () => {
    vi.mocked(storefrontAppearanceService.get).mockResolvedValue(buildAppearance({
      secondary_color: '#FF00AA',
    }))

    const wrapper = mount(StorefrontAppearanceTab)
    await flushPromises()

    expect((wrapper.find('[data-cy="storefront-secondary-color"]').element as HTMLInputElement).value).toBe('#FF00AA')
    expect(wrapper.find('[data-cy="open-current-storefront-link"]').attributes('href')).toBe('/l/loja-a/produtos')
  })

  it('saves identity colors through the allowed store and appearance payloads', async () => {
    const wrapper = mount(StorefrontAppearanceTab)
    await flushPromises()

    await wrapper.find('[data-cy="storefront-tagline"]').setValue('Nova vitrine')
    await wrapper.find('[data-cy="storefront-secondary-color"]').setValue('#00AAFF')
    await wrapper.find('[data-cy="btn-save-storefront-identity"]').trigger('click')
    await flushPromises()

    expect(storeService.updateAppearance).toHaveBeenCalledWith('loja-a', {
      tagline: 'Nova vitrine',
    })
    expect(storefrontAppearanceService.update).toHaveBeenCalledWith('loja-a', {
      secondary_color: '#00AAFF',
    })
    expect(fetchCurrentStore).toHaveBeenCalledWith(true)
    expect(toastState.success).toHaveBeenCalledWith('Aparencia da vitrine atualizada com sucesso.')
  })

  it('keeps banner fields conditional and saves the hero payload', async () => {
    const wrapper = mount(StorefrontAppearanceTab)
    await flushPromises()

    await wrapper.find('[data-cy="storefront-appearance-section-banner"]').trigger('click')

    expect(wrapper.find('[data-cy="storefront-banner-desktop-url"]').exists()).toBe(false)

    await wrapper.find('[data-cy="storefront-banner-enabled"]').setValue(true)
    await wrapper.find('[data-cy="storefront-banner-desktop-url"]').setValue('https://example.com/banner.jpg')
    await wrapper.find('[data-cy="storefront-banner-alt"]').setValue('Campanha de verao')
    await wrapper.find('[data-cy="btn-save-storefront-banner"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-cy="storefront-banner-preview"]').exists()).toBe(true)
    expect(storefrontAppearanceService.update).toHaveBeenCalledWith('loja-a', expect.objectContaining({
      hero_enabled: true,
      hero_image_desktop: 'https://example.com/banner.jpg',
      hero_alt_text: 'Campanha de verao',
    }))
    expect(toastState.success).toHaveBeenCalledWith('Aparencia da vitrine atualizada com sucesso.')
  })

  it('disables the banner save button while the request is in flight', async () => {
    const deferred = createDeferred<StorefrontAppearance>()
    vi.mocked(storefrontAppearanceService.update).mockReturnValueOnce(deferred.promise)

    const wrapper = mount(StorefrontAppearanceTab)
    await flushPromises()
    await wrapper.find('[data-cy="storefront-appearance-section-banner"]').trigger('click')
    await wrapper.find('[data-cy="storefront-banner-enabled"]').setValue(true)

    const saveButton = wrapper.find('[data-cy="btn-save-storefront-banner"]')
    await saveButton.trigger('click')

    expect(saveButton.attributes('disabled')).toBeDefined()
    expect(saveButton.text()).toBe('Salvando...')

    deferred.resolve(buildAppearance({ hero_enabled: true }))
    await flushPromises()

    expect(saveButton.attributes('disabled')).toBeDefined()
  })

  it('shows an error when the appearance PATCH fails', async () => {
    vi.mocked(storefrontAppearanceService.update).mockRejectedValueOnce(new Error('network down'))

    const wrapper = mount(StorefrontAppearanceTab)
    await flushPromises()
    await wrapper.find('[data-cy="storefront-appearance-section-banner"]').trigger('click')
    await wrapper.find('[data-cy="storefront-banner-enabled"]').setValue(true)
    await wrapper.find('[data-cy="btn-save-storefront-banner"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Nao foi possivel salvar o banner. Tente novamente.')
    expect(toastState.error).toHaveBeenCalledWith('Nao foi possivel salvar o banner.')
  })

  it('saves layout, motion and decoration presets accepted by the backend', async () => {
    const wrapper = mount(StorefrontAppearanceTab)
    await flushPromises()

    await wrapper.find('[data-cy="storefront-appearance-section-estilo"]').trigger('click')
    await wrapper.find('[data-cy="storefront-card-style-select"]').setValue('bordered')
    await wrapper.find('[data-cy="storefront-radius-style-select"]').setValue('soft')
    await wrapper.find('[data-cy="storefront-density-select"]').setValue('compact')
    await wrapper.find('[data-cy="storefront-motion-intensity-select"]').setValue('subtle')
    await wrapper.find('[data-cy="storefront-decoration-enabled"]').setValue(true)
    await wrapper.find('[data-cy="storefront-decoration-style-select"]').setValue('geometric')
    await wrapper.find('[data-cy="btn-save-storefront-layout"]').trigger('click')
    await flushPromises()

    expect(storefrontAppearanceService.update).toHaveBeenCalledWith('loja-a', expect.objectContaining({
      card_style: 'bordered',
      radius_style: 'soft',
      density: 'compact',
      motion_enabled: true,
      motion_intensity: 'subtle',
      decoration_enabled: true,
      decoration_style: 'geometric',
    }))
  })

  it('reloads appearance when the selected store changes and replaces the previous form state', async () => {
    vi.mocked(storefrontAppearanceService.get).mockImplementation((slug) => (
      Promise.resolve(slug === 'loja-a'
        ? buildAppearance({ secondary_color: '#FF00AA' })
        : buildAppearance({ secondary_color: '#0044FF' }))
    ))

    const wrapper = mount(StorefrontAppearanceTab)
    await flushPromises()

    expect((wrapper.find('[data-cy="storefront-secondary-color"]').element as HTMLInputElement).value).toBe('#FF00AA')

    selectedStore.value = buildStore({
      id: 2,
      name: 'Loja B',
      slug: 'loja-b',
      logo_url: 'https://example.com/logo-b.png',
      tagline: 'Catalogo B',
    })
    await nextTick()
    await flushPromises()

    expect(storefrontAppearanceService.get).toHaveBeenCalledWith('loja-b')
    expect((wrapper.find('[data-cy="storefront-secondary-color"]').element as HTMLInputElement).value).toBe('#0044FF')
    expect(wrapper.find('[data-cy="open-current-storefront-link"]').attributes('href')).toBe('/l/loja-b/produtos')
  })

  it('ignores a stale Store A response that resolves after Store B', async () => {
    const storeARequest = createDeferred<StorefrontAppearance>()
    const storeBRequest = createDeferred<StorefrontAppearance>()
    vi.mocked(storefrontAppearanceService.get).mockImplementation((slug) => (
      slug === 'loja-a' ? storeARequest.promise : storeBRequest.promise
    ))

    const wrapper = mount(StorefrontAppearanceTab)

    selectedStore.value = buildStore({ id: 2, name: 'Loja B', slug: 'loja-b' })
    await nextTick()

    storeBRequest.resolve(buildAppearance({ secondary_color: '#0044FF' }))
    await flushPromises()
    expect((wrapper.find('[data-cy="storefront-secondary-color"]').element as HTMLInputElement).value).toBe('#0044FF')

    storeARequest.resolve(buildAppearance({ secondary_color: '#FF00AA' }))
    await flushPromises()

    expect((wrapper.find('[data-cy="storefront-secondary-color"]').element as HTMLInputElement).value).toBe('#0044FF')
  })
})
