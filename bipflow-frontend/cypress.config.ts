import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    supportFile: "cypress/support/e2e.ts", // Reativado!
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    env: {
      apiUrl: "http://127.0.0.1:8000",
      apiBaseUrl: "http://127.0.0.1:8000/api",
      adminUsername: "admin@example.com",
      adminPassword: "admin123",
    },
  },
});
