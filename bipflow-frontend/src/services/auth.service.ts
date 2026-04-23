import api from "./api";
import { Logger } from "./logger";
import { tokenStore } from "./token-store";
import type {
  LoginCredentials,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  VerifyEmailPayload,
  VerifyEmailResponse,
} from "../types/auth";
import {
  isAxiosError,
  buildErrorContext,
  type ApplicationError,
} from "../types/errors";

/**
 * Authentication Service
 *
 * Manages user login, logout, and authentication state.
 * Handles JWT token storage and refresh logic.
 */
export const authService = {
  /**
   * Authenticate user with email and password.
   *
   * Converts email to username format (Django SimpleJWT requirement).
   * Stores access and refresh tokens in localStorage after successful login.
   *
   * @param credentials User login credentials
   * @returns LoginResponse containing access and refresh tokens
   * @throws Error if authentication fails
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const payload = {
        username: credentials.email,
        password: credentials.password,
      };

      const { data } = await api.post<LoginResponse>("auth/token/", payload);

      if (data.access && data.refresh) {
        tokenStore.saveTokens({ access: data.access, refresh: data.refresh });
      }

      Logger.info("User authenticated successfully", {
        email: credentials.email,
      });
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Authentication failed";

      Logger.error("Authentication failed",
        buildErrorContext(error as ApplicationError, {
          email: credentials.email,
          errorMessage,
        })
      );
      throw error;
    }
  },

  /**
   * Register a new user account.
   *
   * The backend creates the account in an inactive state and sends
   * a verification email before allowing login.
   */
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    try {
      const { data } = await api.post<RegisterResponse>("auth/register/", payload);

      Logger.info("User registration submitted successfully", {
        email: payload.email,
      });
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Registration failed";

      Logger.error("Registration failed",
        buildErrorContext(error as ApplicationError, {
          email: payload.email,
          errorMessage,
        })
      );
      throw error;
    }
  },

  /**
   * Verify a user email using the tokenized link payload.
   */
  async verifyEmail(payload: VerifyEmailPayload): Promise<VerifyEmailResponse> {
    try {
      const { data } = await api.post<VerifyEmailResponse>("auth/verify-email/", payload);

      Logger.info("Email verified successfully", {
        hasUid: Boolean(payload.uid),
      });
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Email verification failed";

      Logger.error("Email verification failed",
        buildErrorContext(error as ApplicationError, {
          hasUid: Boolean(payload.uid),
          errorMessage,
        })
      );
      throw error;
    }
  },

  /**
   * Log out the current user.
   *
   * Clears authentication tokens and redirects to login page.
   */
  logout(): void {
    tokenStore.clearTokens();
    sessionStorage.clear();
    Logger.info("User logged out");
    window.location.href = "/login";
  },

  /**
   * Check if user is currently authenticated.
   *
   * @returns True if both access and refresh tokens exist in storage
   */
  isAuthenticated(): boolean {
    return tokenStore.hasTokens();
  },
};
