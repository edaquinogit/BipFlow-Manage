import { watch } from 'vue';
import { useCurrentStore } from '@/composables/useCurrentStore';

/**
 * Runs `callback` only when the dashboard's active store actually changes to
 * a different one -- not on the initial resolution from null/cache to the
 * first real store.
 *
 * `DashboardLayout.vue` resolves the current store asynchronously after
 * mount; a page's own `onMounted` fetch can already be in flight (or done)
 * by the time that resolution lands, so a plain `watch(selectedStore, fn)`
 * fires a second, redundant time right after load -- racing the first fetch
 * and clobbering any local UI state (e.g. an just-opened panel) that the
 * callback resets.
 */
export function useStoreSwitchEffect(callback: () => void): void {
  const { selectedStore } = useCurrentStore();

  watch(selectedStore, (next, previous) => {
    if (!previous || next?.slug === previous.slug) {
      return;
    }

    callback();
  });
}
