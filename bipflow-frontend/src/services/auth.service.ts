import api from "./api";
import { Logger } from "./logger";
import { tokenStore } from "./token-store";
import type {
  LoginCredentials,
  LoginResponse,
  CurrentUser,
  ConfirmResetPayload,
  ConfirmResetResponse,
  RegisterPayload,
  RegisterResponse,
  RequestResetPayload,
  RequestResetResponse,
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
   * The backend creates an active account after validating the password.
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
   * Fetch the authenticated user profile used by dashboard personalization.
   */
  async getCurrentUser(): Promise<CurrentUser> {
    const { data } = await api.get<CurrentUser>("auth/me/");
    return data;
  },

  /**
   * Request a secure password reset link by email.
   */
  async requestPasswordReset(payload: RequestResetPayload): Promise<RequestResetResponse> {
    try {
      const { data } = await api.post<RequestResetResponse>("auth/password-reset/", payload);

      Logger.info("Password reset requested", {
        email: payload.email,
      });
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Password reset request failed";

      Logger.error("Password reset request failed",
        buildErrorContext(error as ApplicationError, {
          email: payload.email,
          errorMessage,
        })
      );
      throw error;
    }
  },

  /**
   * Confirm password reset using the secure tokenized email link.
   */
  async confirmPasswordReset(payload: ConfirmResetPayload): Promise<ConfirmResetResponse> {
    try {
      const { data } = await api.post<ConfirmResetResponse>(
        "auth/password-reset/confirm/",
        payload
      );

      Logger.info("Password reset confirmed", {
        hasUid: Boolean(payload.uid),
      });
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Password reset confirmation failed";

      Logger.error("Password reset confirmation failed",
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
