import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api";
import { tokenStore } from "../token-store";

type RetriableConfig = {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  _retry?: boolean;
  _retriedAfterTimeout?: boolean;
  timeout?: number;
};

type RejectedInterceptor = (error: {
  response?: { status: number };
  config: RetriableConfig;
}) => Promise<unknown>;

const axiosMocks = vi.hoisted(() => {
  let createCallCount = 0;
  const requestUse = vi.fn();
  const responseUse = vi.fn();
  const apiInstance = Object.assign(
    vi.fn((config: unknown) => Promise.resolve({ config })),
    {
      interceptors: {
        request: { use: requestUse },
        response: { use: responseUse },
      },
    }
  );
  const refreshPost = vi.fn();
  const refreshInstance = { post: refreshPost };
  const create = vi.fn(() => {
    createCallCount += 1;
    return createCallCount === 1 ? apiInstance : refreshInstance;
  });

  return {
    apiInstance,
    create,
    refreshPost,
    responseUse,
  };
});

vi.mock("axios", () => ({
  default: {
    create: axiosMocks.create,
  },
}));

function getRejectedInterceptor(): RejectedInterceptor {
  const handlers = axiosMocks.responseUse.mock.calls[0];

  if (!handlers?.[1]) {
    throw new Error("Response interceptor was not registered");
  }

  return handlers[1] as RejectedInterceptor;
}

function unauthorizedError(config: RetriableConfig) {
  return {
    response: { status: 401 },
    config,
  };
}

function timeoutError(config: RetriableConfig) {
  // A real axios timeout has no `response` at all (the request never got a
  // reply), and is identified by `code === "ECONNABORTED"`.
  return {
    code: "ECONNABORTED",
    config,
  };
}

// Declared before "API token refresh interceptor" deliberately: that describe
// block's "refresh call itself fails" test sets api.ts's module-level
// isAuthFailureInProgress flag, which only clears via a real 1000ms
// setTimeout (not test-controllable) -- a 401 test placed after it in the
// same file would silently observe the flag still true and skip the
// refresh-attempt branch entirely, producing a false failure unrelated to
// the behavior under test.
describe("API auth-credential 401 handling", () => {
  beforeEach(() => {
    tokenStore.clearAccessToken();
    axiosMocks.apiInstance.mockClear();
    axiosMocks.refreshPost.mockReset();
  });

  it("does not attempt a token refresh for a rejected login attempt", async () => {
    // A wrong-password 401 on auth/token/ is the actual answer, not a sign
    // of an expired session -- attempting a refresh here (which would also
    // fail, since there's no session) used to trigger the hard redirect to
    // the wrong login page. See isAuthCredentialRequest in ../api.ts.
    const originalRequest: RetriableConfig = {
      method: "post",
      url: "auth/token/",
      headers: {},
    };

    await expect(
      getRejectedInterceptor()(unauthorizedError(originalRequest))
    ).rejects.toBeDefined();

    expect(axiosMocks.refreshPost).not.toHaveBeenCalled();
    expect(axiosMocks.apiInstance).not.toHaveBeenCalled();
  });

  it("does not attempt a token refresh for a rejected MFA verification", async () => {
    const originalRequest: RetriableConfig = {
      method: "post",
      url: "auth/mfa/verify/",
      headers: {},
    };

    await expect(
      getRejectedInterceptor()(unauthorizedError(originalRequest))
    ).rejects.toBeDefined();

    expect(axiosMocks.refreshPost).not.toHaveBeenCalled();
  });

  it("still attempts a token refresh for a 401 on a regular authenticated endpoint", async () => {
    tokenStore.setAccessToken("expired-access");
    axiosMocks.refreshPost.mockResolvedValue({ data: { access: "new-access" } });

    const originalRequest: RetriableConfig = {
      method: "get",
      url: "v1/orders/",
      headers: {},
    };

    await getRejectedInterceptor()(unauthorizedError(originalRequest));

    expect(axiosMocks.refreshPost).toHaveBeenCalledTimes(1);
  });
});

