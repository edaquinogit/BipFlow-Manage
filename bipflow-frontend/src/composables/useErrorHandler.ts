/**
 * BipFlow Error Handling Composable
 *
 * Provides standardized error handling for Vue components.
 * Handles both API errors and user-facing error display.
 */

import { readonly, ref, type Ref } from 'vue';
import { getErrorMessage, getErrorType, isStandardizedError, type ApplicationError } from '../types/errors';
import { Logger } from '../services/logger';

export interface ErrorState {
  hasError: boolean;
  message: string;
  type?: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export function useErrorHandler() {
  const error: Ref<ErrorState> = ref({
    hasError: false,
    message: '',
  });

  /**
   * Handle an error and update the error state
   */
  function handleError(errorInstance: ApplicationError | unknown, context?: string): void {
    const errorMessage = getErrorMessage(errorInstance);
    const errorType = getErrorType(errorInstance);

    // Extract additional context for standardized errors
    let requestId: string | undefined;
    let details: Record<string, unknown> | undefined;

    if (isStandardizedError(errorInstance)) {
      requestId = errorInstance.request_id;
      details = errorInstance.details;
    }

    // Update reactive state
    error.value = {
      hasError: true,
      message: errorMessage,
      type: errorType,
      requestId,
      details,
    };

    // Log error with context
    Logger.error('Error handled in component', {
      errorMessage,
      errorType,
      requestId,
      context,
      details,
    });
  }

  /**
   * Clear the current error state
   */
  function clearError(): void {
    error.value = {
      hasError: false,
      message: '',
    };
  }

  /**
   * Get user-friendly error message based on error type
   */
  function getUserFriendlyMessage(): string {
    if (!error.value.hasError) return '';

    const { type, message } = error.value;

    // Provide user-friendly messages for common error types
    switch (type) {
      case 'VALIDATION_ERROR':
        return 'Verifique os dados informados e tente novamente.';
      case 'NOT_FOUND':
        return 'O item solicitado não foi encontrado.';
      case 'PERMISSION_DENIED':
        return 'Você não tem permissão para executar esta ação.';
      case 'BUSINESS_LOGIC_ERROR':
        return message; // Business logic errors should be user-friendly
      case 'INTERNAL_SERVER_ERROR':
        return 'Erro interno do servidor. Tente novamente mais tarde.';
      case 'NOT_AUTHENTICATED':
        return 'Sua sessão expirou. Faça login novamente.';
      default:
        return message || 'Ocorreu um erro inesperado.';
    }
  }

  /**
   * Check if current error is retryable
   */
  function isRetryable(): boolean {
    if (!error.value.hasError || !error.value.type) return false;

    const retryableTypes = [
      'INTERNAL_SERVER_ERROR',
      'THROTTLED',
    ];

    return retryableTypes.includes(error.value.type);
  }

  return {
    error: readonly(error),
    handleError,
    clearError,
    getUserFriendlyMessage,
    isRetryable,
  };
}
