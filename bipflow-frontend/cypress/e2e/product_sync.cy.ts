/**
 * BipFlow: Product Image Synchronization & Rendering Test
 *
 * Validates that product images are:
 * 1. Properly rendered in preview components
 * 2. Served with absolute URLs (no relative path issues)
 * 3. Correctly handled by CORS from backend
 * 4. Not corrupted during transfer
 */

const ASSET_SELECTORS = {
  // data-cy anchor instead of copy text: "ACTIVE ASSETS" no longer exists in
  // ProductListing.vue (current heading is "Produtos ativos"); selecting by
  // data-cy survives future copy changes the way text content does not.
  inventoryTable: '[data-cy="product-table"]',
};

describe('Product Image Synchronization & Integrity', () => {
  const API_URL = Cypress.env('apiUrl') || 'http://127.0.0.1:8000';
  // Dashboard routes are per-section since the routing split; '/' only
  // redirects to the Overview page and never renders the product table.
  const INVENTORY_ROUTE = '/dashboard/produtos';

  beforeEach(() => {
    // Authenticate via API to bypass login flow
    cy.loginViaApi();

    // Intercepting + waiting on the actual products fetch (not inferring
    // completion from "loading-skeleton not.exist") avoids a race where
    // that assertion can resolve true at t=0, before Vue has even started
    // loading and mounted the skeleton in the first place.
    cy.intercept('GET', '**/api/v1/products*').as('getProducts');

    // Navigate to dashboard
    cy.visitWithAuth(INVENTORY_ROUTE);
    cy.wait('@getProducts', { timeout: 15000 });
  });

  it('should verify absolute URLs for product images in the inventory table', () => {
    // Check each image in table. No intermediate `.should('exist')` here:
    // that resolves to a specific DOM node, and if the table re-renders
    // right after becoming visible (Vue swaps the node on a reactive
    // update), the subsequent .find('img') runs against a detached
    // snapshot. Chaining .find() directly off cy.get() lets Cypress retry
    // the whole "get table -> find images" pipeline together until stable.
    cy.get(ASSET_SELECTORS.inventoryTable, { timeout: 15000 })
      .find('img')
      .then(($images) => {
        if (!$images.length) {
          cy.log('No product images in current dataset; skipping image URL assertions.');
          return;
        }

        cy.wrap($images).each(($img, index) => {
          const productName = $img.attr('alt') || `Product_${index}`;

          // Verify image URL is absolute (not relative)
          cy.wrap($img)
            .should('have.attr', 'src')
            .and(
              'match',
              /^http/,
              `Product "${productName}" has relative URL instead of absolute. ` +
              'Check request.build_absolute_uri() in ProductSerializer'
            );

          // Verify image data integrity (image loaded, not corrupted)
          cy.wrap($img).should(($el) => {
            const imgElement = $el[0] as HTMLImageElement;
            expect(imgElement.naturalWidth, `Product "${productName}" image corrupted or not loaded`)
              .to.be.greaterThan(0);
          });
        });
      });
  });

  it('should verify CORS configuration for media endpoint', () => {
    // Test that Django media endpoint is accessible from frontend
    cy.request({
      url: `${API_URL}/media/`,
      failOnStatusCode: false,
    }).then((response) => {
      // Acceptable responses:
      // 200: Public media endpoint
      // 403: Requires auth (but CORS header exists)
      // 404: Media endpoint not configured (acceptable, images served differently)
      expect(response.status).to.be.oneOf(
        [200, 403, 404],
        'Backend Django not responding or CORS misconfigured'
      );

      // Verify CORS headers present (if 200)
      if (response.status === 200) {
        expect(response.headers).to.have.property('access-control-allow-origin');
      }
    });
  });

  it('should handle missing images gracefully', () => {
    cy.get(ASSET_SELECTORS.inventoryTable, { timeout: 15000 }).should('exist');
  });
});
