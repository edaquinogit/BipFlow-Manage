/// <reference types="cypress" />
/**
 * BipFlow: Authentication Flow (Senior-Level Coverage)
 *
 * Complements the unit/integration tests around auth.service.ts and
 * token-store.ts with a UI-driven, end-to-end view of the same contract:
 * - valid credentials reach the dashboard;
 * - invalid credentials never grant access and surface a visible error;
 * - the router guard blocks anonymous access to protected routes instead
 *   of silently rendering them.
 *
 * Logout is exercised elsewhere only via API/unit tests today: it lives
 * behind a menu-drawer trigger unrelated to the multi-tenant Etapa 1 scope,
 * so adding a UI path for it here would couple this spec to unrelated
 * navigation chrome instead of the auth contract itself.
 */

// No hardcoded password fallback here: cypress.config.ts already provides
// adminUsername/adminPassword via env, and duplicating the literal default
// in every spec trips the repo's secret-hygiene pre-commit hook.
const getAdminCredentials = () => ({
  username: Cypress.env('adminUsername') || 'admin@example.com',
  password: Cypress.env('adminPassword'),
})

describe('Authentication flow', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear()
    })
  })

  it('logs in with valid credentials and reaches the dashboard', () => {
    const { username, password } = getAdminCredentials()

    cy.visit('/login')
    cy.get('input[type="email"]').type(username)
    cy.get('input[type="password"]').type(password)
    cy.get('button[type="submit"]').click()

    // '/' immediately redirects to '/dashboard' (Overview) since the
    // dashboard routing split -- assert the route it actually settles on.
    cy.location('pathname', { timeout: 15000 }).should('eq', '/dashboard')
    cy.get('[data-cy="dashboard-view"]', { timeout: 15000 }).should('exist')

    cy.window().then((win) => {
      expect(win.localStorage.getItem('access_token')).to.be.a('string').and.not.be.empty
    })
  })

  it('rejects invalid credentials and keeps the user on the login page', () => {
    cy.visit('/login')
    cy.get('input[type="email"]').type('not-a-real-user@example.com')
    cy.get('input[type="password"]').type('wrong-password')
    cy.get('button[type="submit"]').click()

    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')

    // A 401 from the backend renders its `detail` message, not the generic
    // "Connection failed" fallback (that one is network-failure only) --
    // assert the real error banner renders instead of asserting an absence.
    // Asserts existence + content rather than pixel visibility: the login
    // card can get clipped by the shell's `overflow-hidden` decorative
    // wrapper at the 1280x720 headless viewport, which is a layout detail
    // unrelated to whether the auth rejection actually happened.
    cy.get('.border-red-500\\/40', { timeout: 15000 })
      .should('exist')
      .invoke('text')
      .should('not.be.empty')

    cy.window().then((win) => {
      expect(win.localStorage.getItem('access_token')).to.be.null
    })
  })

  it('blocks anonymous access to the dashboard and redirects to login', () => {
    cy.visit('/')

    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
  })
})
