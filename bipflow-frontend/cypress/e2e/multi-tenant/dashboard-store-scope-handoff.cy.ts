/// <reference types="cypress" />
/**
 * BipFlow: Dashboard Store Scope Handoff (P0 Tenant Isolation)
 *
 * Covers the shared-device risk that motivated the first hardening step:
 * an operator from store A logs out, a stale store slug is present in
 * localStorage, and operator B must still resolve only their own store.
 */

const STORE_SCOPE_STORAGE_KEY = 'bipflow_selected_store_slug'

type DashboardAccount = {
  email: string
  password: string
  storeName: string
}

type AuthResponse = {
  access: string
}

type StoreSummary = {
  slug: string
  name: string
}

const apiBaseUrl = () =>
  String(Cypress.env('apiBaseUrl') || 'http://localhost:8000/api').replace(/\/$/, '')

const buildAccount = (label: string, runId: string): DashboardAccount => ({
  email: `tenant-${label}-${runId}@e2e.bipflow.local`,
  password: 'MangaAzul!7429',
  storeName: `Loja ${label.toUpperCase()} ${runId}`,
})

const registerDashboardOwner = (account: DashboardAccount) => {
  return cy.request({
    method: 'POST',
    url: `${apiBaseUrl()}/auth/register/`,
    body: {
      email: account.email,
      password: account.password,
      confirm_password: account.password,
      registration_context: 'dashboard_owner',
      store_name: account.storeName,
    },
  }).then((response) => {
    expect(response.status).to.eq(201)
    expect(response.body).to.include({
      email: account.email,
      profile_kind: 'dashboard_owner',
    })
  })
}

const resolveOwnedStore = (account: DashboardAccount): Cypress.Chainable<StoreSummary> => {
  return cy
    .request<AuthResponse>({
      method: 'POST',
      url: `${apiBaseUrl()}/auth/token/`,
      body: {
        username: account.email,
        password: account.password,
      },
    })
    .then((loginResponse) => {
      expect(loginResponse.body.access, 'access token').to.be.a('string').and.not.be.empty

      return cy.request<StoreSummary[]>({
        method: 'GET',
        url: `${apiBaseUrl()}/v1/store/mine/`,
        headers: {
          Authorization: `Bearer ${loginResponse.body.access}`,
        },
      })
    })
    .then((storesResponse) => {
      expect(storesResponse.body, 'owned stores').to.have.length(1)
      const store = storesResponse.body[0]
      expect(store.slug, 'store slug').to.be.a('string').and.not.be.empty
      return store
    })
}

const loginThroughUi = (account: DashboardAccount) => {
  cy.get('input[type="email"]').clear().type(account.email)
  cy.get('input[type="password"]').clear().type(account.password, { log: false })
  cy.get('button[type="submit"]').click()
}

describe('Dashboard store scope handoff', () => {
  it('clears store A on logout and ignores stale localStorage when store B logs in', () => {
    const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`
    const accountA = buildAccount('a', runId)
    const accountB = buildAccount('b', runId)

    registerDashboardOwner(accountA)
    registerDashboardOwner(accountB)

    resolveOwnedStore(accountA).then((storeA) => {
      resolveOwnedStore(accountB).then((storeB) => {
        cy.clearCookies()
        cy.viewport(1280, 720)
        cy.visit('/login', {
          onBeforeLoad(win) {
            win.localStorage.clear()
            win.sessionStorage.clear()
          },
        })

        cy.intercept('GET', '**/api/v1/store/mine/').as('storeMineA')
        loginThroughUi(accountA)

        cy.location('pathname', { timeout: 15000 }).should('eq', '/dashboard')
        cy.wait('@storeMineA', { timeout: 15000 })
        cy.get('[data-cy="dashboard-view"]', { timeout: 15000 }).should('exist')
        cy.window().should((win) => {
          expect(win.localStorage.getItem(STORE_SCOPE_STORAGE_KEY)).to.eq(storeA.slug)
        })

        cy.intercept('POST', '**/api/auth/logout/').as('logout')
        cy.get('button[aria-label="Finalizar sessao"]').should('be.visible').click()
        cy.wait('@logout', { timeout: 15000 })
        cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
        cy.window().should((win) => {
          expect(win.localStorage.getItem(STORE_SCOPE_STORAGE_KEY)).to.be.null
        })

        cy.window().then((win) => {
          win.localStorage.setItem(STORE_SCOPE_STORAGE_KEY, storeA.slug)
        })
        cy.reload()
        cy.window().should((win) => {
          expect(win.localStorage.getItem(STORE_SCOPE_STORAGE_KEY)).to.eq(storeA.slug)
        })

        cy.intercept('GET', '**/api/v1/store/mine/').as('storeMineB')
        loginThroughUi(accountB)

        cy.location('pathname', { timeout: 15000 }).should('eq', '/dashboard')
        cy.wait('@storeMineB', { timeout: 15000 }).then((interception) => {
          const leakedHeader =
            interception.request.headers['x-store-slug'] ??
            interception.request.headers['X-Store-Slug']
          expect(leakedHeader, 'untrusted stale store slug header').to.be.undefined
        })
        cy.window().should((win) => {
          expect(win.localStorage.getItem(STORE_SCOPE_STORAGE_KEY)).to.eq(storeB.slug)
        })
      })
    })
  })
})
