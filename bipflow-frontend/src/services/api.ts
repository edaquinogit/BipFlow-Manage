import axios, { type InternalAxiosRequestConfig } from "axios";

/**
 * 🛰️ BIPFLOW: API CONFIGURATION
 * Centralização de constantes para evitar "Magic Strings" e facilitar manutenção.
 */
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";
const AUTH_KEYS = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * 🛡️ REQUEST INTERCEPTOR
 * Injeção dinâmica do Bearer Token.
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(AUTH_KEYS.ACCESS);

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/**
 * 🔄 RESPONSE INTERCEPTOR & REFRESH LOGIC
 * Gerencia expiração de sessão e erros globais.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 1. Tratamento de 401 (Unauthorized) - Refresh Protocol
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Marca a requisição para não entrar em loop

      const refreshToken = localStorage.getItem(AUTH_KEYS.REFRESH);

      if (refreshToken) {
        try {
          console.info(
            "🔄 [BipFlow]: Session expired. Attempting silent refresh...",
          );

          // Chamada direta via axios puro para evitar interceptores de loop
          const res = await axios.post(`${API_BASE_URL}token/refresh/`, {
            refresh: refreshToken,
          });

          const newAccessToken = res.data.access;

          // Sincronização de Estado
          localStorage.setItem(AUTH_KEYS.ACCESS, newAccessToken);

          // Atualiza o header da requisição que falhou e reenvia
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.error("🚫 [BipFlow]: Refresh Token invalid or expired.");
          handleAuthFailure();
        }
      } else {
        handleAuthFailure();
      }
    }

    // 2. Erros Críticos de Servidor
    if (error.response?.status >= 500) {
      console.error(
        "💥 [BipFlow]: Critical Server Error. Registry Unavailable.",
      );
    }

    return Promise.reject(error);
  },
);

/**
 * 🧹 AUTH FAILURE HANDLER
 * Limpa o rastro de autenticação e redireciona.
 */
function handleAuthFailure() {
  localStorage.removeItem(AUTH_KEYS.ACCESS);
  localStorage.removeItem(AUTH_KEYS.REFRESH);

  // Evita redirecionamento se já estivermos na tela de login (previne loops no Cypress)
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
}

export default api;
