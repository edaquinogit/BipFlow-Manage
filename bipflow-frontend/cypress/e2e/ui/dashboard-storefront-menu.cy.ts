/// <reference types="cypress" />
/**
 * BipFlow: "Ver vitrine" popover -- mobile-safe positioning + touch targets
 *
 * DashboardHeaderStorefrontMenu.vue anchors its popover with `left-0` on
 * narrow screens and `sm:right-0` from the `sm` breakpoint up, because the
 * trigger button's own wrapper is a flex item inside a `flex-col` mobile
 * header (stretched to the row's full width by the default cross-axis
 * `align-items: stretch`) but a `flex-row` one on desktop. A fixed `right-0`
 * alone looks fine on desktop but floats the panel away from the visible
 * button on mobile, since it resolves against the stretched wrapper instead
 * of the button's actual edge. jsdom/Vitest can't catch this: it never
 * computes real flex layout or getBoundingClientRect(), so this is only
 * verifiable in a real, rendered browser -- hence a dedicated e2e spec.
 */

describe('Dashboard header: "Ver vitrine" storefront menu', () => {
  beforeEach(() => {
    cy.loginViaApi()
  })

  it('keeps the popover fully inside the viewport and touch targets at 44px on a small phone', () => {
    // iPhone 14 dimensions -- same convention as cypress/e2e/ui/mobile-ux.cy.ts.
    cy.viewport(390, 844)
    cy.visitWithAuth('/dashboard')

    cy.get('button[title="Ver vitrine"]', { timeout: 10000 })
      .should('be.visible')
      .then(($trigger) => {
        const triggerRect = $trigger[0].getBoundingClientRect()

        // 44px is the Apple/Google-recommended minimum touch target -- also
        // the same floor the project already enforces globally for
        // inputs/selects (see src/assets/main.css's `min-height: 44px`).
        expect(triggerRect.height, 'trigger tap target height').to.be.at.least(44)

        cy.wrap($trigger).click()
      })

    cy.get('[role="dialog"][aria-label="Compartilhar vitrine"]')
      .should('be.visible')
      .then(($dialog) => {
        const dialogRect = $dialog[0].getBoundingClientRect()
        const viewportWidth = Cypress.config('viewportWidth')

        expect(dialogRect.left, 'popover left edge').to.be.at.least(0)
        expect(dialogRect.right, 'popover right edge').to.be.at.most(viewportWidth)
      })

    cy.get('button[title="Copiar link"]').should(($btn) => {
      const rect = $btn[0].getBoundingClientRect()
      expect(rect.width, 'copy button width').to.be.at.least(44)
      expect(rect.height, 'copy button height').to.be.at.least(44)
    })

    cy.contains('[role="dialog"] a', 'Entrar na vitrine').should(($link) => {
      const rect = $link[0].getBoundingClientRect()
      expect(rect.height, 'entry link tap target height').to.be.at.least(44)
    })

    // iOS Safari auto-zooms on focus for any form control under 16px --
    // the readonly link input must stay at/above that floor.
    cy.get('[role="dialog"] input').should(($input) => {
      const fontSize = window.getComputedStyle($input[0]).fontSize
      expect(fontSize).to.equal('16px')
    })
  })

  it('closes on outside click and Escape, and keeps the popover right-aligned inside the viewport on desktop', () => {
    cy.visitWithAuth('/dashboard')

    cy.get('button[title="Ver vitrine"]', { timeout: 10000 }).should('be.visible').click()

    cy.get('[role="dialog"][aria-label="Compartilhar vitrine"]')
      .should('be.visible')
      .then(($dialog) => {
        const dialogRect = $dialog[0].getBoundingClientRect()
        const viewportWidth = Cypress.config('viewportWidth')

        expect(dialogRect.right, 'popover right edge').to.be.at.most(viewportWidth)
      })

    cy.get('body').click(10, 10)
    cy.get('[role="dialog"][aria-label="Compartilhar vitrine"]').should('not.exist')

    cy.get('button[title="Ver vitrine"]').click()
    cy.get('[role="dialog"][aria-label="Compartilhar vitrine"]').should('be.visible')
    cy.get('body').type('{esc}')
    cy.get('[role="dialog"][aria-label="Compartilhar vitrine"]').should('not.exist')
  })
})
