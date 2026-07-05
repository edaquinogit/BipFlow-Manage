import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { usePdvCameraScanner } from '../usePdvCameraScanner'
import QrScanner from 'qr-scanner'

/**
 * Etapa C2 of the PDV camera-scanner evolution (see
 * docs/architecture/pdv-camera-scanner-refinement.md). `qr-scanner` talks to
 * real camera hardware (getUserMedia) -- not simulable in jsdom -- so this
 * mocks the library entirely and only verifies the composable's own logic:
 * secure-context/support/permission gating, mapping start() failures to a
 * typed reason, and the decode cooldown.
 */
vi.mock('qr-scanner', () => {
  class MockQrScanner {
    static hasCamera = vi.fn()
    static listCameras = vi.fn()
    static instances: MockQrScanner[] = []
    // Lets a test pre-configure how the *next* constructed instance's
    // start() behaves, since the instance itself only exists once the
    // composable calls `new QrScanner(...)` inside its own start().
    static nextStartImpl: () => Promise<void> = () => Promise.resolve()
    onDecode: (result: { data: string }) => void
    start = vi.fn(() => MockQrScanner.nextStartImpl())
    stop = vi.fn()
    destroy = vi.fn()
    setCamera = vi.fn().mockResolvedValue(undefined)

    constructor(_video: unknown, onDecode: (result: { data: string }) => void) {
      this.onDecode = onDecode
      MockQrScanner.instances.push(this)
    }
  }
  return { default: MockQrScanner }
})

const MockedQrScanner = QrScanner as unknown as {
  hasCamera: ReturnType<typeof vi.fn>
  listCameras: ReturnType<typeof vi.fn>
  nextStartImpl: () => Promise<void>
  instances: Array<{
    onDecode: (result: { data: string }) => void
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    setCamera: ReturnType<typeof vi.fn>
  }>
}

const mountScanner = (onDecode: (rawText: string) => void) => {
  const HostComponent = defineComponent({
    setup(_props, { expose }) {
      const videoRef = ref<HTMLVideoElement | null>(null)
      const scanner = usePdvCameraScanner(videoRef, onDecode)
      expose(scanner)
      return () => h('video', { ref: videoRef })
    },
  })
  return mount(HostComponent)
}

describe('usePdvCameraScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockedQrScanner.instances.length = 0
    MockedQrScanner.hasCamera.mockResolvedValue(true)
    MockedQrScanner.listCameras.mockResolvedValue([])
    MockedQrScanner.nextStartImpl = () => Promise.resolve()
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('surfaces an insecure-context error and never touches the camera', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    const wrapper = mountScanner(vi.fn())

    await (wrapper.vm as any).start()

    expect((wrapper.vm as any).error.reason).toBe('insecure-context')
    expect(MockedQrScanner.hasCamera).not.toHaveBeenCalled()
  })

  it('surfaces a not-supported error when getUserMedia does not exist', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    const wrapper = mountScanner(vi.fn())

    await (wrapper.vm as any).start()

    expect((wrapper.vm as any).error.reason).toBe('not-supported')
  })

  it('surfaces a no-camera error when the device has no camera', async () => {
    MockedQrScanner.hasCamera.mockResolvedValue(false)
    const wrapper = mountScanner(vi.fn())

    await (wrapper.vm as any).start()

    expect((wrapper.vm as any).error.reason).toBe('no-camera')
  })

  it('maps a NotAllowedError from scanner.start() to permission-denied', async () => {
    MockedQrScanner.nextStartImpl = () =>
      Promise.reject(new DOMException('denied', 'NotAllowedError'))
    const wrapper = mountScanner(vi.fn())

    await (wrapper.vm as any).start()

    expect((wrapper.vm as any).error.reason).toBe('permission-denied')
    expect(MockedQrScanner.instances[0]!.destroy).toHaveBeenCalledTimes(1)
  })

  it('maps a NotFoundError from scanner.start() to no-camera', async () => {
    MockedQrScanner.nextStartImpl = () =>
      Promise.reject(new DOMException('none', 'NotFoundError'))
    const wrapper = mountScanner(vi.fn())

    await (wrapper.vm as any).start()

    expect((wrapper.vm as any).error.reason).toBe('no-camera')
  })

  it('starts the camera and forwards a decoded code to onDecode', async () => {
    const onDecode = vi.fn()
    const wrapper = mountScanner(onDecode)

    await (wrapper.vm as any).start()
    expect((wrapper.vm as any).isActive).toBe(true)

    const instance = MockedQrScanner.instances[0]!
    instance.onDecode({ data: 'https://app.bipflow.com/l/loja/p/ABC123' })

    expect(onDecode).toHaveBeenCalledWith('https://app.bipflow.com/l/loja/p/ABC123')
  })

  it('ignores repeated decodes within the cooldown window, but accepts the next one after it', async () => {
    vi.useFakeTimers()
    const onDecode = vi.fn()
    const wrapper = mountScanner(onDecode)

    await (wrapper.vm as any).start()
    const instance = MockedQrScanner.instances[0]!

    instance.onDecode({ data: 'CODE1' })
    instance.onDecode({ data: 'CODE1' })
    instance.onDecode({ data: 'CODE1' })
    expect(onDecode).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1300)
    instance.onDecode({ data: 'CODE1' })
    expect(onDecode).toHaveBeenCalledTimes(2)
  })

  it('stop() releases the camera and resets isActive', async () => {
    const wrapper = mountScanner(vi.fn())
    await (wrapper.vm as any).start()
    const instance = MockedQrScanner.instances[0]!

    ;(wrapper.vm as any).stop()

    expect(instance.stop).toHaveBeenCalledTimes(1)
    expect(instance.destroy).toHaveBeenCalledTimes(1)
    expect((wrapper.vm as any).isActive).toBe(false)
  })

  it('switchCamera() calls setCamera on the active scanner instance', async () => {
    const wrapper = mountScanner(vi.fn())
    await (wrapper.vm as any).start()
    const instance = MockedQrScanner.instances[0]!

    await (wrapper.vm as any).switchCamera('camera-2')

    expect(instance.setCamera).toHaveBeenCalledWith('camera-2')
    expect((wrapper.vm as any).activeCameraId).toBe('camera-2')
  })
})
