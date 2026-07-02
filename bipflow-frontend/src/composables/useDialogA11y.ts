import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behavior for Teleport/fixed-overlay dialogs: closes on Escape,
 * traps Tab focus inside the dialog, and moves focus into the dialog on open.
 * Modeled after the working pattern already used in StockAlertDrawer.vue.
 */
export function useDialogA11y(
  isOpen: Ref<boolean>,
  onClose: () => void,
  containerRef: Ref<HTMLElement | null>,
  initialFocusRef?: Ref<HTMLElement | null>,
): void {
  const getFocusableElements = (): HTMLElement[] => {
    if (!containerRef.value) {
      return [];
    }

    return Array.from(
      containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((element) => element.offsetParent !== null);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = getFocusableElements();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  watch(
    isOpen,
    (open) => {
      if (open) {
        window.addEventListener('keydown', handleKeydown);
        void nextTick(() => (initialFocusRef?.value ?? getFocusableElements()[0])?.focus());
      } else {
        window.removeEventListener('keydown', handleKeydown);
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
}
