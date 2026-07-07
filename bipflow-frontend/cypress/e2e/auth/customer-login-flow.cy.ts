/// <reference types="cypress" />
/**
 * BipFlow: Storefront customer login stays in the storefront context
 *
 * Regression coverage for a bug where a 401 on the slug-less customer auth
 * routes (/entrar, /conta, /perfil/criar) fell outside api.ts's
 * isPublicStorefrontPath() allowlist, so the global axios interceptor's
 * handleAuthFailure() hard-redirected the shopper into the ADMIN dashboard's
 * /login instead of keeping them on the storefront's own CustomerLoginView.
 * See docs/architecture/customer-profile-checkout-evolution.md and
 * src/services/api.ts's isPublicStorefrontPath/isAuthCredentialRequest.
 */

describe('Storefront customer login stays in context', () => {
  it('rejects invalid credentials on /entrar without leaving the storefront login', () => {
    cy.visit('/entrar')

    // Never the admin panel's own login component, on the fallback route too.
    cy.contains('Painel administrativo').should('not.exist')

    cy.get('input[type="email"]').type('not-a-real-customer@example.com')
    cy.get('input[type="password"]').type('wrong-password')
    cy.get('button[type="submit"]').click()

    // The historical bug: this used to hard-navigate to /login (admin) here.
    cy.location('pathname', { timeout: 15000 }).should('eq', '/entrar')
    cy.get('[data-cy="login-error"]', { timeout: 15000 })
      .should('exist')
      .invoke('text')
      .should('not.be.empty')

    cy.contains('Painel administrativo').should('not.exist')
  })

  it('redirects an anonymous visit to /conta to the customer login, not the admin login', () => {
    cy.visit('/conta')

    cy.location('pathname', { timeout: 15000 }).should('eq', '/entrar')
    cy.contains('Painel administrativo').should('not.exist')
  })
})
