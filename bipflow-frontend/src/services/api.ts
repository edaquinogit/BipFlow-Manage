import axios, { type InternalAxiosRequestConfig, type AxiosError } from "axios";
import { Logger } from "./logger";
import { getSelectedStoreSlug } from "./store-scope";
import { tokenStore } from "./token-store";

interface TokenRefreshPayload {
  access: string;
}

/**
 * 🏷️ BIPFLOW: IMMUTABLE CONFIG
 *
 * Relative on purpose: vite.config.ts proxies /api to the Django dev server,
 * so this resolves against whatever origin the page was opened with
 * (localhost, 127.0.0.1, or a LAN IP from a phone) instead of hardcoding one
 * -- an absolute http://localhost:8000/... fallback breaks both on a phone
 * (localhost there means the phone itself) and the old SameSite=Strict
 * refresh-token cookie (localhost/127.0.0.1 count as different sites).
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/";

/**
 * 🚨 Environment Validation
 * Prevent silent failures due to missing configuration
 * Skip validation in test environments where VITE_API_URL might not be set
 */
if (!import.meta.env.VITE_API_URL && import.meta.env.MODE !== 'test') {
  Logger.error("VITE_API_URL is not defined", {
    mode: import.meta.env.MODE,
  });
  throw new Error("VITE_API_URL environment variable is required but not set.");
}

// Global state to prevent multiple auth failure redirects
let isAuthFailureInProgress = false;
let refreshRequest: Promise<TokenRefreshPayload> | null = null;

/**
 * 🛑 Request Cancellation System
 * Cancel all pending requests during logout to prevent "Pending" waterfall
 */
const pendingRequests = new Map<string, AbortController>();

function refreshAuthTokens(): Promise<TokenRefreshPayload> {
  if (!refreshRequest) {
    // Separate instance: the refresh token rides the httpOnly cookie
    // automatically via withCredentials, never the request body.
    const refreshInstance = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

    refreshRequest = refreshInstance
      .post<TokenRefreshPayload>("auth/token/refresh/")
      .then((response) => {
        tokenStore.setAccessToken(response.data.access);
        return response.data;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

/**
 * Restore the in-memory access token on app boot via the httpOnly refresh
 * cookie. Memoized so every guarded route navigation on first load shares
 * the same network round-trip instead of firing one each.
 */
let authBootPromise: Promise<void> | null = null;

export function ensureAuthBooted(): Promise<void> {
  if (!authBootPromise) {
    authBootPromise = refreshAuthTokens()
      .then(() => undefined)
      .catch(() => undefined);
  }

  return authBootPromise;
}

// Instância principal
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
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
    const token = tokenStore.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const selectedStoreSlug = getSelectedStoreSlug();
    if (selectedStoreSlug && config.headers) {
      const headers = config.headers as typeof config.headers & {
        set?: (name: string, value: string) => void;
      };

      if (typeof headers.set === "function") {
        headers.set("X-Store-Slug", selectedStoreSlug);
      } else {
        (config.headers as unknown as Record<string, string>)["X-Store-Slug"] =
          selectedStoreSlug;
      }
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
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retriedAfterTimeout?: boolean;
    };

    // Clean up failed request tracking
    const requestId = `${originalRequest.method?.toUpperCase()}_${originalRequest.url}`;
    pendingRequests.forEach((_controller, id) => {
      if (id.startsWith(requestId)) {
        pendingRequests.delete(id);
      }
    });

    // 0. Cold-start resilience: the production backend (Render free tier)
    // spins down after inactivity and can take 50s+ to wake up, longer than
    // the 15s default timeout -- a GET that times out on a cold instance
    // has a good chance the instance is awake by the time we retry, so give
    // it one retry with a much longer timeout instead of failing outright.
    // Restricted to GET: retrying a timed-out POST/PATCH/DELETE is unsafe,
    // since the original request may have already completed server-side
    // (e.g. a duplicate product create).
    const isTimeout = error.code === "ECONNABORTED";
    const isRetriableMethod = originalRequest.method?.toLowerCase() === "get";
    if (isTimeout && isRetriableMethod && !originalRequest._retriedAfterTimeout) {
      originalRequest._retriedAfterTimeout = true;
      originalRequest.timeout = 45000;

      if (import.meta.env.DEV) {
        Logger.warn("Request timed out, retrying once with a longer timeout", {
          url: originalRequest.url,
        });
      }

      return api(originalRequest);
    }

    // 1. Session Expiration Protocol (401) - IMPROVED
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isAuthFailureInProgress) {
        try {
          if (import.meta.env.DEV) {
            Logger.info("Attempting to refresh access token");
          }

          // No client-side way to know if the httpOnly refresh cookie is
          // still valid -- attempt the refresh and let it fail if not.
          const { access } = await refreshAuthTokens();

          // Re-execute original request with new Authorization header
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }

          if (import.meta.env.DEV) {
            Logger.info("Token refreshed successfully, retrying original request");
          }

          return api(originalRequest);
        } catch (refreshError) {
          if (import.meta.env.DEV) {
            Logger.warn("Token refresh failed, initiating logout");
          }
          handleAuthFailure();
          return Promise.reject(refreshError);
        }
      }
    }

    // 2. Critical Infrastructure Errors (500+)
    if (error.response && error.response.status >= 500) {
      if (import.meta.env.DEV) {
        Logger.warn("Server error returned by API", {
          status: error.response.status,
          data: error.response.data,
        });
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
      Logger.warn("Auth failure already in progress, skipping duplicate handling");
    }
    return;
  }

  isAuthFailureInProgress = true;

  if (import.meta.env.DEV) {
    Logger.warn("Handling authentication failure", {
      pendingRequestCount: pendingRequests.size,
    });
  }

  // 🛑 Cancel all pending requests to prevent "Pending" waterfall
  pendingRequests.forEach((controller, requestId) => {
    if (import.meta.env.DEV) {
      Logger.debug("Cancelling pending request", { requestId });
    }
    controller.abort();
  });
  pendingRequests.clear();

  // Clear authentication state through the centralized contract
  tokenStore.clearAccessToken();

  // Prevent redirect loops - check current location
  const currentPath = window.location.pathname;
  const isAlreadyOnLogin = currentPath === '/login' || currentPath.startsWith('/login');

  if (!isAlreadyOnLogin) {
    if (import.meta.env.DEV) {
      Logger.info("Redirecting to login page");
    }

    // Use Vue Router for SPA navigation instead of window.location.href
    // This prevents full page reload and maintains SPA behavior
    window.location.href = "/login?reason=session_expired";
  } else {
    if (import.meta.env.DEV) {
      Logger.debug("Already on login page, no redirect needed");
    }
  }

  // Reset flag after a short delay to allow for page navigation
  setTimeout(() => {
    isAuthFailureInProgress = false;
  }, 1000);
}

export default api;
