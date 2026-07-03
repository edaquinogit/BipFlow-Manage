const MAX_IMAGE_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MIN_IMAGE_QUALITY = 0.5;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_DIMENSIONS = [2048, 1536, 1280, 1024, 768, 640];

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

function createImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao processar a imagem.'));
    };

    image.src = url;
  });
}

function createBlobFromCanvas(
  canvas: HTMLCanvasElement,
  fileType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Não foi possível gerar a imagem comprimida.'));
      }
    }, fileType, quality);
  });
}

function buildCanvas(source: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas não suportado pelo navegador.');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function normalizeMimeType(fileType: string, fileSize: number, maxBytes: number): string {
  if (!SUPPORTED_IMAGE_TYPES.includes(fileType)) {
    return 'image/jpeg';
  }

  // PNG is lossless and often does not shrink on browser canvas export.
  // Convert oversized PNG inputs to JPEG for better compression.
  if (fileType === 'image/png' && fileSize > maxBytes) {
    return 'image/jpeg';
  }

  return fileType;
}

async function compressCanvasOutput(
  canvas: HTMLCanvasElement,
  fileType: string,
  maxSize: number,
): Promise<Blob> {
  let quality = 0.92;
  let blob = await createBlobFromCanvas(canvas, fileType, quality);

  while (blob.size > maxSize && quality >= MIN_IMAGE_QUALITY) {
    quality *= 0.85;
    blob = await createBlobFromCanvas(canvas, fileType, quality);
  }

  return blob;
}

export async function compressImageFile(file: File, maxBytes = MAX_IMAGE_FILE_SIZE): Promise<File> {
  if (!isImageFile(file)) {
    return file;
  }

  if (file.size <= maxBytes) {
    return file;
  }

  const image = await createImage(file);
  const fileType = normalizeMimeType(file.type, file.size, maxBytes);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  const longerSide = Math.max(originalWidth, originalHeight);
  let lastBlob: Blob | null = null;

  for (const maxDimension of MAX_DIMENSIONS) {
    const scale = Math.min(1, maxDimension / longerSide);
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = buildCanvas(image, width, height);

    const blob = await compressCanvasOutput(canvas, fileType, maxBytes);
    lastBlob = blob;

    if (blob.size <= maxBytes) {
      return new File([blob], file.name, { type: fileType });
    }
  }

  if (lastBlob && lastBlob.size <= maxBytes) {
    return new File([lastBlob], file.name, { type: fileType });
  }

  throw new Error('A imagem continua acima de 2MB após a compactação. Tente outra imagem ou reduza a resolução.');
}
