describe('BipFlow Production-Ready Test', () => {
  beforeEach(() => {
    // Intercepta para podermos validar se a chamada ocorreu
    cy.intercept('GET', '**/api/v1/products/').as('getProducts');
    
    cy.loginViaApi();
    
    // Visita e garante que o localStorage foi lido
    cy.visit('/dashboard');
    
    // Se a requisição não sair, forçamos um reload para o Vue ler o localStorage injetado
    cy.get('body').then(($body) => {
      cy.wait(500); // Pequena pausa para o ciclo de vida do Vue
    });
  });

  it('deve carregar o dashboard e abrir o formulário', () => {
    // Aguarda a chamada de produtos (que agora DEVE ocorrer)
    cy.wait('@getProducts', { timeout: 15000 });

    // Se o botão não estiver aqui, o problema é o v-if no seu template Vue
    cy.get('[data-cy="btn-add-product"]', { timeout: 10000 })
      .should('be.visible')
      .click();

    // Segue o fluxo de upload...
    cy.get('input[name="name"]').type('Product NYC ' + Date.now());
    cy.get('[data-cy="input-product-image"]')
      .selectFile('cypress/fixtures/burger-test.png', { force: true })
      .trigger('change');
      
    cy.get('[data-cy="product-image-preview"]', { timeout: 10000 }).should('exist');
  });
});
