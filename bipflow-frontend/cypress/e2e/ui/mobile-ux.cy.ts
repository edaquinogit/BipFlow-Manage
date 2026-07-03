describe('mobile UX regressions', () => {
  it('keeps the viewport mobile-safe and surfaces the welcome experience', () => {
    cy.viewport('iphone-14')
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
