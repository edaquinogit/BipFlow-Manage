import api from "./api";
import { Logger } from "./logger";
import type { LoginCredentials, LoginResponse } from "../types/auth";
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

      if (data.access) {
        localStorage.setItem("token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
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
   * Log out the current user.
   *
   * Clears both localStorage and sessionStorage to remove all traces
   * of the session and redirects to login page.
   */
  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    Logger.info("User logged out");
    window.location.href = "/login";
  },

  /**
   * Check if user is currently authenticated.
   *
   * @returns True if access token exists in storage
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem("token");
  },
};
