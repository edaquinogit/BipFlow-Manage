import axios, { type InternalAxiosRequestConfig, type AxiosError } from "axios";

/**
 * 🏷️ BIPFLOW: IMMUTABLE CONFIG
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";

const AUTH_KEYS = Object.freeze({
  ACCESS: "access_token",
  REFRESH: "refresh_token",
});

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
 * 🛡️ REQUEST INTERCEPTOR: DYNAMIC INJECTION
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(AUTH_KEYS.ACCESS);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 🔄 RESPONSE INTERCEPTOR: RESILIENCE ENGINE
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 1. Session Expiration Protocol (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem(AUTH_KEYS.REFRESH);

      if (refreshToken) {
        try {
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

          return api(originalRequest);
        } catch (refreshError) {
          handleAuthFailure();
          return Promise.reject(refreshError);
        }
      } else {
        handleAuthFailure();
      }
    }

    // 2. Critical Infrastructure Errors (500+)
    if (error.response && error.response.status >= 500) {
      // Server error will be handled by calling code
    }

    return Promise.reject(error);
  }
);

/**
 * 🧹 SECURE PURGE: IDENTITY RESET
 */
function handleAuthFailure() {
  localStorage.removeItem(AUTH_KEYS.ACCESS);
  localStorage.removeItem(AUTH_KEYS.REFRESH);

  const isLoginPage = window.location.pathname.includes("/login");

  if (!isLoginPage) {
    // Add query parameter to inform user of reason
    window.location.href = "/login?reason=session_expired";
  }
}

export default api;
