# BipFlow Test Integration Guide

**Last Updated:** March 2026
**Status:** Production-Ready Architecture

## Overview

BipFlow implements a comprehensive, professional testing architecture spanning:
- **Vue 3 Frontend**: Vitest unit tests + Cypress E2E tests
- **Node.js Backend**: Jest integration & edge-case tests
- **Django Backend**: Optional test suite (managed separately)

All tests follow professional English conventions and integrate modern service architectures (useToast, Logger).

---

## Table of Contents

1. [Frontend Testing](#frontend-testing-vue--typescript)
2. [Backend Testing](#backend-testing-nodejs)
3. [Running All Tests](#running-all-tests)
4. [Test Architecture](#test-architecture)
5. [Service Mocking](#service-mocking)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)

---

## Frontend Testing (Vue + TypeScript)

### Vitest Unit Tests

**Location:** `bipflow-frontend/src/composables/__tests__/`

#### Current Test Suite: useProducts.spec.ts

Tests the product management composable with comprehensive coverage:

- **Product Creation**: FormData transformation for multipart uploads
- **Image Handling**: URL transformation, null handling
- **Revenue Calculation**: Type coercion with mixed price types
- **Error Handling**: Service failure scenarios, error state management
- **State Management**: Loading states, error clearing on retry

**Features:**
- Mocks `ProductService`, `useToast`, and `Logger`
- Tests FormData binary serialization
- Verifies toast notifications triggered on success/error
- Type-safe with full TypeScript support

#### Running Vitest Tests

```bash

# Install dependencies (if not already done)
cd bipflow-frontend
npm install

# Run all Vitest tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode (reruns on file changes)
npm run test:watch

# Run specific test file
npm run test -- useProducts.spec.ts

# Run single test
npm run test -- --reporter=verbose -t "should transform product data"
```text

## Expected Output

```bash
✓ useProducts Composable
  ✓ Product Creation with Image Upload (2 tests)
  ✓ Revenue Calculation (2 tests)
  ✓ State Management (2 tests)
  ✓ Image Handling (2 tests)

Test Files  1 passed (1)
Tests      10 passed (10)
```bash

---

### Cypress E2E Tests

**Location:** `bipflow-frontend/cypress/e2e/`

#### Test Files

##### 1. media_upload.cy.ts
Tests complete product image upload flow:
- Dashboard navigation
- Form opening and population
- Image file selection and preview
- Form submission and success feedback
- Error handling with toast notifications
- API error simulation

**Key Scenarios:**
- Valid product creation with image
- Image preview before submission
- Error toast on API failures
- Form remains open on error (user can correct)

##### 2. product_sync.cy.ts
Tests product image synchronization and rendering:
- Image preview rendering with correct dimensions
- Absolute URL verification (no relative paths)
- CORS configuration validation
- Missing image graceful handling
- Image integrity (naturalWidth check)

**Key Scenarios:**
- Product table image rendering validation
- CORS header verification on media endpoint
- Image corruption detection

#### Running Cypress Tests

```bash

# Install dependencies
cd bipflow-frontend
npm install

# Run Cypress in interactive mode
npm run cypress:open

# Run all Cypress tests headless
npm run cypress:run

# Run specific spec file
npx cypress run --spec "cypress/e2e/product-flow/media_upload.cy.ts"

# Run with specific browser
npx cypress run --browser chrome

# Record to Cypress Cloud (if configured)
npm run cypress:run -- --record
```bash

## Cypress Environment Setup

Create or update `cypress.env.json`:

```json
{
  "apiUrl": "http://127.0.0.1:8000/api",
  "appUrl": "http://localhost:5173"
}
```text

### Expected Output (E2E Test Results)

```bash
  Product Image Upload Flow
    ✓ should successfully upload a product with image (3s)
    ✓ should display error toast if image upload fails (2s)
    ✓ should preview image before submission (2s)
    ✓ should handle API errors gracefully with error toast (3s)

  Product Image Synchronization & Rendering
    ✓ should render product image preview with correct dimensions (2s)
    ✓ should verify absolute URLs for all product images in table (3s)
    ✓ should verify CORS configuration for media endpoint (2s)
    ✓ should handle missing images gracefully (2s)

Tests:    8 passed (8)
Wait time: 1.2s
```bash

---

## Backend Testing (Node.js)

### Jest Test Files

**Location:** `api-order-validation/tests/`

#### Test Files (E2E)

##### 1. orders.test.js
Core order API tests:
- Health check endpoint
- Request validation
- Valid order acceptance
- Order total calculation

**Test Categories:**
- Health Check
- Order Validation
- Total Verification

##### 2. integration.test.js
Complex workflows with real database:
- Order creation and persistence
- Sequential processing
- Concurrent request handling
- Data integrity validation
- Error recovery

**Test Categories:**
- Order Creation & Persistence
- Complex Item Scenarios
- Data Integrity
- Concurrent Request Handling
- Error Recovery

##### 3. edge-cases.test.js
Boundary and error scenarios:
- Empty/invalid field values
- Boundary value testing (negative, zero, very large)
- Invalid format detection
- Type coercion
- Special characters & encoding

**Test Categories:**
- Validation Edge Cases
- Health Check Validation
- 404 Error Handling
- Type Coercion & Boundary Values
- Special Characters & Encoding

#### Running Jest Tests

```bash

# Install dependencies (Cypress)
cd api-order-validation
npm install

# Run all tests
npm test

# Run specific test file (Pattern)
npm test -- orders.test.js

# Run with coverage (Report)
npm test -- --coverage

# Watch mode
npm test -- --watch

# Run with verbose output
npm test -- --verbose

# Run tests matching pattern
npm test -- --testNamePattern="should accept valid order"

# Single test run (CI mode, no watch)
npm test -- --ci --no-coverage
```bash

## Expected Output (Vitest)

```plaintext
PASS  tests/orders.test.js
  BipFlow Orders API
    Health Check
      ✓ should return UP status on health check (45ms)
    Order Validation
      ✓ should reject order with missing required fields (38ms)
      ✓ should accept valid order and create it successfully (52ms)
      ✓ should verify order total matches item sum (41ms)

PASS  tests/integration.test.js
  BipFlow API - Integration Tests
    Order Creation and Persistence
      ✓ should create order and verify persistence (68ms)
      ✓ should process multiple orders sequentially (242ms)
      ✓ should reject duplicate order after first insertion (89ms)
    ... (more tests)

PASS  tests/edge-cases.test.js
  BipFlow API - Edge Cases & Error Handling
    ... (all tests)

Test Suites: 3 passed (3)
Tests:       28 passed (28)
Snapshots:   0
Time:        5.823s
```bash

### Test Data Requirements

Tests use dynamically generated data with timestamps:

```javascript
const uniqueId = `TEST${Date.now()}`
// Generates: TEST1741000000000
```bash

No fixtures or seed data required. Database is automatically cleaned up per test suite.

---

## Running All Tests

### Local Development

```bash

# Terminal 1: Start Django backend
cd bipflow/
python manage.py runserver

# Terminal 2: Start Node.js backend
cd api-order-validation/
npm start

# Terminal 3: Start Vue frontend
cd bipflow-frontend/
npm run dev

# Terminal 4: Run frontend tests
cd bipflow-frontend/
npm run test          # Vitest
npm run cypress:open  # Cypress interactive

# Terminal 5: Run backend tests
cd api-order-validation/
npm test             # Jest
```bash

## Parallel Execution

```bash

# Run all tests in parallel (recommended for CI)
./test-integration.sh  # At repository root
```bash

## Test Coverage

```bash

# Frontend coverage
cd bipflow-frontend
npm run test:coverage

# Output: coverage/

# Backend coverage
cd api-order-validation
npm test -- --coverage

# Output: coverage/ (Report)
```python

---

## Test Architecture

### Vitest Unit Tests (Additional)

**Philosophy:** Fast, isolated, with mocked dependencies

**Structure:**

```python
useProducts.spec.ts
├── Test Setup (beforeEach): Mock ProductService, useToast, Logger
├── Test Categories:
│   ├── Product Creation with Image Upload
│   ├── Revenue Calculation
│   ├── State Management
│   └── Image Handling
└── Assertions: Instance checks, method calls, state values
```bash

**Key Patterns:**
- Spy functions to track service calls
- FormData validation for binary data
- Revenue computation with type coercion
- Toast notification verification

### Cypress E2E Tests (Additional)

**Philosophy:** Full user flow validation, visual regression, API integration

**Structure:**

```bash
media_upload.cy.ts
├── Feature: Product Image Upload Flow
├── Selectors: [data-cy] attributes for DOM queries
├── Setup (beforeEach): Login, API interception, navigation
├── Test Scenarios:
│   ├── Happy Path: Upload → Preview → Submit → Success
│   ├── Error Path: API error → Error toast → Form stays open
│   └── Preview: Select image → See preview
└── Assertions: Window state, API calls, UI elements
```text

**Key Patterns:**
- Centralized selector constants
- API call interception with cy.intercept()
- Image loading verification with naturalWidth
- Retry logic with timeout increments
- Toast notification assertions

### Jest Integration Tests

**Philosophy:** API contract validation, database integration, concurrent behavior

**Structure:**

```plaintext
tests/orders.test.js
├── Setup (beforeAll): Clean database, create test DB
├── Describe blocks:
│   ├── Health Check (1 route, basic validation)
│   ├── Order Validation (3 scenarios)
│   └── Calculation Verification
└── Assertions: Status codes, response shapes, values
```python

**Key Patterns:**
- HTTP status code validation (201, 400, 404)
- Response shape verification
- Unique test identifiers with timestamps
- Concurrent Promise.all() for stress testing
- Error recovery validation

---

## Service Mocking

### Frontend Service Mocks

#### useToast Composable

```typescript
// In vitest tests
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mocked(useToast).mockReturnValue(mockToast);

// Then verify in tests
expect(mockToast.success).toHaveBeenCalled();
expect(mockToast.error).toHaveBeenCalledWith(
  expect.stringContaining("Failed")
);
```python

#### Logger Service

```typescript
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mocked(Logger).mockReturnValue(mockLogger);

// Verification
expect(mockLogger.error).toHaveBeenCalledWith(
  expect.stringContaining("Failed to create product"),
  expect.any(Object)
);
```text

#### ProductService

```typescript
vi.spyOn(ProductService, "create").mockResolvedValue({
  id: 101,
  name: "Test Product",
  image: "http://localhost:8000/media/products/2026/test.png",
});

// Or for errors
vi.spyOn(ProductService, "create").mockRejectedValue(
  new Error("SKU already exists")
);
```text

### Cypress API Mocking

```typescript
// Intercept GET requests
cy.intercept('GET', `${API_URL}/products/`).as('getProducts');

// Wait for request
cy.wait('@getProducts', { timeout: 10000 });

// Mock response
cy.intercept('POST', `${API_URL}/products/`, {
  statusCode: 201,
  body: { id: 1, name: "Mocked Product" }
}).as('createProduct');

// Simulate error
cy.intercept('POST', `${API_URL}/products/`, {
  statusCode: 400,
  body: { detail: 'Product with this SKU already exists' }
}).as('createProductError');
```bash

### Jest API Testing

```javascript
// Supertest automatically handles requests
const res = await request(app)
  .post('/api/v1/orders')
  .send({ order_number: 'TEST-01', ... });

expect(res.statusCode).toBe(201);
expect(res.body).toHaveProperty('status', 'Success');
```bash

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: cd bipflow-frontend && npm install
      - run: npm run test  # Vitest
      - run: npm run test:coverage
      - run: npm run cypress:run

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: cd api-order-validation && npm install
      - run: npm test -- --coverage
```typescript

---

## Troubleshooting

### Vitest Issues

**Issue:** Tests timeout waiting for mock

```bash

# Solution: Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000,  // 10 seconds
  },
});
```typescript

**Issue:** Mock not resetting between tests

```bash

# Solution: Add to beforeEach
beforeEach(() => {
  vi.clearAllMocks();  // Clear ALL mocks
  vi.resetAllMocks();  // Reset return values
});
```bash

## Cypress Issues

**Issue:** Element not found or timeout

```typescript
// Solution: Increase timeout or add retry logic
cy.get('[data-cy="btn-add-product"]', { timeout: 10000 })

// Or verify element exists first
cy.get('[data-cy="dashboard-view"]', { timeout: 5000 })
  .should('exist')
  .then(() => {
    cy.get('[data-cy="btn-add-product"]').click();
  });
```typescript

**Issue:** API intercept not matching

```typescript
// Debug: Check network in Cypress console
cy.intercept('POST', '**/api/v1/orders', { log: true }).as('createOrder');

// Then in console:
// cy.get('@createOrder').then(interception => {
//   console.log(interception.request.body)
// })
```bash

**Issue:** Image not loading in preview

```typescript
// Solution: Check that file fixture exists
cy.get('input[type="file"]').selectFile('cypress/fixtures/burger-test.png', { force: true });

// And verify preview loads
cy.get('[data-cy="product-image-preview"]', { timeout: 5000 })
  .should('exist')
  .within(() => {
    cy.get('img').should('have.attr', 'src');
  });
```bash

### Jest Issues

**Issue:** Database lock or connection error

```bash

# Solution: Clean up before running tests
rm -f db.sqlite3
npm test

# Or specify separate test database
DB_PATH=test.sqlite3 npm test
```bash

**Issue:** Timeout on concurrent tests

```javascript
// Solution: Increase Jest timeout
jest.setTimeout(30000);  // 30 seconds

// Or disable timeout for specific test
test('slow test', async () => {
  // ... slow code
}, 60000);  // 60 second timeout
```bash

**Issue:** Tests pass locally but fail in CI

```bash

# Solution: Ensure consistent seed data

# Use timestamps for unique IDs (already implemented)
const uniqueId = `TEST${Date.now()}`;

# And reset database state
npm test -- --forceExit  # Exit after all tests complete
```typescript

---

## Best Practices

### 1. **Naming Conventions**

```typescript
// ✓ Good: Clear, descriptive
test("should accept valid order and create it successfully", () => {})

// ✗ Bad: Too vague
test("works", () => {})
test("order", () => {})
```typescript

### 2. **Test Isolation**

```typescript
// ✓ Good: Each test is independent
beforeEach(() => {
  vi.clearAllMocks();
  // Reset to known state
});

// ✗ Bad: Tests depend on execution order
let globalState = {};
test("sets global", () => { globalState.id = 1; });
test("uses global", () => { expect(globalState.id).toBe(1); });
```typescript

### 3. **Arrange-Act-Assert Pattern**

```typescript
// ✓ Good: Clear structure
it("should calculate revenue correctly", () => {
  // ARRANGE: Setup test data
  const products = [{ price: 100, stock: 2 }];

  // ACT: Execute function being tested
  const revenue = calculateRevenue(products);

  // ASSERT: Verify expected outcome
  expect(revenue).toBe(200);
});
```plaintext

### 4. **Avoid Implementation Details**

```typescript
// ✓ Good: Test behavior/outcome, not implementation
expect(res.statusCode).toBe(201);
expect(res.body).toHaveProperty('order_id');

// ✗ Bad: Testing internal implementation
expect(dbConnection.insert).toHaveBeenCalled();
```plaintext

### 5. **Use Descriptive Assertions**

```typescript
// ✓ Good: Message helps debug
expect(img.naturalWidth, 'Image should be rendered').to.be.greaterThan(0);

// ✗ Bad: No context
expect(img.naturalWidth).to.be.greaterThan(0);
```typescript

---

## Performance Targets

| Test Suite | Target Time | Actual |
|-----------|------------|--------|
| Vitest Unit | < 2s | ~1.5s |
| Cypress E2E | < 20s | ~15s |
| Jest Integration | < 10s | ~8s |
| **Total** | **< 32s** | **~25s** |

---

## Support & Documentation

- **Vitest**: https://vitest.dev/
- **Cypress**: https://docs.cypress.io/
- **Jest**: https://jestjs.io/
- **TypeScript**: https://www.typescriptlang.org/

---

**Last Updated:** March 2026
**Next Review:** June 2026
