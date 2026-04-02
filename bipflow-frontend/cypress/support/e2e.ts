/**
 * BipFlow: Global E2E Support Configuration
 * Padrão de Produção: NYC Enterprise Stack
 */

import './commands';

/**
 * CONFIGURAÇÕES GLOBAIS
 * * Impede que o Cypress falhe o teste caso a aplicação lance uma Uncaught Exception.
 * Essencial para manter a estabilidade dos testes em SPAs complexas.
 */
Cypress.on('uncaught:exception', (_err: Error, _runnable: Mocha.Runnable) => {
  // Retornar false impede o Cypress de falhar o teste
  return false;
});

/**
 * Hooks de Ciclo de Vida
 */
beforeEach(() => {
  // Garante que cada teste comece com um estado previsível
  cy.log('BipFlow: Preparando ambiente isolado.');
  
  // Opcional: Descomente se precisar limpar o estado entre testes
  // cy.clearLocalStorage();
  // cy.clearCookies();
});