describe("API token refresh interceptor", () => {
  beforeEach(() => {
    tokenStore.clearAccessToken();
    axiosMocks.apiInstance.mockClear();
    axiosMocks.refreshPost.mockReset();
  });

  it("persists the refreshed access token before retrying the original request", async () => {
    expect(api).toBe(axiosMocks.apiInstance);

    tokenStore.setAccessToken("expired-access");
    axiosMocks.refreshPost.mockResolvedValue({
      data: { access: "new-access" },
    });

    const originalRequest: RetriableConfig = {
      method: "get",
      url: "v1/orders/",
      headers: {},
    };

    await getRejectedInterceptor()(unauthorizedError(originalRequest));

    // The refresh token rides the httpOnly cookie automatically (withCredentials),
    // never an explicit body field.
    expect(axiosMocks.refreshPost).toHaveBeenCalledWith("auth/token/refresh/");
    expect(tokenStore.getAccessToken()).toBe("new-access");
    expect(originalRequest.headers?.Authorization).toBe("Bearer new-access");
    expect(axiosMocks.apiInstance).toHaveBeenCalledWith(originalRequest);
  });

  it("shares a single refresh request across simultaneous 401 responses", async () => {
    tokenStore.setAccessToken("expired-access");

    let resolveRefresh: (value: { data: { access: string } }) => void = () => undefined;
    const refreshPromise = new Promise<{ data: { access: string } }>((resolve) => {
      resolveRefresh = resolve;
    });
    axiosMocks.refreshPost.mockReturnValue(refreshPromise);

    const firstRequest: RetriableConfig = {
      method: "get",
      url: "v1/orders/",
      headers: {},
    };
    const secondRequest: RetriableConfig = {
      method: "get",
      url: "v1/products/",
      headers: {},
    };
    const rejectedInterceptor = getRejectedInterceptor();

    const firstRetry = rejectedInterceptor(unauthorizedError(firstRequest));
    const secondRetry = rejectedInterceptor(unauthorizedError(secondRequest));

    expect(axiosMocks.refreshPost).toHaveBeenCalledTimes(1);

    resolveRefresh({ data: { access: "shared-access" } });

    await Promise.all([firstRetry, secondRetry]);

    expect(tokenStore.getAccessToken()).toBe("shared-access");
    expect(firstRequest.headers?.Authorization).toBe("Bearer shared-access");
    expect(secondRequest.headers?.Authorization).toBe("Bearer shared-access");
    expect(axiosMocks.apiInstance).toHaveBeenCalledTimes(2);
  });

  it("clears the access token and rejects when the refresh call itself fails", async () => {
    tokenStore.setAccessToken("expired-access");
    axiosMocks.refreshPost.mockRejectedValue(new Error("refresh failed"));

    const originalRequest: RetriableConfig = {
      method: "get",
      url: "v1/orders/",
      headers: {},
    };

    await expect(
      getRejectedInterceptor()(unauthorizedError(originalRequest))
    ).rejects.toThrow("refresh failed");

    expect(tokenStore.getAccessToken()).toBeNull();
  });
});

describe("API cold-start retry interceptor", () => {
  beforeEach(() => {
    axiosMocks.apiInstance.mockClear();
  });

  it("retries a timed-out GET once with a longer timeout", async () => {
    const originalRequest: RetriableConfig = {
      method: "get",
      url: "v1/products/",
    };

    await getRejectedInterceptor()(timeoutError(originalRequest));

    expect(axiosMocks.apiInstance).toHaveBeenCalledTimes(1);
    expect(axiosMocks.apiInstance).toHaveBeenCalledWith(originalRequest);
    expect(originalRequest._retriedAfterTimeout).toBe(true);
    expect(originalRequest.timeout).toBe(45000);
  });

  it("does not retry a GET a second time (no infinite retry loop)", async () => {
    const originalRequest: RetriableConfig = {
      method: "get",
      url: "v1/products/",
      _retriedAfterTimeout: true,
    };

    await expect(
      getRejectedInterceptor()(timeoutError(originalRequest))
    ).rejects.toBeDefined();

    expect(axiosMocks.apiInstance).not.toHaveBeenCalled();
  });

  it("never retries a timed-out POST -- the original request may have already completed server-side", async () => {
    const originalRequest: RetriableConfig = {
      method: "post",
      url: "v1/products/",
    };

    await expect(
      getRejectedInterceptor()(timeoutError(originalRequest))
    ).rejects.toBeDefined();

    expect(axiosMocks.apiInstance).not.toHaveBeenCalled();
  });
});
