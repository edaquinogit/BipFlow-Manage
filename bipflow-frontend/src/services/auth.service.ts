import api from './api'
import type { LoginCredentials, LoginResponse } from '../types/auth'

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // O segredo de NY: Mapear o 'email' do formulário para o 'username' do Django
    const payload = {
      username: credentials.email, 
      password: credentials.password
    }

    const { data } = await api.post<LoginResponse>('/token/', payload)
    return data
  },

  logout() {
    // Remove o token de acesso e qualquer outra info do utilizador
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Caso guardes info do user
    
    // Opcional: Redirecionar via window para garantir que o estado do app seja resetado
    window.location.href = '/login';
  }
}