import api from '@/lib/api'
import type { 
  RequestResetPayload, 
  ConfirmResetPayload, 
  AuthResponse 
} from '@/types/auth'

/**
 * 🔐 BipFlow: Auth Reset Service
 * Camada de abstração para comunicação com o backend Django.
 */

/**
 * Solicita o envio do e-mail de recuperação de senha.
 * @endpoint POST /auth/users/reset_password/ (Padrão Djoser)
 */
export const requestReset = async (payload: RequestResetPayload): Promise<AuthResponse> => {
  // Ajustado para o endpoint real do Django/Djoser
  const { data } = await api.post<AuthResponse>('/auth/users/reset_password/', payload)
  return data
}

/**
 * Confirma a nova senha utilizando o UID e o Token.
 * @endpoint POST /auth/users/reset_password_confirm/
 */
export const confirmReset = async (payload: ConfirmResetPayload): Promise<AuthResponse> => {
  // O Django espera 'new_password' em vez de 'password' em muitas configs
  const formattedPayload = {
    uid: payload.uidb64,
    token: payload.token,
    new_password: payload.password
  }

  const { data } = await api.post<AuthResponse>('/auth/users/reset_password_confirm/', formattedPayload)
  return data
}