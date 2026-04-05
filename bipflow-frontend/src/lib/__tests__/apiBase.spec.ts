import { describe, it, expect } from "vitest";
import {
  deriveBackendOriginForMedia,
  resolveMediaSrcWithOrigin,
  getApiBaseUrl,
  DEFAULT_API_BASE_URL,
} from "../apiBase";

describe("deriveBackendOriginForMedia", () => {
  it("returns default when both env inputs empty", () => {
    expect(deriveBackendOriginForMedia(undefined, undefined)).toBe(
      "http://127.0.0.1:8000",
    );
  });

  it("strips trailing /api from VITE-style API URL", () => {
    expect(
      deriveBackendOriginForMedia("https://nyc.example.com/api/", undefined),
    ).toBe("https://nyc.example.com");
  });

  it("uses explicit backend origin when set", () => {
    expect(
      deriveBackendOriginForMedia(
        "http://ignored/api/",
        "https://cdn.bipflow.example/",
      ),
    ).toBe("https://cdn.bipflow.example");
  });
});

describe("resolveMediaSrcWithOrigin", () => {
  it("joins relative media path", () => {
    expect(
      resolveMediaSrcWithOrigin(
        "/media/products/x.png",
        "http://127.0.0.1:8000",
      ),
    ).toBe("http://127.0.0.1:8000/media/products/x.png");
  });

  it("does not double-prefix absolute URLs", () => {
    const abs = "http://127.0.0.1:8000/media/products/x.png";
    expect(resolveMediaSrcWithOrigin(abs, "http://other")).toBe(abs);
  });

  it("appends cache-bust query", () => {
    expect(
      resolveMediaSrcWithOrigin("/media/a.webp", "http://h", 42),
    ).toBe("http://h/media/a.webp?v=42");
  });
});

describe("getApiBaseUrl", () => {
  it("matches project default when VITE_API_URL unset at build", () => {
    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
  });
});
