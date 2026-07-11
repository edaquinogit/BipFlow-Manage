describe('System status page (pipeline health check)', () => {
  // /status is the one route in this app whose job is to prove the SPA
  // actually rendered -- every other route returns 200 from Vite/nginx for
  // the exact same static index.html shell whether or not Vue mounted, so a
  // plain HTTP status check in CI can't tell a real render apart from a
  // blank page. This spec drives a real browser through it instead.
  it('renders client-side content and confirms live backend connectivity', () => {
    cy.visit('/status')

    cy.get('[data-testid="status-page"]').should('be.visible')
    cy.get('[data-testid="frontend-status"]').should('contain.text', 'OK')
    cy.get('[data-testid="backend-status"]', { timeout: 10000 }).should('contain.text', 'OK')
  })
})
