export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RequestResetPayload {
  email: string;
}

export interface ConfirmResetPayload {
  uidb64: string;
  token: string;
  password: string;
}

export interface ApiErrorResponse {
  detail?: string;
  message?: string;
  [key: string]: string | string[] | undefined;
}

export interface ApiError {
  response?: {
    status?: number;
    data?: ApiErrorResponse;
  };
}
