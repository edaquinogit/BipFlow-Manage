describe('mobile UX regressions', () => {
  it('keeps the viewport mobile-safe and surfaces the welcome experience', () => {
    // Explicit CSS pixel dimensions (iPhone 14, 390x844) instead of a named
    // preset -- Cypress's built-in preset list doesn't track new device
    // names (this Cypress version has no "iphone-14"), so a name is one
    // Cypress upgrade away from breaking again; raw dimensions never go stale.
    cy.viewport(390, 844)
    cy.visit('/dashboard')

    cy.get('meta[name="viewport"]')
      .should('have.attr', 'content')
      .and('contain', 'maximum-scale=1.0')

    cy.contains('O que vamos pedir hoje').should('be.visible')

    cy.get('input').first().should(($input) => {
      const fontSize = window.getComputedStyle($input[0]).fontSize
      expect(fontSize).to.equal('16px')
    })
  })
})
