/**
 * Etapa C3 of the PDV camera-scanner evolution (see
 * docs/architecture/pdv-camera-scanner-refinement.md): a short confirmation
 * beep for a successful scan, generated with the Web Audio API instead of
 * shipping an audio asset. Unifies the feedback across all three ways a
 * product enters the PDV cart (HID scanner, manual typing, camera) -- until
 * now only the camera gave any physical feedback (vibration).
 */
export function playScanSuccessBeep(): void {
  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => void context.close();
  } catch {
    // Best-effort feedback only -- never let a beep failure interrupt a sale.
  }
}
