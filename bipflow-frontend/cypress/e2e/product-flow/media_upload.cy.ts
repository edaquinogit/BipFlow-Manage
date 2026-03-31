describe('BipFlow: Gestão de Mídia e Upload', () => {
  
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.loginViaApi().then(() => {
      cy.intercept('GET', '**/api/v1/products/').as('getProducts');
      cy.intercept('GET', '**/api/categories/').as('getCategories');
      cy.intercept('POST', '**/api/v1/products/').as('postProduct'); // intercept correto
      cy.visit('/');
    });
  });

  it('Deve criar produto com imagem e validar renderização física', () => {
    cy.wait(['@getProducts', '@getCategories'], { timeout: 15000 });

    const productName = `Product NYC ${Date.now()}`;

    // 1. Abrir modal de novo produto
    cy.get('[data-cy="btn-add-product"]').should('be.visible').click({ force: true });

    // 2. Preencher campos obrigatórios
    cy.get('input[name="name"]').type(productName);
    cy.get('input[name="price"]').clear().type('45.00');

    // 3. Upload de imagem via fixture
    cy.get('[data-cy="input-product-image"]').selectFile('cypress/fixtures/burger-test.png', {
      force: true,
      action: 'select'
    });

    // 4. Validar preview da imagem
    cy.get('[data-cy="product-image-preview"] img', { timeout: 15000 })
      .should('be.visible')
      .and(($img) => {
        const img = $img[0] as HTMLImageElement;
        expect(img.naturalWidth, 'Imagem deve ter largura real').to.be.gt(0);
      });

    // 5. Garantir persistência no backend
    cy.wait('@postProduct', { timeout: 15000 })
      .its('response.statusCode')
      .should('eq', 201);

    // 6. Confirmar produto na UI
    cy.contains(productName).should('be.visible');

    // 7. Validar imagem na listagem
    cy.get('table img').last()
      .should('exist')
      .and(($img) => {
        const img = $img[0] as HTMLImageElement;
        expect(img.naturalWidth).to.be.gt(0);
      });
  });
});