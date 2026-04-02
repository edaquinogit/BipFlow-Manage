/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Realiza o login via API para o ecossistema BipFlow.
     */
    loginViaApi(): Chainable<void>;
  }
}
