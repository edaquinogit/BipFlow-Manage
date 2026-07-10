/**
 * BipFlow: Bulk QR Label Printing (Etapa 6 of the QR-code stock-exit
 * evolution, see docs/architecture/qrcode-stock-exit-evolution.md).
 *
 * Covers the selection UX fix (select-all header checkbox now toggles
 * select-all <-> deselect-all, instead of only ever selecting) and the new
 * batch label preview/print/PDF flow, on both desktop and a mobile
 * viewport.
 */

const SELECTORS = {
  // data-cy anchor instead of copy text, same convention as
  // product_sync.cy.ts: survives future copy changes the way text
  // content does not.
  inventoryTable: '[data-cy="product-table"]',
  mobileProductCard: '[data-cy="product-table-card"]',
  // TableRow.vue (desktop) and TableRowCard.vue (mobile) both render at
  // once (CSS shows/hides one via `lg:` breakpoints, neither is removed
  // from the DOM) and share the same data-cy -- a bare
  // '[data-cy="row-checkbox"]' query matches both and silently doubles the
  // count, or grabs the currently CSS-hidden one. Scoping under the
  // desktop table only queries the copy actually visible at the default
  // (desktop) viewport these tests run at unless a test explicitly
  // switches to a mobile viewport.
  rowCheckbox: '[data-cy="product-table"] [data-cy="row-checkbox"]',
  selectAllCheckbox: '[data-cy="select-all-checkbox"]',
  selectAllCheckboxMobile: '[data-cy="select-all-checkbox-mobile"]',
  bulkPrintLabelsButton: '[data-cy="btn-bulk-print-labels"]',
  labelsGrid: '[data-cy="qr-bulk-labels-grid"]',
  labelCard: '[data-cy="qr-bulk-label-card"]',
};

describe('Bulk QR label printing (products)', () => {
  // Dashboard routes are per-section since the routing split; '/' only
  // redirects to the Overview page and never renders the product table.
  const INVENTORY_ROUTE = '/dashboard/produtos';

  beforeEach(() => {
    cy.loginViaApi();

    cy.intercept('GET', '**/api/v1/products*').as('getProducts');
    cy.visitWithAuth(INVENTORY_ROUTE);
    cy.wait('@getProducts', { timeout: 15000 });
  });

  it('selects a subset of products and reflects the count in the bulk action bar', () => {
    cy.get(SELECTORS.inventoryTable, { timeout: 15000 }).should('be.visible');

    cy.get('body').then(($body) => {
      const checkboxCount = $body.find(SELECTORS.rowCheckbox).length;
      if (checkboxCount < 2) {
        cy.log('Not enough products to exercise a partial selection; skipping.');
        return;
      }

      cy.get(SELECTORS.rowCheckbox).eq(0).click();
      cy.get(SELECTORS.rowCheckbox).eq(1).click();

      cy.contains('2 produtos selecionados').should('be.visible');
    });
  });

  it('toggles select-all/deselect-all via the header checkbox', () => {
    cy.get(SELECTORS.inventoryTable, { timeout: 15000 }).should('be.visible');

    cy.get('body').then(($body) => {
      const count = $body.find(SELECTORS.rowCheckbox).length;
      if (count === 0) {
        cy.log('No products to select; skipping.');
        return;
      }

      cy.get(SELECTORS.selectAllCheckbox).click();
      cy.contains(`${count} produto${count === 1 ? '' : 's'} selecionado${count === 1 ? '' : 's'}`).should(
        'be.visible'
      );

      // Second click on the same header checkbox must deselect everything --
      // this is the gap being closed: it used to always re-select.
      cy.get(SELECTORS.selectAllCheckbox).click();
      cy.contains('produto selecionado').should('not.exist');
      cy.contains('produtos selecionados').should('not.exist');
    });
  });

  it('opens the bulk labels preview and renders the grid for the selected products', () => {
    cy.get(SELECTORS.inventoryTable, { timeout: 15000 }).should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.find(SELECTORS.rowCheckbox).length === 0) {
        cy.log('No products to select; skipping.');
        return;
      }

      cy.get(SELECTORS.rowCheckbox).eq(0).click();

      // The trailing '*' must come after a literal '/': the real request is
      // '.../qr-codes-bulk/?ids=...' (DRF router actions always end in a
      // slash before the query string), and a bare '*' doesn't cross that
      // '/' the way '**' would -- 'qr-codes-bulk*' silently never matches.
      cy.intercept('GET', '**/api/v1/products/qr-codes-bulk/*').as('getBulkLabels');
      cy.get(SELECTORS.bulkPrintLabelsButton).click();
      cy.wait('@getBulkLabels', { timeout: 15000 });

      cy.get(SELECTORS.labelsGrid, { timeout: 15000 }).should('be.visible');
      cy.get(SELECTORS.labelCard).should('have.length.at.least', 1);
    });
  });

  it('keeps the bulk action bar and label preview mobile-safe at 390x844', () => {
    // Explicit CSS pixel dimensions (iPhone 14, 390x844) instead of a named
    // preset -- this Cypress version has no "iphone-14" preset, and named
    // presets go stale across Cypress upgrades; raw dimensions never do
    // (same convention as cypress/e2e/ui/mobile-ux.cy.ts).
    cy.viewport(390, 844);

    // The desktop table (SELECTORS.inventoryTable) is deliberately
    // `hidden lg:block` -- at this width the mobile card list
    // (TableRowCard.vue) is what's actually on screen.
    cy.get(SELECTORS.mobileProductCard, { timeout: 15000 }).should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.find(SELECTORS.selectAllCheckboxMobile).length === 0) {
        cy.log('No products to select; skipping.');
        return;
      }

      cy.get(SELECTORS.selectAllCheckboxMobile).click();

      cy.get(SELECTORS.bulkPrintLabelsButton)
        .should('be.visible')
        .then(($button) => {
          const rect = $button[0].getBoundingClientRect();
          expect(rect.right, 'labels button stays within the viewport width').to.be.at.most(
            Cypress.config('viewportWidth')
          );
          expect(rect.height, 'labels button touch target height').to.be.at.least(32);
        });

      cy.intercept('GET', '**/api/v1/products/qr-codes-bulk/*').as('getBulkLabelsMobile');
      cy.get(SELECTORS.bulkPrintLabelsButton).click();
      cy.wait('@getBulkLabelsMobile', { timeout: 15000 });

      cy.get(SELECTORS.labelsGrid, { timeout: 15000 }).should('exist');

      // Asserting on the grid container itself doesn't work here: by design
      // it's taller than the modal's own scrollport (a dozen stacked label
      // cards don't all fit one screen at once), so part of its bounding
      // box is always clipped by the modal's `overflow-y: auto` regardless
      // of scroll position -- Cypress's visibility check treats that as
      // "not visible" even though the content is genuinely on screen and
      // reachable by scrolling. The first card is a fixed, reasonably-sized
      // element that actually fits, and is what's on screen without any
      // scrolling right after the grid renders -- a more meaningful check
      // for "mobile-safe" than the tall scrollable wrapper anyway.
      cy.get(SELECTORS.labelCard)
        .first()
        .should('be.visible')
        .then(($card) => {
          const rect = $card[0].getBoundingClientRect();
          expect(rect.right, 'label card stays within the viewport width').to.be.at.most(
            Cypress.config('viewportWidth') + 1
          );
        });
    });
  });
});
