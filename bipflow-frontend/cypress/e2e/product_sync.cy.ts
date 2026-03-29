/**
 * BipFlow: Asset Rendering & Sync Diagnostic
 * Nível: Produção / Debug Avançado
 */

describe('BipFlow: Diagnóstico de Sincronização de Imagens', () => {
  const API_URL = Cypress.env('apiUrl') || 'http://127.0.0.1:8000';

  beforeEach(() => {
    // Utiliza o comando otimizado para ganhar performance no debug
    cy.loginViaApi();
    cy.visit('/dashboard'); 
  });

  it('Inspeciona integridade das imagens e detecta falhas de protocolo', () => {
    // 1. Aguarda a renderização da tabela de ativos
    cy.contains('ACTIVE ASSETS', { timeout: 15000, matchCase: false }).should('be.visible');

    // 2. Intercepta as requisições de mídia para validar o status real do servidor
    cy.intercept('GET', '**/media/products/**').as('mediaRequest');

    // 3. 🎯 VARREDURA TÉCNICA
    cy.get('table img', { timeout: 10000 }).should('have.length.at.least', 1).each(($img, index) => {
      const src = $img.attr('src');
      const imgName = $img.attr('alt') || `Asset_${index}`;

      cy.log(`### 🔍 Analisando: ${imgName} ###`);

      // TESTE 1: Validação de Prefixo (CORS/Absolute URL)
      if (src && !src.startsWith('http')) {
        cy.log('❌ **ERRO DE PROTOCOLO:** URL Relativa detectada. O Vue não está concatenando a API_URL.');
        cy.log(`Path encontrado: ${src}`);
      } else {
        cy.log(`✅ **PROTOCOLO OK:** URL Absoluta detectada: ${src}`);
      }

      // TESTE 2: Validação de Renderização Física
      // Verificamos se o navegador conseguiu carregar as dimensões da imagem
      cy.wrap($img).should(($el) => {
        const imgElement = $el[0] as HTMLImageElement;
        
        if (imgElement.naturalWidth === 0) {
          cy.log(`🚨 **CRITICAL:** Imagem quebrada (404 ou Arquivo Inexistente).`);
        } else {
          cy.log(`🖼️ **RENDER OK:** Dimensões: ${imgElement.naturalWidth}x${imgElement.naturalHeight}px`);
        }
      });
    });

    // 4. Captura técnica para o relatório de bugs
    cy.screenshot('debug-renderizacao-produtos');
  });

  it('Valida se o Django está servindo a pasta /media corretamente', () => {
    // Tenta acessar um endpoint de mídia conhecido para isolar se o problema é o Django ou o Vue
    cy.request({
      url: `${API_URL}/media/`,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 404) {
        cy.log('⚠️ **ALERTA BACKEND:** O Django não parece estar servindo a pasta /media. Verifique o urls.py.');
      }
    });
  });
});