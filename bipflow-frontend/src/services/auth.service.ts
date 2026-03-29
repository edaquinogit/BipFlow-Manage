import api from "./api";
import type { LoginCredentials, LoginResponse } from "../types/auth";

export interface RegisterCredentials extends LoginCredentials {
  name: string;
}

export const authService = {
  /**
   * Realiza o Login e salva tokens
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const payload = {
        username: credentials.email,
        password: credentials.password,
      };

      const response = await api.post<LoginResponse>("token/", payload);

      if (response.data.access) {
        localStorage.setItem("token", response.data.access);
        localStorage.setItem("refresh_token", response.data.refresh);
      }

      return response.data;
    } catch (error) {
      console.error("Erro no login:", error);
      throw error;
    }
  },

  /**
   * Cria um novo usuário
   */
  async register(credentials: RegisterCredentials): Promise<void> {
    try {
      await api.post("register/", credentials);
    } catch (error) {
      console.error("Erro no cadastro:", error);
      throw error;
    }
  },

  /**
   * Faz refresh manual do token
   */
  async refreshToken(): Promise<void> {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) throw new Error("Refresh token não encontrado");

    const response = await api.post("token/refresh/", { refresh });
    localStorage.setItem("token", response.data.access);
  },

  /**
   * Logout
   */
  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
  },

  /**
   * Verifica se usuário está logado
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  },
};
