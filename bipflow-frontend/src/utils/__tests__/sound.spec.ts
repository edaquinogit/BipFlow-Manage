import { describe, it, expect, vi, afterEach } from "vitest";
import { playScanSuccessBeep } from "../sound";

describe("playScanSuccessBeep", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "AudioContext");
  });

  it("does nothing (and does not throw) when the Web Audio API is unavailable", () => {
    Reflect.deleteProperty(window, "AudioContext");
    expect(() => playScanSuccessBeep()).not.toThrow();
  });

  it("plays a short tone through the Web Audio API when available", () => {
    const oscillator = {
      type: "",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const close = vi.fn();
    const context = {
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
      destination: {},
      currentTime: 0,
      close,
    };
    const AudioContextMock = vi.fn(function AudioContextMockImpl() {
      return context;
    });
    Object.defineProperty(window, "AudioContext", { value: AudioContextMock, configurable: true });

    playScanSuccessBeep();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(oscillator.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(context.destination);
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);

    oscillator.onended?.();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("swallows errors thrown by the Web Audio API", () => {
    Object.defineProperty(window, "AudioContext", {
      value: vi.fn(function AudioContextMockImpl() {
        throw new Error("boom");
      }),
      configurable: true,
    });

    expect(() => playScanSuccessBeep()).not.toThrow();
  });
});
