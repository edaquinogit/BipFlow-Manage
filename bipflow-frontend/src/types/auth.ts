export interface LoginCredentials { email: string; password: string; }
export interface LoginResponse { access: string; refresh: string; }
export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
}
export interface RegisterPayload { email: string; password: string; confirm_password: string; }
export interface RegisterResponse { message: string; email: string; }
export interface RequestResetPayload { email: string; }
export interface RequestResetResponse { message: string; email: string; }
export interface ConfirmResetPayload { uid: string; token: string; password: string; confirm_password: string; }
export interface ConfirmResetResponse { message: string; email: string; }
export interface ApiError { response?: { status?: number; data?: { detail?: string; message?: string; [key: string]: any; }; }; }
