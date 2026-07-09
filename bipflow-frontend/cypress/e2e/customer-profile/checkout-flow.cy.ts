/// <reference types="cypress" />
/**
 * BipFlow: Storefront checkout -- guest by default, profile as convenience
 *
 * Guest checkout reinstated (partial reversal of
 * docs/architecture/customer-profile-checkout-evolution.md's mandatory
 * account requirement): finalizing a WhatsApp order never requires an
 * account. A logged-in customer with a saved profile still gets identity/
 * address prefilled from it -- and specifically for address, only when the
 * profile actually has one; an account with no address falls back to the
 * same inline fields a guest would use.
 */

// The entry welcome splash (IntroSplash.vue) is a full-screen `fixed inset-0
// z-50` overlay that blocks every interaction underneath it until its own
// typing animation + fade-out finishes (a few seconds) -- waiting for it to
// leave the DOM is the real precondition for anything below, not a timing
// hack around it.
function waitForWelcomeSplashToClear(): void {
  cy.get('[aria-modal="true"][aria-label="Seja bem-vindo a Boutique Fitness"]', { timeout: 10000 })
    .should('not.exist')
}

// window.open: the app calls it with the real wa.me URL on success, and
// Electron headless has no whatsapp:// handler to hand that off to --
// letting the real navigation happen crashes the test with ERR_ABORTED,
// unrelated to whether checkout itself worked. .returns({}): the app
// treats a falsy return as "popup blocked" and falls back to a real
// window.location.href navigation -- a bare stub returns undefined by
// default, which would trigger that fallback and navigate the test itself
// away from the page.
function stubWindowOpen(): void {
  cy.window().then((win) => cy.stub(win, 'open').returns({}).as('windowOpen'))
}

