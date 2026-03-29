/**
 * BipFlow: Global E2E Support Configuration
 * Este arquivo é carregado automaticamente antes de cada arquivo de teste.
 */

// 1. Importa os comandos customizados (onde está o seu loginViaApi)
import './commands';

// 2. Importa plugins de terceiros (Ex: para upload de arquivos ou XPath)
// import '@cypress/code-coverage/support';

/**
 * CONFIGURAÇÕES GLOBAIS
 */

// Impede que o Cypress falhe o teste caso a sua aplicação Vue lance um erro não tratado (Uncaught Exception).
// Isso é comum em ambientes de desenvolvimento e evita que o teste quebre por bobeira do frontend.
Cypress.on('uncaught:exception', (err, runnable) => {
  // Retornar false impede o Cypress de falhar o teste
  return false;
});

// Hook global (Opcional): Limpa o localStorage antes de cada teste para garantir isolamento total
beforeEach(() => {
  cy.log('BipFlow: Iniciando ambiente limpo para o teste.');
  // cy.clearLocalStorage(); 
});