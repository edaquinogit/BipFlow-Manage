/// <reference types="cypress" />

type AuthTokens = {
  access: string;
  refresh: string;
};

declare namespace Cypress {
  interface Chainable {
    /**
     * Realiza o login via API para o ecossistema BipFlow.
     */
    loginViaApi(): Chainable<AuthTokens>;

    /**
     * Visita uma rota da SPA injetando os tokens obtidos por loginViaApi.
     */
    visitWithAuth(path?: string): Chainable<AUTWindow>;
  }
}
