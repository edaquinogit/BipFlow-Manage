import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // 🌐 NETWORK & HOSTS
    baseUrl: "http://127.0.0.1:5173",
    
    // 📂 ESTRUTURA DE ARQUIVOS (Maturidade de Projeto)
    specPattern: "bipflow-frontend/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    
    // 🎯 O AJUSTE QUE FALTAVA: Mapeia a pasta de assets para o upload
    fixturesFolder: "bipflow-frontend/cypress/fixtures",
    
    // 🔌 CONFIGURAÇÃO DE SUPORTE
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
      storageKey: "access_token",
    },

    setupNodeEvents(on, config) {
      return config;
    },
  },
});