describe('Storefront checkout', () => {
  it('finalizes as a guest, with no account and no redirect', () => {
    // Unique per run: CheckoutCustomerThrottle now correctly keys anonymous
    // attempts by submitted phone (the whole point of this evolution's
    // throttle fix) -- a fixed phone number would 429 on repeat local runs.
    const phone = `119${Date.now().toString().slice(-8)}`

    cy.visit('/l/default/produtos')
    waitForWelcomeSplashToClear()

    cy.get('[data-cy="add-to-cart-button"]:not([disabled])', { timeout: 15000 })
      .first()
      .click()

    cy.get('[data-cy="open-cart-button"]').click()

    // Delivery defaults to "Receber em casa", so a full address is needed too.
    cy.get('input[autocomplete="name"]').type('Convidado Cypress')
    cy.get('input[autocomplete="tel"]').type(phone)
    cy.get('input[autocomplete="street-address"]').type('Rua Convidado, 50')
    cy.get('input[autocomplete="address-level3"]').type('Bairro Convidado')
    cy.get('input[autocomplete="address-level2"]').type('Cidade Convidado')

    stubWindowOpen()

    cy.intercept('POST', '**/api/v1/checkout/whatsapp/').as('checkout')
    cy.get('[data-cy="checkout-submit-button"]').should('be.enabled').click()

    cy.wait('@checkout').then(({ response }) => {
      expect(response?.statusCode).to.eq(200)
      expect(response?.body.customer.full_name).to.eq('Convidado Cypress')
      expect(response?.body.customer.phone).to.eq(phone)
      expect(response?.body.customer.address).to.eq('Rua Convidado, 50')
      expect(response?.body.whatsapp_url).to.match(/^https:\/\/wa\.me\//)
    })
    cy.get('@windowOpen').should('have.been.calledOnce')

    // No account exists, no gate to redirect through -- still on the storefront.
    cy.location('pathname').should('eq', '/l/default/produtos')
  })

  it('prefills identity and address from a complete profile, hiding the guest fields', () => {
    cy.visit('/l/default/perfil/criar')

    const email = `cliente.completo.${Date.now()}@example.com`
    cy.get('input[autocomplete="name"]').type('Cliente Perfil Completo')
    cy.get('input[autocomplete="tel"]').type('11988887777')
    cy.get('input[type="email"]').type(email)
    cy.get('input[autocomplete="street-address"]').type('Rua Perfil, 10')
    cy.get('input[autocomplete="address-level3"]').type('Bairro Perfil')
    cy.get('input[autocomplete="address-level2"]').type('Cidade Perfil')
    cy.get('input[autocomplete="new-password"]').eq(0).type('SenhaForte123')
    cy.get('input[autocomplete="new-password"]').eq(1).type('SenhaForte123')
    cy.contains('button', 'Criar perfil').click()

    cy.location('pathname', { timeout: 15000 }).should('eq', '/l/default/produtos')
    cy.get('[aria-label="Minha conta"]', { timeout: 10000 }).should('exist')
    waitForWelcomeSplashToClear()

    cy.get('[data-cy="add-to-cart-button"]:not([disabled])', { timeout: 15000 })
      .first()
      .click()
    cy.get('[data-cy="open-cart-button"]').click()

    // Profile has a complete address: no guest fields, just the hint.
    cy.get('input[autocomplete="name"]').should('not.exist')
    cy.get('input[autocomplete="street-address"]').should('not.exist')
    cy.contains('Entregamos no endereço salvo no seu perfil.').should('exist')

    stubWindowOpen()

    cy.intercept('POST', '**/api/v1/checkout/whatsapp/').as('checkout')
    cy.get('[data-cy="checkout-submit-button"]').should('be.enabled').click()

    cy.wait('@checkout').then(({ response }) => {
      expect(response?.statusCode).to.eq(200)
      expect(response?.body.customer.full_name).to.eq('Cliente Perfil Completo')
      expect(response?.body.customer.address).to.eq('Rua Perfil, 10')
    })
    cy.get('@windowOpen').should('have.been.calledOnce')
  })

  it('hides identity but still asks for an address when the profile has none saved', () => {
    cy.visit('/l/default/perfil/criar')

    const email = `cliente.sem.endereco.${Date.now()}@example.com`
    cy.get('input[autocomplete="name"]').type('Cliente Sem Endereco')
    cy.get('input[autocomplete="tel"]').type('11977776666')
    cy.get('input[type="email"]').type(email)
    // Address left blank on purpose -- it is not required to create a profile.
    cy.get('input[autocomplete="new-password"]').eq(0).type('SenhaForte123')
    cy.get('input[autocomplete="new-password"]').eq(1).type('SenhaForte123')
    cy.contains('button', 'Criar perfil').click()

    cy.location('pathname', { timeout: 15000 }).should('eq', '/l/default/produtos')
    cy.get('[aria-label="Minha conta"]', { timeout: 10000 }).should('exist')
    waitForWelcomeSplashToClear()

    cy.get('[data-cy="add-to-cart-button"]:not([disabled])', { timeout: 15000 })
      .first()
      .click()
    cy.get('[data-cy="open-cart-button"]').click()

    // Identity comes from the profile (hidden); address does not exist there,
    // so it still needs to be typed -- same fields a guest would see.
    cy.get('input[autocomplete="name"]').should('not.exist')
    cy.get('input[autocomplete="street-address"]').should('exist')
    cy.get('[data-cy="checkout-submit-button"]').should('be.disabled')

    cy.get('input[autocomplete="street-address"]').type('Rua Avulsa, 5')
    cy.get('input[autocomplete="address-level3"]').type('Bairro Avulso')
    cy.get('input[autocomplete="address-level2"]').type('Cidade Avulsa')

    stubWindowOpen()

    cy.intercept('POST', '**/api/v1/checkout/whatsapp/').as('checkout')
    cy.get('[data-cy="checkout-submit-button"]').should('be.enabled').click()

    cy.wait('@checkout').then(({ response }) => {
      expect(response?.statusCode).to.eq(200)
      expect(response?.body.customer.full_name).to.eq('Cliente Sem Endereco') // identity: profile
      expect(response?.body.customer.address).to.eq('Rua Avulsa, 5') // address: typed
    })
    cy.get('@windowOpen').should('have.been.calledOnce')
  })
})
