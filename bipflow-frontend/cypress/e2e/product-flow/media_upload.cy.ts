/**
 * BipFlow: Product Image Upload E2E Test
 *
 * Tests the complete user flow for uploading a product with an image:
 * 1. Navigate to dashboard
 * 2. Open new product form
 * 3. Fill product details
 * 4. Upload image file
 * 5. Verify image preview
 * 6. Submit form
 * 7. Verify success toast notification
 * 8. Confirm product appears in table
 */

describe('Product Image Upload Flow', () => {
  type AuthTokens = {
    access: string;
    refresh: string;
  };

  type CategoryResponse = {
    id: number;
    name: string;
  };

  // Bare fixture path (not `{ contents: Buffer.from(...) }`). Every variant
  // that builds a Buffer/object for `contents` -- inline base64, a larger
  // generated PNG, cy.fixture(path,'base64') rebuilt into a Buffer -- made
  // it through selectFile() with identical byte corruption every time
  // (every byte that isn't valid standalone UTF-8, like PNG's 0x89 marker
  // and CRC bytes, became the UTF-8 replacement character, inflating a
  // 117-byte file into 185 corrupted bytes; same input always produced the
  // exact same corrupted output, ruling out a flaky/random cause). Django
  // /Pillow then rejected it as "not a valid image file" downstream of that
  // corruption, regardless of how many times the source PNG was
  // regenerated and re-verified as valid before being handed to Cypress.
  // The bare-path form documented as Cypress's standard file-upload usage
  // reads the file straight from disk through a different code path and
  // does not exhibit this.
  const TEST_IMAGE_PATH = 'cypress/fixtures/test-product-image.png';

  const API_PATTERNS = {
    products: '**/api/v1/products/**',
    categories: '**/api/v1/categories/**',
    createProduct: '**/api/v1/products/',
  };

  const getApiBaseUrl = () => String(
    Cypress.env('apiBaseUrl') || 'http://127.0.0.1:8000/api'
  ).replace(/\/$/, '');

  const SELECTORS = {
    // Dashboard
    dashboard: '[data-cy="dashboard-view"]',
    addProductBtn: '[data-cy="btn-add-product"]',

    // Form Panel
    formPanel: '[data-cy="product-form-panel"]',
    productNameInput: 'input[name="name"]',
    categorySelect: '[data-cy="select-category"]',
    productPriceInput: 'input[name="price"]',
    productStockInput: 'input[name="stock_quantity"]',
    productImageInput: '[data-cy="input-product-image-cover"]',
    imagePreview: '[data-cy="product-image-preview-cover"]',
    previewImg: '[data-cy="product-image-preview-cover"]',
    submitBtn: '[data-cy="btn-submit-product"]',
    closeFormBtn: '[data-cy="btn-close-form"]',

    // Table
    productTable: '[data-cy="product-table"]',
    tableRow: '[data-cy="product-table-row"]',

    // Notifications
    toastContainer: '[data-cy="toast-container"]',
    toastSuccess: '[data-cy="toast-success"]',
    toastError: '[data-cy="toast-error"]',
  };

  const selectCategory = (categoryId: string | number) => {
    // The form panel scrolls inside its own overflow-y-auto container, nested
    // inside a position:fixed dialog. Cypress's automatic scroll-into-view
    // does not reliably resolve that nested context, so it is done explicitly
    // (matches the fix Cypress itself suggests for "covered by fixed ancestor").
    cy.get(SELECTORS.categorySelect)
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get(`[data-cy="category-option-${categoryId}"]`)
      .scrollIntoView()
      .should('be.visible')
      .click();
  };

  beforeEach(() => {
    // 1. Authenticate user (bypass login flow)
    cy.loginViaApi().then((tokens: AuthTokens) => {
      const authHeaders = { Authorization: `Bearer ${tokens.access}` };

      // Reuse an existing category instead of creating a fresh one per test.
      // The dashboard's category dropdown only loads page 1 of
      // /v1/categories/ (page_size=20); a category created here always has
      // the highest id, so once accumulated test categories from repeated
      // local runs pass that page boundary, the just-created category never
      // appears in the dropdown and the whole flow fails downstream. Reusing
      // an existing one keeps category count (and this risk) from growing
      // every run.
      return cy.request<{ count: number; results: CategoryResponse[] }>({
        method: 'GET',
        url: `${getApiBaseUrl()}/v1/categories/?page_size=1`,
        headers: authHeaders,
      }).then((listResponse) => {
        const existing = listResponse.body.results[0];

        if (existing) {
          Cypress.env('e2eCategoryId', existing.id);
          return;
        }

        return cy.request<CategoryResponse>({
          method: 'POST',
          url: `${getApiBaseUrl()}/v1/categories/`,
          headers: authHeaders,
          body: { name: `E2E Category ${Date.now()}` },
        }).then((createResponse) => {
          Cypress.env('e2eCategoryId', createResponse.body.id);
        });
      });
    });

    // 2. Intercept API calls for verification.
    // Deliberately NOT intercepting the createProduct POST here: any
    // intercept (bare alias or callback + req.continue()) registered on a
    // request carrying this multipart file body corrupts it in transit in
    // this Cypress version -- every byte that isn't valid standalone UTF-8
    // (PNG's 0x89 marker, CRC bytes) gets replaced with the UTF-8
    // replacement character, garbling the file before it reaches the
    // server. Leaving the route un-intercepted avoids the corruption
    // entirely; success is verified via the toast and table row instead
    // of inspecting the intercepted request body.
    cy.intercept('GET', API_PATTERNS.products).as('getProducts');
    cy.intercept('GET', API_PATTERNS.categories).as('getCategories');

    // 3. Navigate to the products page (dashboard routes are per-section
    // since the routing split; '/' only redirects to the Overview page
    // and never fetches products/categories at all).
    cy.visitWithAuth('/dashboard/produtos');

    // 4. Wait for data to load
    cy.wait('@getProducts', { timeout: 10000 });
    cy.wait('@getCategories', { timeout: 10000 });
  });

  it('should successfully upload a product with image', () => {
    // Step 1: Click "Add Product" button to open form
    cy.get(SELECTORS.addProductBtn, { timeout: 5000 })
      .should('be.visible')
      .click();

    // Step 2: Verify form panel opened
    cy.get(SELECTORS.formPanel, { timeout: 3000 })
      .should('be.visible');

    // Step 3: Fill product details
    const productName = `Test Product ${Date.now()}`;
    cy.get(SELECTORS.productNameInput)
      .should('be.visible')
      .type(productName);

    // scrollIntoView: these fields sit below the fold inside the form's own
    // overflow-y-auto area (nested in a position:fixed dialog), where
    // Cypress's automatic scrolling does not reliably resolve.
    cy.get(SELECTORS.productPriceInput)
      .scrollIntoView()
      .should('be.visible')
      .type('99.99');

    cy.get(SELECTORS.productStockInput)
      .scrollIntoView()
      .should('be.visible')
      .type('10');

    selectCategory(Cypress.env('e2eCategoryId'));

    // Step 4: Upload image file. No `be.visible` here: this file input is
    // intentionally `opacity-0` (MediaSection.vue), stacked under the
    // styled drop-zone so clicking the zone opens the native file picker.
    // Asserting visibility on it would fight the component's own design.
    cy.get(SELECTORS.productImageInput)
      .scrollIntoView()
      .should('exist')
      .selectFile(TEST_IMAGE_PATH, { force: true });

    // Step 5: Verify image preview appears. Asserts existence + a populated
    // src rather than visual opacity: the preview fades in via a 0.5s CSS
    // transition (MediaSection.vue's `fade` transition group), so asserting
    // "visible" couples the test to an animation timing detail instead of
    // the thing that actually matters -- the preview has a real image src.
    cy.get(SELECTORS.imagePreview, { timeout: 5000 })
      .should('exist')
      .should('have.attr', 'src')
      .and('not.be.empty');

    // Step 6: Verify preview image loaded correctly
    cy.get(SELECTORS.previewImg).should(($img) => {
      const img = $img[0] as HTMLImageElement;
      expect(img.naturalWidth, 'Image should be rendered').to.be.greaterThan(0);
    });

    // Step 7: Submit form
    cy.get(SELECTORS.submitBtn)
      .should('be.visible')
      .and('not.be.disabled')
      .click();

    // Step 8: Verify success toast notification appears
    cy.get(SELECTORS.toastSuccess, { timeout: 5000 })
      .should('be.visible')
      .and('contain', 'Produto criado com sucesso');

    // Step 9: Verify form closed after success
    cy.get(SELECTORS.formPanel, { timeout: 3000 })
      .should('not.exist');

    // Step 10: Verify product appears in table
    cy.get(SELECTORS.productTable, { timeout: 5000 })
      .should('be.visible')
      .contains(productName)
      .should('be.visible');
  });

  it('should keep preview empty before an image is selected', () => {
    // Step 1: Open form
    cy.get(SELECTORS.addProductBtn)
      .should('be.visible')
      .click();

    cy.get(SELECTORS.formPanel, { timeout: 3000 })
      .should('be.visible');

    // Step 2: Fill only required fields (no image)
    cy.get(SELECTORS.productNameInput)
      .type(`Test Product ${Date.now()}`);

    cy.get(SELECTORS.productPriceInput)
      .type('99.99');

    cy.get(SELECTORS.productStockInput)
      .type('5');

    // Step 3: Verify empty state handling
    cy.get(SELECTORS.imagePreview)
      .should('not.exist');
  });

  it('should preview image before submission', () => {
    // Open form
    cy.get(SELECTORS.addProductBtn)
      .click();

    cy.get(SELECTORS.formPanel, { timeout: 3000 })
      .should('be.visible');

    // Select image
    cy.get(SELECTORS.productImageInput)
      .scrollIntoView()
      .selectFile(TEST_IMAGE_PATH, { force: true });

    // The preview fades in via a 0.5s CSS transition; assert it exists with
    // a real src rather than coupling the test to the animation's opacity.
    cy.get(SELECTORS.imagePreview, { timeout: 3000 })
      .should('exist');

    cy.get(SELECTORS.previewImg)
      .should('have.attr', 'src')
      .and('match', /blob:|http/);  // Either blob URL or absolute URL

    // Close form without submitting
    cy.get(SELECTORS.closeFormBtn)
      .should('be.visible')
      .click();

    cy.get(SELECTORS.formPanel)
      .should('not.exist');
  });

  it('should handle API errors gracefully with error toast', () => {
    // Simulate API error on product creation
    cy.intercept('POST', API_PATTERNS.createProduct, {
      statusCode: 400,
      body: { detail: 'Product with this SKU already exists' },
    }).as('createProductError');

    // Open form
    cy.get(SELECTORS.addProductBtn)
      .click();

    cy.get(SELECTORS.formPanel, { timeout: 3000 })
      .should('be.visible');

    // Fill details
    cy.get(SELECTORS.productNameInput)
      .type(`Test Product ${Date.now()}`);

    cy.get(SELECTORS.productPriceInput)
      .scrollIntoView()
      .type('99.99');

    cy.get(SELECTORS.productStockInput)
      .scrollIntoView()
      .type('10');

    selectCategory(Cypress.env('e2eCategoryId'));

    cy.get(SELECTORS.productImageInput)
      .scrollIntoView()
      .selectFile(TEST_IMAGE_PATH, { force: true });

    // Submit
    cy.get(SELECTORS.submitBtn)
      .scrollIntoView()
      .click();

    // Wait for failed API call
    cy.wait('@createProductError', { timeout: 10000 });

    // Verify error toast appears
    cy.get(SELECTORS.toastError, { timeout: 5000 })
      .should('be.visible')
      .and('contain.text', 'Nao foi possivel salvar o produto');

    // Form should remain open so user can correct
    cy.get(SELECTORS.formPanel)
      .should('be.visible');
  });
});
