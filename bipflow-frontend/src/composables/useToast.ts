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
  duration?: number; // milliseconds, undefined = sticky (user must close)
  autoClose?: boolean;
}

const toasts = ref<Toast[]>([]);

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
 * @param duration - Auto-close duration in milliseconds (default: 5000 for success, undefined for error)
 */
function notify(type: ToastType, message: string, duration?: number): void {
  // Default durations by type
  const defaultDuration = type === 'error' ? undefined : 5000;

  const toast: Toast = {
    id: generateId(),
    type,
    message,
    duration: duration ?? defaultDuration,
    autoClose: (duration ?? defaultDuration) !== undefined,
  };

  toasts.value.push(toast);

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
function success(message: string, duration = 5000): void {
  notify('success', message, duration);
}

/**
 * Notify error (sticky by default)
 */
function error(message: string, duration?: number): void {
  notify('error', message, duration);
}

/**
 * Notify warning
 */
function warning(message: string, duration = 5000): void {
  notify('warning', message, duration);
}

/**
 * Notify info
 */
function info(message: string, duration = 5000): void {
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
