import { computed, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue';
import QrScanner from 'qr-scanner';

/**
 * Etapa C2 of the PDV camera-scanner evolution (see
 * docs/architecture/pdv-camera-scanner-refinement.md): wraps `qr-scanner`'s
 * camera lifecycle (permissions, camera selection, decode loop) behind a
 * small typed surface. Deliberately knows nothing about products/cart --
 * the caller decides what a decoded string means (see
 * `extractPublicCodeFromScan()` in `utils/pdvScan.ts`), this composable only
 * owns "is the camera open and did it just read something".
 */
export type PdvCameraScannerErrorReason =
  | 'insecure-context'
  | 'not-supported'
  | 'permission-denied'
  | 'no-camera'
  | 'unknown';

export interface PdvCameraScannerError {
  reason: PdvCameraScannerErrorReason;
  message: string;
}

const ERROR_MESSAGES: Record<PdvCameraScannerErrorReason, string> = {
  'insecure-context':
    'Este recurso exige uma conexão segura (HTTPS). Abra o painel por um endereço https:// para usar a câmera.',
  'not-supported': 'Este navegador não tem suporte à leitura de QR Code pela câmera.',
  'permission-denied':
    'Permissão de câmera negada. Autorize o acesso à câmera nas configurações do navegador e tente novamente.',
  'no-camera': 'Nenhuma câmera foi encontrada neste dispositivo.',
  unknown: 'Não foi possível acessar a câmera. Tente novamente.',
};

/**
 * Minimum time between two decode callbacks reaching the caller. Without
 * this, holding the camera steady over one label re-fires the same decode
 * many times per second -- the caller (DashboardPdvView.vue) would otherwise
 * need its own debouncing just to avoid adding the same item repeatedly.
 */
const DECODE_COOLDOWN_MS = 1200;

function mapStartError(raw: unknown): PdvCameraScannerErrorReason {
  const name = raw instanceof DOMException ? raw.name : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'permission-denied';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'no-camera';
  }
  return 'unknown';
}

export function usePdvCameraScanner(
  videoRef: Ref<HTMLVideoElement | null>,
  onDecode: (rawText: string) => void
) {
  const scanner = shallowRef<QrScanner | null>(null);
  const isActive = ref(false);
  const error = ref<PdvCameraScannerError | null>(null);
  const cameras = ref<QrScanner.Camera[]>([]);
  const activeCameraId = ref<string | null>(null);

  let lastAcceptedAt = 0;

  const setError = (reason: PdvCameraScannerErrorReason): void => {
    error.value = { reason, message: ERROR_MESSAGES[reason] };
  };

  const handleDecode = (result: QrScanner.ScanResult): void => {
    const now = Date.now();
    if (now - lastAcceptedAt < DECODE_COOLDOWN_MS) {
      return;
    }
    lastAcceptedAt = now;
    onDecode(result.data);
  };

  const loadCameras = async (): Promise<void> => {
    try {
      cameras.value = await QrScanner.listCameras(true);
    } catch {
      cameras.value = [];
    }
  };

  const start = async (): Promise<void> => {
    error.value = null;

    if (!window.isSecureContext) {
      setError('insecure-context');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('not-supported');
      return;
    }
    if (!(await QrScanner.hasCamera())) {
      setError('no-camera');
      return;
    }
    if (!videoRef.value) {
      return;
    }

    const instance = new QrScanner(videoRef.value, handleDecode, {
      preferredCamera: 'environment',
      maxScansPerSecond: 5,
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });
    scanner.value = instance;

    try {
      await instance.start();
      isActive.value = true;
      void loadCameras();
    } catch (raw: unknown) {
      setError(mapStartError(raw));
      instance.destroy();
      scanner.value = null;
    }
  };

  const stop = (): void => {
    scanner.value?.stop();
    scanner.value?.destroy();
    scanner.value = null;
    isActive.value = false;
  };

  const switchCamera = async (cameraId: string): Promise<void> => {
    if (!scanner.value) {
      return;
    }
    await scanner.value.setCamera(cameraId);
    activeCameraId.value = cameraId;
  };

  onBeforeUnmount(stop);

  return {
    isActive,
    error,
    cameras,
    activeCameraId,
    hasMultipleCameras: computed(() => cameras.value.length > 1),
    start,
    stop,
    switchCamera,
  };
}
