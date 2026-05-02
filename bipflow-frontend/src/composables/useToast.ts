/**
 * BipFlow Toast Notification System
 *
 * Provides user feedback for async operations, errors, and confirmations.
 * Integrates with Vue's reactive system.
 *
 * Usage:
 *   const { notify } = useToast()
 *   notify('success', 'Product saved successfully')
 *   notify('error', 'Failed to load categories')
 */

import { ref, computed } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  autoClose?: boolean;
}

const toasts = ref<Toast[]>([]);
const MAX_VISIBLE_TOASTS = 4;

let toastCounter = 0;

/**
 * Generate unique toast ID
 */
function generateId(): string {
  return `toast-${++toastCounter}-${Date.now()}`;
}

/**
 * Add a toast notification
 * @param type - Type of notification (success, error, warning, info)
 * @param message - Message to display
 * @param duration - Auto-close duration in milliseconds. Use 0 to keep it visible.
 */
function notify(type: ToastType, message: string, duration?: number): void {
  const defaultDurations: Record<ToastType, number> = {
    success: 2600,
    info: 3000,
    warning: 3800,
    error: 4800,
  };
  const resolvedDuration = duration ?? defaultDurations[type];

  toasts.value = toasts.value.filter(
    (toast) => toast.type !== type || toast.message !== message
  );

  const toast: Toast = {
    id: generateId(),
    type,
    message,
    duration: resolvedDuration,
    autoClose: resolvedDuration > 0,
  };

  toasts.value = [...toasts.value, toast].slice(-MAX_VISIBLE_TOASTS);

  // Auto-close if duration is set
  if (toast.autoClose && toast.duration) {
    setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration);
  }
}

/**
 * Notify success
 */
function success(message: string, duration?: number): void {
  notify('success', message, duration);
}

/**
 * Notify error
 */
function error(message: string, duration?: number): void {
  notify('error', message, duration);
}

/**
 * Notify warning
 */
function warning(message: string, duration?: number): void {
  notify('warning', message, duration);
}

/**
 * Notify info
 */
function info(message: string, duration?: number): void {
  notify('info', message, duration);
}

/**
 * Remove a toast by ID
 */
function removeToast(id: string): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/**
 * Clear all toasts
 */
function clearAll(): void {
  toasts.value = [];
}

/**
 * Vue composable for using toast notifications
 */
export function useToast() {
  return {
    toasts: computed(() => toasts.value),
    notify,
    success,
    error,
    warning,
    info,
    removeToast,
    clearAll,
  };
}
