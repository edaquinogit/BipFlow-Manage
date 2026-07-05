import { describe, it, expect } from "vitest";
import { extractPublicCodeFromScan } from "../pdvScan";

describe("extractPublicCodeFromScan", () => {
  it("extracts the public_code from a full deep-link URL", () => {
    expect(
      extractPublicCodeFromScan("https://app.bipflow.com/l/minha-loja/p/ABC123XYZ")
    ).toBe("ABC123XYZ");
  });

  it("extracts the public_code when the URL has a trailing slash", () => {
    expect(
      extractPublicCodeFromScan("https://app.bipflow.com/l/minha-loja/p/ABC123XYZ/")
    ).toBe("ABC123XYZ");
  });

  it("works regardless of host/protocol (dev, LAN, prod)", () => {
    expect(extractPublicCodeFromScan("http://127.0.0.1:5173/l/loja-x/p/CODE1")).toBe(
      "CODE1"
    );
  });

  it("strips a trailing query string or fragment after the code", () => {
    expect(
      extractPublicCodeFromScan("https://app.bipflow.com/l/minha-loja/p/ABC123?utm=qr")
    ).toBe("ABC123");
    expect(
      extractPublicCodeFromScan("https://app.bipflow.com/l/minha-loja/p/ABC123#top")
    ).toBe("ABC123");
  });

  it("returns a bare code unchanged (trimmed) -- manual typing / HID scanner behavior", () => {
    expect(extractPublicCodeFromScan("ABC123XYZ")).toBe("ABC123XYZ");
    expect(extractPublicCodeFromScan("  abc123xyz  ")).toBe("abc123xyz");
  });

  it("returns an empty string unchanged", () => {
    expect(extractPublicCodeFromScan("")).toBe("");
    expect(extractPublicCodeFromScan("   ")).toBe("");
  });

  it("returns garbage input unchanged when it doesn't match the deep-link shape", () => {
    expect(extractPublicCodeFromScan("not a url at all")).toBe("not a url at all");
    expect(extractPublicCodeFromScan("https://example.com/other/path")).toBe(
      "https://example.com/other/path"
    );
  });
});
