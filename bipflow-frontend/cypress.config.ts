import { createHmac } from "node:crypto";
import { defineConfig } from "cypress";

// RFC 4648 base32 decode (pyotp secrets use this alphabet, no padding).
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const char of cleaned) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// RFC 6238 TOTP, matching pyotp's defaults (SHA1, 30s step, 6 digits) --
// used only so Cypress can compute a valid code from the secret the setup
// flow renders on screen, without a JS TOTP dependency.
function generateTotpCode(secret: string, stepSeconds = 30, digits = 6): string {
  const counter = Math.floor(Date.now() / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    supportFile: "cypress/support/e2e.ts", // Reativado!
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    setupNodeEvents(on) {
      on("task", {
        generateTotpCode(secret: string) {
          return generateTotpCode(secret);
        },
      });
    },
    env: {
      // Must match baseUrl's hostname (localhost): the refresh_token cookie
      // is SameSite=Strict, and browsers treat localhost/127.0.0.1 as
      // different sites, so a mismatch here silently drops the cookie.
      apiUrl: "http://localhost:8000",
      apiBaseUrl: "http://localhost:8000/api",
      adminUsername: "admin@example.com",
      adminPassword: "admin123",
    },
  },
});
