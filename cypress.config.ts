import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // 🌐 NETWORK & HOSTS
    baseUrl: "http://127.0.0.1:5173",

    // 📂 FILE STRUCTURE (Project Maturity)
    specPattern: "bipflow-frontend/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",

    // 🎯 CRITICAL ADJUSTMENT: Maps assets folder for upload
    fixturesFolder: "bipflow-frontend/cypress/fixtures",

    // 🔌 SUPPORT CONFIGURATION
    supportFile: "bipflow-frontend/cypress/support/e2e.ts",

    // 🛡️ SECURITY & ASSETS PROTOCOL
    chromeWebSecurity: false,

    // 📹 OUTPUT & DEBUG
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,

    // 🌍 ENVIRONMENT VARIABLES
    env: {
      apiUrl: "http://127.0.0.1:8000",
      apiBaseUrl: "http://127.0.0.1:8000/api",
      adminUsername: "admin@example.com",
      adminPassword: "admin123",
      storageKey: "access_token",
    },

    setupNodeEvents(on, config) {
      return config;
    },
  },
});
