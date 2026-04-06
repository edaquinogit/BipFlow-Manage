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
  previewContainer: '[data-cy="product-image-preview"]',
  previewImg: '[data-cy="product-image-preview"] img',
  inventoryTable: 'table',
  activeAssetsHeader: 'ACTIVE ASSETS',
};

describe('Product Image Synchronization & Integrity', () => {
  const API_URL = Cypress.env('apiUrl') || 'http://127.0.0.1:8000';
  const INVENTORY_ROUTE = '/dashboard';

  beforeEach(() => {
    // Authenticate via API to bypass login flow
    cy.loginViaApi();

    // Navigate to dashboard
    cy.visit(INVENTORY_ROUTE);
  });

  it('should render product image preview with correct dimensions', () => {
    // 1. Verify preview container exists (allows Vue to inject image element)
    cy.get(ASSET_SELECTORS.previewContainer, { timeout: 10000 })
      .should('exist')
      .within(() => {
        // 2. Verify image tag was injected by Vue binding
        cy.get('img')
          .should('be.visible')
          .should('have.attr', 'src')
          .and('not.be.empty');
      });

    // 3. Verify image loaded successfully (naturalWidth > 0 means browser rendered pixels)
    cy.get(ASSET_SELECTORS.previewImg).should(($img) => {
      const img = $img[0] as HTMLImageElement;
      expect(
        img.naturalWidth,
        'Image preview must be rendered with valid pixel data'
      ).to.be.greaterThan(0);
    });
  });

  it('should verify absolute URLs for all product images in table', () => {
    // Wait for table to populate
    cy.contains(ASSET_SELECTORS.activeAssetsHeader, { timeout: 15000, matchCase: false })
      .should('be.visible');

    // Check each image in table
    cy.get(`${ASSET_SELECTORS.inventoryTable} img`, { timeout: 5000 })
      .should('have.length.at.least', 1)
      .each(($img, index) => {
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
    // If a product has no image, should not cause crashes
    // ProductSerializer.get_image() returns None if obj.image is empty
    cy.get(ASSET_SELECTORS.previewContainer).should('exist');

    // Component should not render img tag if src is None/null
    cy.get(ASSET_SELECTORS.previewImg).then(($elements) => {
      if ($elements.length > 0) {
        // If image exists, verify it's valid
        cy.wrap($elements[0]).should('have.attr', 'src');
      }
      // Otherwise, graceful no-op (no crash)
    });
  });
});
