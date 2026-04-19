import axios, { type InternalAxiosRequestConfig, type AxiosError } from "axios";

/**
 * 🏷️ BIPFLOW: IMMUTABLE CONFIG
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";

const AUTH_KEYS = Object.freeze({
  ACCESS: "access_token",
  REFRESH: "refresh_token",
});

/**
 * 🚨 Environment Validation
 * Prevent silent failures due to missing configuration
 * Skip validation in test environments where VITE_API_URL might not be set
 */
if (!import.meta.env.VITE_API_URL && import.meta.env.MODE !== 'test') {
  console.error("❌ CRITICAL: VITE_API_URL is not defined. Please check your environment variables.");
  throw new Error("VITE_API_URL environment variable is required but not set.");
}

// Global state to prevent multiple auth failure redirects
let isAuthFailureInProgress = false;

/**
 * 🛑 Request Cancellation System
 * Cancel all pending requests during logout to prevent "Pending" waterfall
 */
const pendingRequests = new Map<string, AbortController>();

// Instância principal
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * 🛡️ REQUEST INTERCEPTOR: DYNAMIC INJECTION + REQUEST TRACKING
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(AUTH_KEYS.ACCESS);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 🛑 Track request for potential cancellation
    const controller = new AbortController();
    config.signal = controller.signal;

    // Generate unique request ID
    const requestId = `${config.method?.toUpperCase()}_${config.url}_${Date.now()}`;
    pendingRequests.set(requestId, controller);

    // Clean up tracking when request completes
    (config.signal as AbortSignal)?.addEventListener('abort', () => {
      pendingRequests.delete(requestId);
    });

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 🔄 RESPONSE INTERCEPTOR: RESILIENCE ENGINE
 */
api.interceptors.response.use(
  (response) => {
    // Clean up completed request tracking
    const requestId = `${response.config?.method?.toUpperCase()}_${response.config?.url}`;
    pendingRequests.forEach((_controller, id) => {
      if (id.startsWith(requestId)) {
        pendingRequests.delete(id);
      }
    });

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Clean up failed request tracking
    const requestId = `${originalRequest.method?.toUpperCase()}_${originalRequest.url}`;
    pendingRequests.forEach((_controller, id) => {
      if (id.startsWith(requestId)) {
        pendingRequests.delete(id);
      }
    });

    // 1. Session Expiration Protocol (401) - IMPROVED
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem(AUTH_KEYS.REFRESH);

      if (refreshToken && !isAuthFailureInProgress) {
        try {
          if (import.meta.env.DEV) {
            console.group('🔄 Token Refresh Attempt');
            console.log('Attempting to refresh access token...');
          }

          // Isolated instance for refresh (Clean Architecture Pattern)
          const refreshInstance = axios.create({ baseURL: API_BASE_URL });
          const res = await refreshInstance.post("token/refresh/", {
            refresh: refreshToken,
          });

          const { access } = res.data;

          // Atomic state synchronization
          localStorage.setItem(AUTH_KEYS.ACCESS, access);

          // Re-execute original request with new Authorization header
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }

          if (import.meta.env.DEV) {
            console.log('✅ Token refreshed successfully, retrying original request');
            console.groupEnd();
          }

          return api(originalRequest);
        } catch (refreshError) {
          if (import.meta.env.DEV) {
            console.log('❌ Token refresh failed, initiating logout');
            console.groupEnd();
          }
          handleAuthFailure();
          return Promise.reject(refreshError);
        }
      } else if (!isAuthFailureInProgress) {
        handleAuthFailure();
      }
    }

    // 2. Critical Infrastructure Errors (500+)
    if (error.response && error.response.status >= 500) {
      if (import.meta.env.DEV) {
        console.warn(`🚨 Server Error (${error.response.status}):`, error.response.data);
      }
      // Server error will be handled by calling code
    }

    return Promise.reject(error);
  }
);

/**
 * 🧹 SECURE PURGE: IDENTITY RESET + REQUEST CANCELLATION
 */
function handleAuthFailure() {
  // 🚨 Prevent multiple simultaneous auth failure handling
  if (isAuthFailureInProgress) {
    if (import.meta.env.DEV) {
      console.warn('⚠️ Auth failure already in progress, skipping duplicate handling');
    }
    return;
  }

  isAuthFailureInProgress = true;

  if (import.meta.env.DEV) {
    console.group('🚨 Auth Failure Protocol');
    console.log('Clearing authentication state...');
    console.log(`Cancelling ${pendingRequests.size} pending requests...`);
  }

  // 🛑 Cancel all pending requests to prevent "Pending" waterfall
  pendingRequests.forEach((controller, requestId) => {
    if (import.meta.env.DEV) {
      console.log(`Cancelling request: ${requestId}`);
    }
    controller.abort();
  });
  pendingRequests.clear();

  // Clear authentication state
  localStorage.removeItem(AUTH_KEYS.ACCESS);
  localStorage.removeItem(AUTH_KEYS.REFRESH);

  // Prevent redirect loops - check current location
  const currentPath = window.location.pathname;
  const isAlreadyOnLogin = currentPath === '/login' || currentPath.startsWith('/login');

  if (!isAlreadyOnLogin) {
    if (import.meta.env.DEV) {
      console.log('Redirecting to login page...');
      console.groupEnd();
    }

    // Use Vue Router for SPA navigation instead of window.location.href
    // This prevents full page reload and maintains SPA behavior
    window.location.href = "/login?reason=session_expired";
  } else {
    if (import.meta.env.DEV) {
      console.log('Already on login page, no redirect needed');
      console.groupEnd();
    }
  }

  // Reset flag after a short delay to allow for page navigation
  setTimeout(() => {
    isAuthFailureInProgress = false;
  }, 1000);
}

export default api;
