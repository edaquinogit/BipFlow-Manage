/**
 * BipFlow: Asset Rendering & Sync Diagnostic
 * Refatorado para alta resiliência e detecção de Race Conditions.
 */

const ASSET_SELECTORS = {
  previewContainer: '[data-cy="product-image-preview"]',
  previewImg: '[data-cy="product-image-preview"] img',
  inventoryTable: 'table',
  activeAssetsHeader: 'ACTIVE ASSETS'
};

describe('BipFlow: Diagnóstico de Sincronização de Imagens', () => {
  const API_URL = Cypress.env('apiUrl') || 'http://127.0.0.1:8000';
  const INVENTORY_ROUTE = '/';

  beforeEach(() => {
    cy.loginViaApi(); // Bypass de auth para focar no teste funcional
    cy.visit(INVENTORY_ROUTE);
  });

  it('Deve validar a renderização física da imagem de preview no modal', () => {
    // 1. Garantir que o container existe (Isso evita o erro de timeout da imagem)
    cy.get(ASSET_SELECTORS.previewContainer, { timeout: 10000 })
      .should('exist')
      .within(() => {
        // 2. Validação aninhada: garante que a tag img foi injetada pelo Vue
        cy.get('img')
          .should('be.visible')
          .should('have.attr', 'src')
          .and('not.be.empty'); // Garante que o bind do Vue já aconteceu
      });

    // 3. Validação de Hard Assertion: Bitwise check (Integridade do binário)
    cy.get(ASSET_SELECTORS.previewImg).should(($img) => {
      const img = $img[0] as HTMLImageElement;
      // Se naturalWidth for 0, o navegador não conseguiu renderizar os pixels (404 ou corrupto)
      expect(img.naturalWidth, 'A imagem de preview está corrompida ou não carregou').to.be.greaterThan(0);
    });
  });

  it('Inspeciona integridade da tabela de Assets e protocolo CORS', () => {
    cy.contains(ASSET_SELECTORS.activeAssetsHeader, { timeout: 15000, matchCase: false })
      .should('be.visible');

    cy.get(`${ASSET_SELECTORS.inventoryTable} img`)
      .should('have.length.at.least', 1)
      .each(($img, index) => {
        const imgName = $img.attr('alt') || `Asset_${index}`;
        
        // Verificação de URL Absoluta (Evita bugs de concatenação relativa no Vite/Vue)
        cy.wrap($img)
          .should('have.attr', 'src')
          .and('match', /^http/, `Falha: Link relativo detectado em [${imgName}]`);

        // Verificação Física
        cy.wrap($img).should(($el) => {
          expect(($el[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
        });
      });
  });

  it('Sanity Check: Endpoint de Mídia Django', () => {
    cy.request({
      url: `${API_URL}/media/`,
      failOnStatusCode: false
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 403, 404], 'Backend Django fora do ar ou rota de mídia inacessível');
    });
  });
});