/// <reference types="cypress" />
/**
 * BipFlow: Multi-Tenant Foundation (Etapa 1) -- Storefront & Data Leakage
 *
 * The public catalog visited here IS the single default store created by
 * the Etapa 1 backfill migration. These specs pin two guarantees while the
 * project is still single-tenant:
 * 1. The storefront keeps working end-to-end (regression net for the
 *    backend changes shipped in Etapa 1).
 * 2. GET /api/v1/store/current/ -- the new tenant-resolution endpoint --
 *    never exposes private fields (owner, memberships) over the network,
 *    independent of what the frontend currently consumes from it.
 */

const apiBaseUrl = () =>
  (Cypress.env('apiBaseUrl') || 'http://127.0.0.1:8000/api').replace(/\/$/, '')

describe('Store foundation: public contract has no private leakage', () => {
  it('exposes only the public allowlist on /store/current/', () => {
    cy.request(`${apiBaseUrl()}/v1/store/current/`).then((response) => {
      expect(response.status).to.eq(200)
      expect(Object.keys(response.body).sort()).to.deep.equal(
        [
          'id',
          'is_active',
          'logo_url',
          'name',
          'slug',
          'status',
          'tagline',
          'theme',
          'whatsapp_phone',
        ].sort()
      )
      expect(response.body).to.not.have.property('owner')
      expect(response.body).to.not.have.property('memberships')
    })
  })

  it('resolves the same default store regardless of caller identity', () => {
    cy.loginViaApi().then(() => {
      const tokens = Cypress.env('authTokens')

      cy.request(`${apiBaseUrl()}/v1/store/current/`).then((anonymousResponse) => {
        cy.request({
          url: `${apiBaseUrl()}/v1/store/current/`,
          headers: { Authorization: `Bearer ${tokens.access}` },
        }).then((authenticatedResponse) => {
          expect(authenticatedResponse.body).to.deep.equal(anonymousResponse.body)
        })
      })
    })
  })
})

describe('Storefront renders the single default store catalog', () => {
  it('loads the public catalog without authentication and without crashing', () => {
    cy.visit('/produtos')

    // CI may run against a freshly migrated database with zero products
    // (frontend-tests.yml only seeds dashboard roles, not catalog data).
    // The meaningful assertion is "the page reached a terminal state",
    // not "products exist" -- mirrors the defensive pattern already used
    // in product_sync.cy.ts for the same reason.
    //
    // Uses .should() (not .then()) so Cypress retries the callback until
    // the loading skeleton resolves into one of the three terminal states,
    // instead of asserting on whatever the DOM looked like at the instant
    // <body> first appeared.
    cy.get('body', { timeout: 15000 }).should(($body) => {
      const hasProducts = $body.find('article').length > 0
      const hasEmptyState = $body.text().includes('Nenhum produto encontrado')
      const hasErrorState = $body.text().includes('Erro ao carregar produtos')

      expect(
        hasProducts || hasEmptyState || hasErrorState,
        'catalog should reach products, empty-state or error-state, not hang loading'
      ).to.be.true
    })
  })
})
