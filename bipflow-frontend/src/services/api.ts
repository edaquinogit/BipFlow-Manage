import axios, { type InternalAxiosRequestConfig, type AxiosError } from "axios";
import { getApiBaseUrl } from "@/lib/apiBase";

/**
 * 🏷️ BIPFLOW: IMMUTABLE CONFIG
 */
const API_BASE_URL = getApiBaseUrl();

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

    // 1. Protocolo de Expiração de Sessão (401)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem(AUTH_KEYS.REFRESH);

      if (refreshToken) {
        try {
          console.info("🔄 [BipFlow]: Session expired. Initiating silent recovery...");

          // Instância isolada para o refresh (NYC Clean Pattern)
          const refreshInstance = axios.create({ baseURL: API_BASE_URL });
          const res = await refreshInstance.post("token/refresh/", {
            refresh: refreshToken,
          });

          const { access } = res.data;

          // Sincronização de Estado Atômico
          localStorage.setItem(AUTH_KEYS.ACCESS, access);

          // Re-execução da requisição original com o novo Header
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access}`;
          }
          
          return api(originalRequest);
        } catch (refreshError) {
          console.error("🚫 [BipFlow]: Critical Auth Failure. Identity invalidated.");
          handleAuthFailure();
          return Promise.reject(refreshError);
        }
      } else {
        handleAuthFailure();
      }
    }

    // 2. Erros Críticos de Infraestrutura (500+)
    if (error.response && error.response.status >= 500) {
      console.error("💥 [BipFlow]: Engine Stall. Remote registry is unresponsive.");
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
    // Adiciona um parâmetro de query para informar o motivo ao usuário
    window.location.href = "/login?reason=session_expired";
  }
}

export default api;