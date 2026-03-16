import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api/",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * INTERCEPTADOR DE REQUISIÇÃO
 * Adiciona o token JWT em todas as chamadas.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * INTERCEPTADOR DE RESPOSTA
 * Faz refresh automático do token em caso de 401.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const res = await axios.post("http://127.0.0.1:8000/api/token/refresh/", {
            refresh: refreshToken,
          });

          // Atualiza token
          localStorage.setItem("token", res.data.access);

          // Reenvia requisição original com novo token
          error.config.headers.Authorization = `Bearer ${res.data.access}`;
          return api.request(error.config);
        } catch (refreshError) {
          console.error("🚫 Refresh token inválido ou expirado:", refreshError);
          localStorage.removeItem("token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      } else {
        console.warn("🚫 Nenhum refresh token disponível.");
        window.location.href = "/login";
      }
    }

    if (error.response?.status === 500) {
      console.error("💥 Erro interno no servidor Django (500).");
    }

    return Promise.reject(error);
  }
);

export default api;