/**
 * 🔐 BipFlow Authentication Types
 * Centraliza os contratos de dados para o módulo de segurança.
 * Padrão: Clean Code, Strict Typing & Immutability.
 */

/**
 * Payload para solicitação inicial de recuperação de senha.
 */
export interface RequestResetPayload {
  readonly email: string;
}

/**
 * Payload para confirmação e definição da nova senha.
 * @description O Django (SimpleJWT/Djoser) exige o UID para identificar o usuário.
 * Usamos 'new_password' para alinhar com o contrato padrão do Djoser/Django.
 */
export interface ConfirmResetPayload {
  readonly uid: string;          // O Django espera 'uid' no payload de confirmação
  readonly token: string;
  readonly new_password: string; // Alinhado ao backend para evitar mapeamentos extras
}

/**
 * Definição do estado de sessão do usuário.
 */
export interface UserSession {
  readonly access: string;
  readonly refresh: string;
  readonly user: Readonly<{
    id: number;
    username: string;
    email: string;
    role?: 'admin' | 'staff' | 'user'; // Enum-like string para segurança de tipos
  }>;
}

/**
 * Estrutura de erro detalhada do Django Rest Framework.
 * @description Captura erros de validação por campo (ex: { email: ["inválido"] }).
 */
export interface ApiValidationError {
  readonly [key: string]: string[] | string | undefined;
}

/**
 * Resposta genérica de API para ações de sucesso ou erro global.
 */
export interface AuthResponse {
  readonly message?: string;
  readonly detail?: string;
  readonly status?: number;
  readonly errors?: ApiValidationError;
}