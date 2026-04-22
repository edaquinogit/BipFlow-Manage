/**
 * BipFlow Error Type Definitions
 *
 * Provides comprehensive, type-safe error handling across the application.
 * Supports axios errors, validation errors, and custom application errors.
 */

import type { AxiosError } from 'axios';
import type { ZodError } from 'zod';

/**
 * API Error Response Structure - Standardized BipFlow Format
 * All backend errors follow this format after standardization
 */
export interface StandardizedApiErrorResponse {
  error: string; // Error type identifier (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
  message: string; // Human-readable error message
  request_id: string; // Request tracking ID
  details?: Record<string, unknown>; // Optional additional context
}

/**
 * Legacy API Error Response Structure
 * Some endpoints may still return this format during transition
 */
export interface ApiErrorResponse {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
  [key: string]: unknown;
}

/**
 * Structured Error Context for Logging
 */
export interface ErrorContext {
  statusCode?: number;
  endpoint?: string;
  method?: string;
  timestamp?: string;
  userId?: string | number;
  validationErrors?: Record<string, string[]>;
  [key: string]: unknown;
}

/**
 * Union type for all possible error scenarios in the application
 */
export type ApplicationError = AxiosError<ApiErrorResponse> | ZodError | Error;

/**
 * Type guard to check if error is an AxiosError
 */
export function isAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return error instanceof Error && 'response' in error && 'config' in error;
}

/**
 * Type guard to check if error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof Error && 'errors' in error && 'format' in error;
}

/**
 * Extract human-readable error message from any error type
 * Now supports both standardized and legacy error formats
 */
export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado'): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    // Check for standardized error format first
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    // Fallback to legacy format
    if ('detail' in error && typeof error.detail === 'string') {
      return error.detail;
    }
  }

  return fallback;
}

/**
 * Extract error type from standardized error response
 */
export function getErrorType(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return String(error.error);
  }
  return undefined;
}

/**
 * Check if error is a standardized BipFlow error response
 */
export function isStandardizedError(error: unknown): error is StandardizedApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    'message' in error &&
    'request_id' in error &&
    typeof (error as any).error === 'string' &&
    typeof (error as any).message === 'string' &&
    typeof (error as any).request_id === 'string'
  );
}

/**
 * Extract HTTP status code from error, if available
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
}

/**
 * Build error context for structured logging
 */
export function buildErrorContext(
  error: unknown,
  additionalContext?: Record<string, unknown>,
): ErrorContext {
  const context: ErrorContext = {
    timestamp: new Date().toISOString(),
    ...additionalContext,
  };

  if (isAxiosError(error)) {
    context.statusCode = error.response?.status;
    context.endpoint = error.config?.url;
    context.method = error.config?.method?.toUpperCase();
  }

  if (isZodError(error)) {
    context.validationErrors = error.flatten().fieldErrors as Record<string, string[]>;
  }

  return context;
}
