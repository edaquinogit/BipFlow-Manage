/**
 * 🛰️ BIPFLOW: CUSTOM CYPRESS COMMANDS
 * Pattern: Enterprise JWT Authentication & Session Persistence
 */

// 1. Definição do Comando de Login via API
Cypress.Commands.add('loginViaApi', (userCredentials?) => {
  const apiUrl = Cypress.env('apiUrl') || 'http://127.0.0.1:8000';
  
  // Prioridade: 1. Argumentos | 2. Env Vars | 3. Fallback Teste
  const username = userCredentials?.username || Cypress.env('TEST_USER') || 'adminbipflow@gmail.com';
  const password = userCredentials?.password || Cypress.env('TEST_PASS') || 'adm1234';

  cy.log(`🔐 **BipFlow Auth:** Iniciando handshake com ${apiUrl}`);

  return cy.request({
    method: 'POST',
    url: `${apiUrl}/api/token/`,
    body: { username, password },
    failOnStatusCode: false, // Permitimos falha para tratar o erro com mensagem personalizada
  }).then((response) => {
    // 🛡️ Guard Clause: Validação de Status
    if (response.status !== 200) {
      throw new Error(`🛑 BipFlow Auth Failed: Status ${response.status}. Verifique as credenciais no Django.`);
    }

    // ✅ Validação de Schema JWT
    expect(response.body).to.have.property('access');
    expect(response.body).to.have.property('refresh');

    /**
     * 💾 PERSISTÊNCIA DE SESSÃO
     * IMPORTANTE: Verifique se no seu Frontend (src/services/api.ts) 
     * as chaves são exatamente 'access_token' e 'refresh_token'.
     */
    const { access, refresh } = response.body;
    window.localStorage.setItem('access_token', access);
    window.localStorage.setItem('refresh_token', refresh);
    
    // Injeção opcional em cookies se o seu app usar Cookies + LocalStorage
    cy.setCookie('access_token', access);

    cy.log('🚀 **BipFlow Auth:** JWT Registry Synchronization Complete.');
    
    // Retorna o corpo para caso o teste precise de dados do user
    return cy.wrap(response.body);
  });
});

/**
 * 🏷️ TYPESCRIPT GLOBAL DEFINITIONS
 * Habilita o Autocomplete (IntelliSense) em todo o projeto.
 */
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Realiza autenticação via JWT e injeta os tokens no LocalStorage.
       * @param credentials Opcional: { username, password }
       * @example cy.loginViaApi()
       */
      loginViaApi(credentials?: { username?: string; password?: string }): Chainable<any>;
    }
  }
}

export {};