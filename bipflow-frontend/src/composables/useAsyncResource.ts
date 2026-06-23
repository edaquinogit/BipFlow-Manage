import { ref, type Ref } from 'vue';
import { Logger } from '@/services/logger';

/**
 * Shared shape for the isLoading/error/try-catch-Logger.warn triplet that
 * was being hand-rolled in every dashboard view's fetch function.
 */
export function useAsyncResource<T>() {
  const data = ref<T | null>(null) as Ref<T | null>;
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function run(loader: () => Promise<T>, errorMessage: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      data.value = await loader();
    } catch (caughtError: unknown) {
      Logger.warn('useAsyncResource: request failed', { error: caughtError });
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  }

  return { data, isLoading, error, run };
}
