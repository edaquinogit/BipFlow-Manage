export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}
