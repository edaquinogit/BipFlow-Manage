import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import IntroSplash from '../IntroSplash.vue'

const WELCOME_TEXT = 'Seja bem-vindo a Boutique Fitness'
const TYPING_DELAY_MS = 55

describe('IntroSplash', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when not visible', () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: false, isBackendReady: true },
    })

    expect(wrapper.find('.intro-splash').exists()).toBe(false)
  })

  it('types the welcome message character by character when shown', async () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: true },
    })

    expect(wrapper.text()).not.toContain(WELCOME_TEXT)

    vi.advanceTimersByTime(TYPING_DELAY_MS * WELCOME_TEXT.length)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(WELCOME_TEXT)
  })

  it('shows the tagline only after the typing animation finishes', async () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: true },
    })

    expect(wrapper.text()).not.toContain('Catalogo online')

    vi.advanceTimersByTime(TYPING_DELAY_MS * WELCOME_TEXT.length)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Catalogo online')
  })

  it('emits dismiss when clicked', async () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: true },
    })

    await wrapper.find('.intro-splash').trigger('click')

    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })

  it('auto-dismisses shortly after typing finishes when the backend is already ready', async () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: true },
    })

    vi.advanceTimersByTime(TYPING_DELAY_MS * WELCOME_TEXT.length + 1200 + 100)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })

  it('shows the full text immediately when the user prefers reduced motion', async () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMediaMock)

    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: true },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(WELCOME_TEXT)

    vi.unstubAllGlobals()
  })

  it('shows a loading state instead of dismissing when the backend is not ready yet', async () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: false },
    })

    vi.advanceTimersByTime(TYPING_DELAY_MS * WELCOME_TEXT.length + 1200 + 100)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('dismiss')).toBeFalsy()
    expect(wrapper.text()).toContain('Aguarde, o site esta iniciando')
  })

  it('dismisses shortly after the backend becomes ready mid-loading-state', async () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: false },
    })

    vi.advanceTimersByTime(TYPING_DELAY_MS * WELCOME_TEXT.length + 100)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('dismiss')).toBeFalsy()

    await wrapper.setProps({ isBackendReady: true })
    vi.advanceTimersByTime(1200 + 100)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })

  it('dismisses on its own after the max wait even if the backend never answers', async () => {
    const wrapper = mount(IntroSplash, {
      props: { visible: true, isBackendReady: false },
    })

    vi.advanceTimersByTime(TYPING_DELAY_MS * WELCOME_TEXT.length + 20000 + 100)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('dismiss')).toBeTruthy()
  })
})
