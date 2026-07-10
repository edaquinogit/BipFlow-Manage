describe('mobile UX regressions', () => {
  it('keeps the viewport mobile-safe and surfaces the welcome experience', () => {
    // Explicit CSS pixel dimensions (iPhone 14, 390x844) instead of a named
    // preset -- Cypress's built-in preset list doesn't track new device
    // names (this Cypress version has no "iphone-14"), so a name is one
    // Cypress upgrade away from breaking again; raw dimensions never go stale.
    cy.viewport(390, 844)

    // The "welcome experience" this test guards is the public storefront's
    // entry splash (IntroSplash.vue, driven by useIdleIntro), not the
    // authenticated admin dashboard -- '/dashboard' requires auth and this
    // test never logs in, so it was always landing on the login screen
    // instead of the page it meant to test. '/produtos' (PublicRoutes.Products)
    // is the actual public, unauthenticated storefront root.
    cy.visit('/produtos')

    cy.get('meta[name="viewport"]')
      .should('have.attr', 'content')
      .and('contain', 'maximum-scale=1.0')

    // IntroSplash types its greeting character-by-character, then
    // auto-dismisses after ~2s (see useIdleIntro's idle/read-pause timers) --
    // asserting on the dialog's aria-label (set once, statically, on mount,
    // not animated) proves the splash rendered without racing that timing
    // the way matching the fully-typed visible text would.
    cy.get('[role="dialog"][aria-modal="true"]')
      .should('have.attr', 'aria-label')
      .and('match', /bem-vindo/i)

    cy.get('input').first().should(($input) => {
      const fontSize = window.getComputedStyle($input[0]).fontSize
      expect(fontSize).to.equal('16px')
    })
  })
})
