import api from "./api";
import { Logger } from "./logger";
import { tokenStore } from "./token-store";
import { clearAllPersistedCartCustomerData } from "../composables/useCart";
import type {
  LoginCredentials,
  LoginResult,
  CurrentUser,
  ConfirmResetPayload,
  ConfirmResetResponse,
  MfaDisablePayload,
  MfaSetupConfirmResponse,
  MfaSetupResponse,
  MfaVerifyPayload,
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
   * The backend sets the refresh token as an httpOnly cookie; only the
   * access token comes back in the body, and it's kept in memory only.
   *
   * @param credentials User login credentials
   * @returns Either the access token, or an MFA challenge to complete via verifyMfa()
   * @throws Error if authentication fails
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      const payload = {
        username: credentials.email,
        password: credentials.password,
        remember_me: Boolean(credentials.remember_me),
        ...(credentials.captcha_token ? { captcha_token: credentials.captcha_token } : {}),
      };

      const { data } = await api.post<LoginResult>("auth/token/", payload);

      if ("access" in data && data.access) {
        tokenStore.setAccessToken(data.access);
      }

      Logger.info("User authenticated successfully");
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Authentication failed";

      Logger.error("Authentication failed",
        buildErrorContext(error as ApplicationError, {
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

      Logger.info("User registration submitted successfully");
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Registration failed";

      Logger.error("Registration failed",
        buildErrorContext(error as ApplicationError, {
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

      Logger.info("Password reset requested");
      return data;
    } catch (error: unknown) {
      const errorMessage = isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : error instanceof Error
        ? error.message
        : "Password reset request failed";

      Logger.error("Password reset request failed",
        buildErrorContext(error as ApplicationError, {
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
   * Best-effort revokes the refresh cookie on the backend (sent
   * automatically via withCredentials), then always clears the in-memory
   * access token and redirects, even if the revocation call fails (offline,
   * already-expired access token, etc.) so the user is never stuck logged in.
   */
  async logout(redirectTo = "/login"): Promise<void> {
    try {
      await api.post("auth/logout/");
    } catch (error) {
      Logger.warn("Failed to revoke refresh token on logout",
        buildErrorContext(error as ApplicationError)
      );
    }

    tokenStore.clearAccessToken();
    sessionStorage.clear();
    clearAllPersistedCartCustomerData();
    Logger.info("User logged out");
    window.location.href = redirectTo;
  },

  /**
   * Revoke every outstanding refresh token for this user, then log out
   * locally the same way `logout()` does -- the current session is also
   * invalidated by this call, it isn't exempted.
   */
  async logoutAllDevices(): Promise<{ message: string; revoked_count: number }> {
    const { data } = await api.post<{ message: string; revoked_count: number }>("auth/logout-all/");

    tokenStore.clearAccessToken();
    sessionStorage.clear();
    clearAllPersistedCartCustomerData();
    Logger.info("User logged out from all devices");
    window.location.href = "/login";

    return data;
  },

  /**
   * Complete a login that returned an MFA challenge, exchanging the
   * mfa_token + a TOTP code (or a backup code) for real tokens.
   */
  async verifyMfa(payload: MfaVerifyPayload): Promise<void> {
    const { data } = await api.post<{ access: string }>("auth/mfa/verify/", payload);
    tokenStore.setAccessToken(data.access);
    Logger.info("MFA challenge completed successfully");
  },

  /**
   * Start MFA setup: generates a new (unconfirmed) TOTP secret + QR code
   * for the current user. Calling it again before confirming replaces the
   * pending secret; it refuses to run if MFA is already confirmed.
   */
  async setupMfa(): Promise<MfaSetupResponse> {
    const { data } = await api.post<MfaSetupResponse>("auth/mfa/setup/");
    return data;
  },

  /**
   * Confirm a pending MFA setup with a live code from the authenticator
   * app, activating MFA and returning one-time backup codes.
   */
  async confirmMfaSetup(code: string): Promise<MfaSetupConfirmResponse> {
    const { data } = await api.post<MfaSetupConfirmResponse>("auth/mfa/setup/confirm/", { code });
    return data;
  },

  /**
   * Disable MFA for the current user. Requires re-entering the password
   * and, when a device is already confirmed, a live TOTP/backup code too.
   */
  async disableMfa(payload: MfaDisablePayload): Promise<void> {
    await api.post("auth/mfa/disable/", payload);
  },

  /**
   * Check if user is currently authenticated.
   *
   * Synchronous, in-memory check only -- callers that run before the app's
   * auth boot sequence (see services/api.ts's `ensureAuthBooted`) has had a
   * chance to silently refresh from the httpOnly cookie will see a false
   * negative even if the user has a valid session.
   *
   * @returns True if an access token is currently held in memory
   */
  isAuthenticated(): boolean {
    return tokenStore.hasAccessToken();
  },
};
