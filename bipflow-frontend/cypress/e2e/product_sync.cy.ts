/**
 * BipFlow: Asset Rendering & Sync Diagnostic
 * Nível: Produção / End-to-End (E2E)
 * Padrão: Clean Code & Hard Assertions
 */

describe('BipFlow: Diagnóstico de Sincronização de Imagens', () => {
  const API_URL = Cypress.env('apiUrl') || 'http://127.0.0.1:8000';
  
  // ⚠️ ATENÇÃO: Altere esta variável para a rota real onde a sua tabela aparece (ex: '/', '/produtos', '/estoque')
  const INVENTORY_ROUTE = '/'; 

  beforeEach(() => {
    // Autenticação bypass para performance
    cy.loginViaApi();
    cy.visit(INVENTORY_ROUTE); 
  });

  it('Inspeciona a integridade das imagens e valida o protocolo absoluto (CORS)', () => {
    // 1. Sincronização de Estado: Aguarda a tabela renderizar antes de agir
    cy.contains('ACTIVE ASSETS', { timeout: 15000, matchCase: false }).should('be.visible');

    // 2. Varredura Técnica com Hard Assertions
    cy.get('table img', { timeout: 10000 })
      .should('have.length.at.least', 1)
      .each(($img, index) => {
        const src = $img.attr('src');
        const imgName = $img.attr('alt') || `Asset_${index}`;

        // TESTE 1: Validação de Prefixo (O src DEVE ser uma URL absoluta)
        expect(src, `A imagem [${imgName}] deve ter um atributo src válido`).to.not.be.undefined;
        expect(src, `A imagem [${imgName}] deve usar URL absoluta (falha de concatenação no Vue)`).to.match(/^http/);

        // TESTE 2: Validação de Renderização Física (A imagem NÃO DEVE estar quebrada)
        cy.wrap($img).should(($el) => {
          const imgElement = $el[0] as HTMLImageElement;
          expect(imgElement.naturalWidth, `A imagem [${imgName}] quebrou (Erro 404 ou caminho inválido)`).to.be.greaterThan(0);
        });
      });

    // 3. Evidência de Sucesso para o relatório
    cy.screenshot('e2e-product-sync-success');
  });

  it('Valida a disponibilidade do endpoint de mídia no Django', () => {
    // Valida se o servidor Django está de pé e respondendo na porta configurada
    cy.request({
      url: `${API_URL}/media/`,
      failOnStatusCode: false
    }).then((response) => {
      // Nota: No Django, acessar o diretório /media/ direto pode retornar 403 (Forbidden) ou 404, o que é seguro.
      // O importante é garantir que o servidor respondeu à requisição.
      expect(response.status).to.be.oneOf(
        [200, 403, 404], 
        'O Django deve estar ativo e configurado para lidar com rotas de mídia'
      );
    });
  });
});