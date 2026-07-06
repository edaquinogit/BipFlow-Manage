/// <reference types="cypress" />
/**
 * BipFlow: Storefront customer profile + gated checkout
 * (docs/architecture/customer-profile-checkout-evolution.md)
 *
 * Drives the real flow end-to-end against the live dev server: browse the
 * storefront -> add a product to cart -> try to finalize without being
 * logged in -> get redirected to create a profile -> create it -> land back
 * on the storefront with the cart intact, now authenticated -> finalize ->
 * a real SaleOrder is created from the profile's data (never re-typed).
 */

describe('Storefront customer profile + gated checkout', () => {
  it('requires a profile before finalizing, then checks out using the profile data', () => {
    cy.visit('/l/default/produtos')

    cy.get('[data-cy="add-to-cart-button"]:not([disabled])', { timeout: 15000 })
      .first()
      .click()

    cy.get('[data-cy="open-cart-button"]').click()
    cy.get('[data-cy="checkout-submit-button"]').click()

    // Not logged in: the gate redirects to create-profile instead of
    // reaching the checkout API at all.
    cy.location('pathname', { timeout: 10000 }).should('include', '/perfil/criar')

    const email = `cliente.cypress.${Date.now()}@example.com`

    cy.get('input[autocomplete="name"]').type('Cliente Cypress')
    cy.get('input[autocomplete="tel"]').type('11999990000')
    cy.get('input[type="email"]').type(email)
    // Delivery defaults to "Receber em casa" in the cart, so a complete
    // address on the profile is required for checkout to succeed below.
    cy.get('input[autocomplete="street-address"]').type('Rua Cypress, 100')
    cy.get('input[autocomplete="address-level3"]').type('Bairro Teste')
    cy.get('input[autocomplete="address-level2"]').type('Cidade Teste')
    cy.get('input[autocomplete="new-password"]').eq(0).type('SenhaForte123')
    cy.get('input[autocomplete="new-password"]').eq(1).type('SenhaForte123')
    cy.contains('button', 'Criar perfil').click()

    // Registration + auto-login + redirect back to where checkout was
    // attempted, cart still intact (localStorage-backed, never cleared).
    cy.location('pathname', { timeout: 15000 }).should('eq', '/l/default/produtos')
    cy.get('[data-cy="open-cart-button"]').should('contain.text', '1 item')

    // The icon now links straight to the account page instead of showing
    // the Entrar/Criar perfil menu -- proof the session carried over.
    cy.get('[aria-label="Minha conta"]', { timeout: 10000 }).should('exist')

    cy.intercept('POST', '**/api/v1/checkout/whatsapp/').as('checkout')

    cy.get('[data-cy="open-cart-button"]').click()
    cy.get('[data-cy="checkout-submit-button"]').should('be.enabled').click()

    cy.wait('@checkout').then(({ response }) => {
      expect(response?.statusCode).to.eq(200)
      expect(response?.body.customer.full_name).to.eq('Cliente Cypress')
      expect(response?.body.customer.phone).to.eq('11999990000')
      expect(response?.body.customer.address).to.eq('Rua Cypress, 100')
      expect(response?.body.customer.neighborhood).to.eq('Bairro Teste')
      expect(response?.body.customer.city).to.eq('Cidade Teste')
      expect(response?.body.whatsapp_url).to.match(/^https:\/\/wa\.me\//)
    })
  })
})
