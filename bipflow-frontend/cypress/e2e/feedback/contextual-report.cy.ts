/// <reference types="cypress" />
/**
 * BipFlow: Contextual "Relatar problema" from a real error state
 *
 * Flow 2 from the feedback evolution plan: simulate the one persistent,
 * real error state the catalog already has (ProductsView's "Erro ao
 * carregar produtos" + [Tentar novamente]) and confirm [Relatar problema]
 * opens the feedback dialog already contextualized -- type pre-set to
 * "problem", no page reload, no extra typing required from the customer.
 */

function waitForWelcomeSplashToClear(): void {
  cy.get('[aria-modal="true"][aria-label="Seja bem-vindo a Boutique Fitness"]', { timeout: 10000 })
    .should('not.exist')
}

describe('Contextual feedback from a catalog error', () => {
  it('shows Relatar problema next to Tentar novamente, and opens the dialog pre-filled', () => {
    cy.intercept('GET', '**/api/v1/products/**', {
      statusCode: 500,
      headers: { 'x-request-id': 'req-cypress-test-1' },
      body: { error: 'INTERNAL_SERVER_ERROR', message: 'Erro interno do servidor.', request_id: 'req-cypress-test-1' },
    }).as('productsFailed')

    cy.visit('/l/default/produtos')
    waitForWelcomeSplashToClear()
    cy.wait('@productsFailed')

    cy.contains('Erro ao carregar produtos').should('be.visible')
    cy.contains('button', 'Tentar novamente').should('be.visible')
    cy.contains('button', 'Relatar problema').should('be.visible').click()

    cy.get('[data-cy="feedback-dialog"]').should('be.visible')
    cy.get('[data-cy="feedback-type-select"]').should('have.value', 'problem')
    // The customer never has to explain what the system already knows.
    cy.get('[data-cy="feedback-message-input"]').should('have.value', '')
  })
})
