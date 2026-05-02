import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tokenStore } from "../token-store";

describe("tokenStore.saveRefreshedTokens", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persists both tokens when the backend rotates refresh tokens", () => {
    tokenStore.saveTokens({
      access: "old-access",
      refresh: "old-refresh",
    });

    tokenStore.saveRefreshedTokens({
      access: "new-access",
      refresh: "new-refresh",
    });

    expect(tokenStore.getAccessToken()).toBe("new-access");
    expect(tokenStore.getRefreshToken()).toBe("new-refresh");
  });

  it("preserves the current refresh token when rotation is disabled", () => {
    tokenStore.saveTokens({
      access: "old-access",
      refresh: "stable-refresh",
    });

    tokenStore.saveRefreshedTokens({
      access: "new-access",
    });

    expect(tokenStore.getAccessToken()).toBe("new-access");
    expect(tokenStore.getRefreshToken()).toBe("stable-refresh");
  });

  it("rejects refresh responses without an access token", () => {
    tokenStore.saveTokens({
      access: "old-access",
      refresh: "old-refresh",
    });

    expect(() =>
      tokenStore.saveRefreshedTokens({
        access: "",
        refresh: "new-refresh",
      })
    ).toThrow("Invalid token refresh payload: access is required");

    expect(tokenStore.getAccessToken()).toBe("old-access");
    expect(tokenStore.getRefreshToken()).toBe("old-refresh");
  });
});
