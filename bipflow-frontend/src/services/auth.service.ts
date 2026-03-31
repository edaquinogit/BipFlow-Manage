import api from "./api";
import type { LoginCredentials, LoginResponse } from "../types/auth";

export const authService = {
  /**
   * Realiza o Login e salva tokens no LocalStorage
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Ajuste estratégico: O Django (SimpleJWT) espera 'username'
      const payload = {
        username: credentials.email,
        password: credentials.password,
      };

      // Certifique-se que o 'api.ts' já tem o prefixo /api/v1/
      const { data } = await api.post<LoginResponse>("auth/token/", payload);

      if (data.access) {
        localStorage.setItem("token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
      }

      return data;
    } catch (error) {
      console.error("[AuthService] Erro no login:", error);
      throw error;
    }
  },

  /**
   * Logout Radical (Limpa tudo e reseta a app)
   */
  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  }
};
