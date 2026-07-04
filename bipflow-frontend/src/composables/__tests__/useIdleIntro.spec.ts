import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useIdleIntro, type UseIdleIntroOptions } from '../useIdleIntro'

function mountHarness(options?: UseIdleIntroOptions): VueWrapper<any> {
  const Harness = defineComponent({
    setup() {
      const { showIntro, dismissIntro } = useIdleIntro(options)
      return { showIntro, dismissIntro }
    },
    render() {
      return h('div', String(this.showIntro))
    },
  })

  return mount(Harness)
}

describe('useIdleIntro', () => {
  let wrapper: VueWrapper<any> | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
  })

  it('shows the intro on first entry to a store this session', () => {
    wrapper = mountHarness({ storeKey: 'loja-a' })

    expect(wrapper.vm.showIntro).toBe(true)
  })

  it('does not show again on a later mount for the same store in the same session', () => {
    mountHarness({ storeKey: 'loja-b' }).unmount()

    wrapper = mountHarness({ storeKey: 'loja-b' })

    expect(wrapper.vm.showIntro).toBe(false)
  })

  it('shows again for a different store even within the same session', () => {
    mountHarness({ storeKey: 'loja-c' }).unmount()

    wrapper = mountHarness({ storeKey: 'loja-d' })

    expect(wrapper.vm.showIntro).toBe(true)
  })

  it('dismissIntro hides the intro', () => {
    wrapper = mountHarness({ storeKey: 'loja-e' })
    wrapper.vm.dismissIntro()

    expect(wrapper.vm.showIntro).toBe(false)
  })

  it('does not re-show before the idle threshold elapses', async () => {
    wrapper = mountHarness({ storeKey: 'loja-f', idleMs: 5 * 60 * 1000 })
    wrapper.vm.dismissIntro()

    vi.advanceTimersByTime(60 * 1000)
    window.dispatchEvent(new Event('keydown'))
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.showIntro).toBe(false)
  })

  it('re-shows the intro once the idle threshold elapses and activity resumes', async () => {
    wrapper = mountHarness({ storeKey: 'loja-g', idleMs: 5 * 60 * 1000 })
    wrapper.vm.dismissIntro()

    vi.advanceTimersByTime(5 * 60 * 1000 + 1000)
    window.dispatchEvent(new Event('keydown'))
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.showIntro).toBe(true)
  })

  it('does not re-show just from the passage of time without any activity', async () => {
    wrapper = mountHarness({ storeKey: 'loja-h', idleMs: 5 * 60 * 1000 })
    wrapper.vm.dismissIntro()

    vi.advanceTimersByTime(10 * 60 * 1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.showIntro).toBe(false)
  })

  it('removes its activity listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    wrapper = mountHarness({ storeKey: 'loja-i' })
    const addedEvents = addSpy.mock.calls.map((call) => call[0])
    wrapper.unmount()
    wrapper = null

    for (const eventName of addedEvents) {
      if (['pointerdown', 'keydown', 'wheel', 'touchstart'].includes(eventName as string)) {
        expect(removeSpy).toHaveBeenCalledWith(eventName, expect.any(Function))
      }
    }

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
