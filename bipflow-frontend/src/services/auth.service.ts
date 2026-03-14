import api from './api';
import type { LoginCredentials, LoginResponse } from '../types/auth';

// Interface para o Cadastro (Register)
export interface RegisterCredentials extends LoginCredentials {
  name: string;
}

export const authService = {
  /**
   * Realiza o Login e salva o "passaporte" (token)
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Ajuste: enviamos o email como 'username' para o Django entender
      const payload = {
        username: credentials.email, // Mapeia email para username
        password: credentials.password
      };

      const response = await api.post<LoginResponse>('token/', payload);
      
      if (response.data.access) {
        localStorage.setItem('token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
      }
      
      return response.data;
    } catch (error) {
      console.error("Erro no login:", error);
      throw error;
    }
  },

  /**
   * Cria um novo usuário no sistema
   */
  async register(credentials: RegisterCredentials): Promise<void> {
    try {
      // Ajuste a rota conforme o seu Django ('register/' ou 'users/')
      await api.post('register/', credentials);
    } catch (error) {
      console.error("Erro no cadastro:", error);
      throw error;
    }
  },

  /**
   * Limpa as credenciais (Logout)
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  },

  /**
   * Verifica se o usuário está logado (para proteção de rotas)
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }
};