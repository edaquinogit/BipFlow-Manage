/// <reference types="cypress" />
/**
 * BipFlow: Customer feedback -- happy path submission
 *
 * Flow 1 from the feedback evolution plan: open the vitrine, open the
 * discreet feedback dialog via the footer trigger, pick a type, write a
 * message, send, and confirm the success state. Hits the real backend
 * (default store), same style as customer-profile/checkout-flow.cy.ts.
 */

function waitForWelcomeSplashToClear(): void {
  cy.get('[aria-modal="true"][aria-label="Seja bem-vindo a Boutique Fitness"]', { timeout: 10000 })
    .should('not.exist')
}

describe('Storefront feedback submission', () => {
  it('opens the feedback dialog from the footer trigger and submits successfully', () => {
    cy.visit('/l/default/produtos')
    waitForWelcomeSplashToClear()

    cy.get('[data-cy="feedback-trigger"]', { timeout: 15000 }).scrollIntoView().click()
    cy.get('[data-cy="feedback-dialog"]').should('be.visible')

    cy.get('[data-cy="feedback-type-select"]').select('Entrega/Frete')
    cy.get('[data-cy="feedback-message-input"]').type(
      'Nao consegui calcular o frete para o meu endereco.'
    )

    cy.intercept('POST', '**/api/v1/feedback/').as('submitFeedback')
    cy.get('[data-cy="feedback-submit-button"]').click()

    cy.wait('@submitFeedback').then(({ response }) => {
      expect(response?.statusCode).to.eq(201)
    })

    cy.get('[data-cy="feedback-success"]').should('be.visible')
    cy.contains('Obrigado! Recebemos seu feedback.').should('be.visible')
  })

  it('keeps the dialog closed and unobtrusive until the trigger is used', () => {
    cy.visit('/l/default/produtos')
    waitForWelcomeSplashToClear()

    // The interface must not pop the dialog on its own -- only an explicit
    // click on the discreet trigger opens it.
    cy.get('[data-cy="feedback-dialog"]').should('not.exist')
    cy.get('[data-cy="feedback-trigger"]').should('be.visible').and('contain.text', 'Fale com a gente')
  })
})
