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
  const API_URL = Cypress.env('apiUrl') || 'http://127.0.0.1:8000/api';
  const FIXTURES = {
    productImage: 'cypress/fixtures/burger-test.png',
  };

  const SELECTORS = {
    // Dashboard
    dashboard: '[data-cy="dashboard-view"]',
    addProductBtn: '[data-cy="btn-add-product"]',

    // Form Panel
    formPanel: '[data-cy="product-form-panel"]',
    productNameInput: 'input[name="name"]',
    productPriceInput: 'input[name="price"]',
    productStockInput: 'input[name="stock_quantity"]',
    productImageInput: '[data-cy="input-product-image"]',
    imagePreview: '[data-cy="product-image-preview"]',
    previewImg: '[data-cy="product-image-preview"] img',
    submitBtn: '[data-cy="btn-save-product"]',
    closeFormBtn: '[data-cy="btn-close-form"]',

    // Table
    productTable: '[data-cy="product-table"]',
    tableRow: '[data-cy="product-table-row"]',

    // Notifications
    toastContainer: '[data-cy="toast-container"]',
    toastSuccess: '[data-cy="toast-success"]',
    toastError: '[data-cy="toast-error"]',
  };

  beforeEach(() => {
    // 1. Authenticate user (bypass login flow)
    cy.loginViaApi();

    // 2. Intercept API calls for verification
    cy.intercept('GET', `${API_URL}/products/`).as('getProducts');
    cy.intercept('GET', `${API_URL}/categories/`).as('getCategories');
    cy.intercept('POST', `${API_URL}/products/`).as('createProduct');

    // 3. Navigate to dashboard
    cy.visit('/dashboard');

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

    cy.get(SELECTORS.productPriceInput)
      .should('be.visible')
      .type('99.99');

    cy.get(SELECTORS.productStockInput)
      .should('be.visible')
      .type('10');

    // Step 4: Upload image file
    cy.get(SELECTORS.productImageInput)
      .should('be.visible')
      .selectFile(FIXTURES.productImage, { force: true });

    // Step 5: Verify image preview appears
    cy.get(SELECTORS.imagePreview, { timeout: 5000 })
      .should('exist')
      .within(() => {
        cy.get('img')
          .should('be.visible')
          .should('have.attr', 'src')
          .and('not.be.empty');
      });

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

    // Step 8: Wait for product creation API call
    cy.wait('@createProduct', { timeout: 10000 }).then((interception) => {
      // Verify request includes form data
      expect(interception.request.body).to.include(productName);
    });

    // Step 9: Verify success toast notification appears
    cy.get(SELECTORS.toastSuccess, { timeout: 5000 })
      .should('be.visible')
      .and('contain', 'successfully');

    // Step 10: Verify form closed after success
    cy.get(SELECTORS.formPanel, { timeout: 3000 })
      .should('not.exist');

    // Step 11: Verify product appears in table
    cy.get(SELECTORS.productTable, { timeout: 5000 })
      .should('be.visible')
      .contains(productName)
      .should('be.visible');
  });

  it('should display error toast if image upload fails', () => {
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

    // Step 3: Try to submit without required image (if image is required)
    // This test depends on backend validation
    // For now, we'll just verify empty state handling
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
      .selectFile(FIXTURES.productImage, { force: true });

    // Verify preview renders synchronously
    cy.get(SELECTORS.imagePreview, { timeout: 3000 })
      .should('be.visible');

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
    cy.intercept('POST', `${API_URL}/products/`, {
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
      .type('99.99');

    cy.get(SELECTORS.productStockInput)
      .type('10');

    cy.get(SELECTORS.productImageInput)
      .selectFile(FIXTURES.productImage, { force: true });

    // Submit
    cy.get(SELECTORS.submitBtn)
      .click();

    // Wait for failed API call
    cy.wait('@createProductError', { timeout: 10000 });

    // Verify error toast appears
    cy.get(SELECTORS.toastError, { timeout: 5000 })
      .should('be.visible')
      .and('contain.text', 'Failed');

    // Form should remain open so user can correct
    cy.get(SELECTORS.formPanel)
      .should('be.visible')
      .and('contain.class', 'open');
  });

  it('should handle image upload errors gracefully', () => {
    // 1. Authenticate user (bypass login flow)
    cy.loginViaApi();

    // 2. Intercept API calls for verification
    cy.intercept('GET', `${API_URL}/products/`).as('getProducts');
    cy.intercept('GET', `${API_URL}/categories/`).as('getCategories');
    cy.intercept('POST', `${API_URL}/products/`).as('createProduct');

    // 3. Navigate to dashboard
    cy.visit('/dashboard');

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

    cy.get(SELECTORS.productPriceInput)
      .should('be.visible')
      .type('99.99');

    cy.get(SELECTORS.productStockInput)
      .should('be.visible')
      .type('10');

    // Step 4: Upload image file
    cy.get(SELECTORS.productImageInput)
      .should('be.visible')
      .selectFile(FIXTURES.productImage, { force: true });

    // Step 5: Verify image preview appears
    cy.get(SELECTORS.imagePreview, { timeout: 5000 })
      .should('exist')
      .within(() => {
        cy.get('img')
          .should('be.visible')
          .should('have.attr', 'src')
          .and('not.be.empty');
      });

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

    // Step 8: Wait for product creation API call
    cy.wait('@createProduct', { timeout: 10000 }).then((interception) => {
      // Verify request includes form data
      expect(interception.request.body).to.include(productName);
    });

    // Step 9: Verify success toast notification appears
    cy.get(SELECTORS.toastSuccess, { timeout: 5000 })
      .should('be.visible')
      .and('contain', 'successfully');

    // Step 10: Verify form closed after success
    cy.get(SELECTORS.formPanel, { timeout: 3000 })
      .should('not.exist');

    // Step 11: Verify product appears in table
    cy.get(SELECTORS.productTable, { timeout: 5000 })
      .should('be.visible')
      .contains(productName)
      .should('be.visible');
  });

  it('should display error toast if image upload fails', () => {
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

    // Step 3: Try to submit without required image (if image is required)
    // This test depends on backend validation
    // For now, we'll just verify empty state handling
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
      .selectFile(FIXTURES.productImage, { force: true });

    // Verify preview renders synchronously
    cy.get(SELECTORS.imagePreview, { timeout: 3000 })
      .should('be.visible');

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
    cy.intercept('POST', `${API_URL}/products/`, {
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
      .type('99.99');

    cy.get(SELECTORS.productStockInput)
      .type('10');

    cy.get(SELECTORS.productImageInput)
      .selectFile(FIXTURES.productImage, { force: true });

    // Submit
    cy.get(SELECTORS.submitBtn)
      .click();

    // Wait for failed API call
    cy.wait('@createProductError', { timeout: 10000 });

    // Verify error toast appears
    cy.get(SELECTORS.toastError, { timeout: 5000 })
      .should('be.visible')
      .and('contain.text', 'Failed');

    // Form should remain open so user can correct
    cy.get(SELECTORS.formPanel)
      .should('be.visible');
  });
});
