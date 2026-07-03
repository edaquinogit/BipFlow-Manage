import { describe, it, expect } from 'vitest';
import { normalizeMimeType, compressImageFile } from '../image';

describe('image utility', () => {
  it('returns the same JPEG type when the file is under the limit', () => {
    expect(normalizeMimeType('image/jpeg', 100_000, 2 * 1024 * 1024)).toBe('image/jpeg');
  });

  it('converts PNG oversized files to JPEG for better compression', () => {
    expect(normalizeMimeType('image/png', 3 * 1024 * 1024, 2 * 1024 * 1024)).toBe('image/jpeg');
  });

  it('falls back to JPEG for unsupported mime types', () => {
    expect(normalizeMimeType('application/octet-stream', 300_000, 2 * 1024 * 1024)).toBe('image/jpeg');
  });

  it('returns a non-image file unchanged from compressImageFile', async () => {
    const file = new File(['plain text'], 'document.txt', { type: 'text/plain' });
    const result = await compressImageFile(file);

    expect(result).toBe(file);
  });
});
