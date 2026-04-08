# AI Context & Development Guide

> **Purpose:** Establish the absolute source of truth for all AI agent interactions with BipFlow. Eliminates hallucinations through strict architectural directives and enterprise-grade Clean Code enforcement.
>
> **Authority Level:** Principal DX Engineer | **Version:** 2.0 Enterprise Edition
> **Last Updated:** April 2026 | **Status:** Authoritative Source of Truth ✅

**CRITICAL:** This document is the ONLY reference for AI agents. Any contradiction requires trust in this document, not the agent's training data.

---

## 🚨 NAMESPACE RULES (ABSOLUTE)

### ✅ Correct Namespace: `bipdelivery`
- Backend module is **STRICTLY** `bipdelivery`
- All imports must use: `from bipdelivery.api.models import Product`
- All Django settings reference: `bipdelivery.core.settings`
- All URL patterns reference: `bipdelivery.api.urls`

### ❌ Forbidden Namespaces (ZERO TOLERANCE)
- **NEVER** use `core` as a top-level module name in Python files
- **NEVER** use generic placeholders: `your_project_name`, `my_app`, `app_name`, `project_name`
- **NEVER** suggest renaming `api` to `apps` or `services` or `backend`
- **NEVER** create top-level folders besides: `bipdelivery`, `bipflow-frontend`, `docs`, `cypress`, `database`, `services`, `src`

### Configuration Files: Zero Ambiguity
- Django: `DJANGO_SETTINGS_MODULE = 'bipdelivery.core.settings'` (literal, no variables)
- pytest: `testpaths = bipdelivery/tests` (explicit path, no wildcards)
- All imports in `conftest.py`: Use full `bipdelivery` namespace
- No abbreviations in config: write `bipdelivery`, not `bd` or `bipd`

**Consequence:** If an AI creates code with wrong namespace, reject immediately and request correction.

---

## 🔥 CODE GENERATION RULES (REFACTORING PROTOCOL)

### RULE 1: NO CODE DUPLICATION HALLUCINATIONS
**When refactoring, REPLACE—never append.**

#### ❌ FORBIDDEN PATTERN (Append-Only)
```python
# ❌ HALLUCINATION: AI added code without removing old version
def process_product(product: Product) -> Dict:
    """Original implementation."""
    return {"name": product.name, "price": product.price}

def process_product_v2(product: Product) -> Dict:  # ← NEW ADDED, OLD NOT REMOVED
    """Refactored implementation."""
    return {
        "name": product.name,
        "price": product.price,
        "category": product.category.name,
    }
```

#### ✅ CORRECT PATTERN (Clean Replacement)
```python
# ✅ CORRECT: Old implementation removed, new one replaces it
def process_product(product: Product) -> Dict:
    """Enhanced implementation with category support."""
    return {
        "name": product.name,
        "price": product.price,
        "category": product.category.name,
    }
```

### RULE 2: EXTRACTION MEANS DELETION
When extracting logic to a new function/composable:
1. Create the new function **with proper types and docstring**
2. **Remove the old code entirely** from the original location
3. Call the extracted function from the original location
4. Verify the old function still works (no logic duplication)

#### Example: Extract ProductService
```python
# BEFORE (monolithic)
class ProductViewSet:
    def get_queryset(self):
        products = Product.objects.all()
        # 20 lines of filtering logic here
        return products

# AFTER (correctly extracted)
class ProductService:
    @staticmethod
    def get_filtered_products() -> QuerySet:
        """Centralized product filtering logic."""
        return Product.objects.all()  # Logic moved here

class ProductViewSet:
    def get_queryset(self):
        return ProductService.get_filtered_products()  # ← Calls extracted logic, original deleted
```

### RULE 3: NO ORPHANED CODE
- **If you create a helper function, it MUST be called somewhere**
- **If you create a new file, it MUST be imported somewhere**
- **If you remove code, verify nothing depends on it first**
- Dead code = hallucination = rejection

### RULE 4: ATOMIC CHANGES ONLY
- Each change addresses ONE concern
- File refactors: One file per commit (unless tightly coupled)
- API changes: Endpoint modifications + tests + docs in ONE PR
- No partial implementations

---

## 🚨 CRITICAL AI DIRECTIVES

**These rules are non-negotiable. Violating them is a critical failure.**

### Logging & Debugging
- **NEVER** use `console.log()`, `print()`, `alert()`, or `window.alert()`
- **ALWAYS** use the `Logger` service for backend: `from bipdelivery.core.logger import Logger`
- **ALWAYS** use the `Logger` service for frontend: `import { Logger } from '@/services/logger'`
- **ALWAYS** use `useToast()` for user-facing notifications, never raw alerts
- Structured logging format: `Logger.info('action', { context })`

### Code Quality
- **NEVER** leave `TODO`, `FIXME`, `XXX`, or placeholder comments in code
- **ALWAYS** use strict TypeScript interfaces for ALL types (no `any`)
- **ALWAYS** provide explicit return type annotations for all functions
- **NEVER** use `@ts-ignore`, `// @ts-nocheck`, or type casting (`as Type`)
- **NEVER** commit with failing tests or linting errors
- **NEVER** duplicate code patterns; extract to shared utilities first

### Backend (Python/Django ONLY)
- **The backend is Django 6.0 + DRF. Node.js backend suggestions are HALLUCINATIONS.**
- **NEVER** suggest Express, FastAPI, or any Node-based server
- **Module namespace is `bipdelivery`, NOT `core` or `your_app`**
- **ALWAYS** use Django ORM (`models.py`) for database logic
- **ALWAYS** use DRF serializers for API validation
- **ALWAYS** use pytest (configured in `pytest.ini` with `django.setup()` in `conftest.py`)
- HTTP status codes: 200 (success), 201 (created), 400 (validation), 401 (auth), 403 (permission), 500 (error)

### Frontend (Vue 3 + TypeScript ONLY)
- **The frontend is Vue 3 with TypeScript. React suggestions are HALLUCINATIONS.**
- **ALWAYS** use Composition API with `ref()`, `computed()`, and `watch()`
- **ALWAYS** validate API responses with Zod before using them
- **ALWAYS** use `withDefaults(defineProps<T>())` for component props
- **NEVER** use `any` types, no implicit `any`
- **ALWAYS** use strict TypeScript (`"strict": true` in `tsconfig.json`)

### Code Comments
- **ALWAYS** write comments in Professional English (no Portuguese, no slang)
- **NEVER** include Portuguese language comments in logic files
- Comments should explain "why", not "what" (code explains "what")
- No emojis, abbreviations, or informal language

### Testing & Validation (State of Grace)
- **100% pass rate required:**
  - ✅ pytest (Backend unit tests)
  - ✅ Cypress E2E tests
  - ✅ Vitest (Frontend unit tests)
  - ✅ TypeScript strict type checking
- **NEVER** commit code without running full test suite
- **NEVER** disable, skip, or `.only()` tests
- **NEVER** commit code that breaks existing tests

---

---

## 1. Project Identity

### What is BipFlow?
**BipFlow** is an enterprise delivery ecosystem platform—a REST API backend paired with a modern Vue 3 dashboard for order management, inventory synchronization, and fulfillment workflows.

- **Backend:** Django 6.0 + Django REST Framework + JWT authentication
- **Frontend:** Vue 3 (Composition API) + TypeScript (strict mode)
- **Database:** SQLite (development) / PostgreSQL (production)
- **Not:** Node.js monolith, React app, or generic scaffold
- **Is:** API-first architecture with type-safe frontend

### Core Problem Statement
Delivery companies need real-time visibility into orders, automatic inventory updates, and a fast dashboard. BipFlow solves this with a stateless REST API and type-safe Vue 3 dashboard.

### Success Metrics (Measurable)
- Dashboard loads in <2s (product list + categories)
- API endpoint responds in <500ms (p95)
- Zero unhandled errors (all logged via Logger service)
- Zero `any` types in TypeScript code
- 100% test pass rate before any commit
- All PRs pass pre-commit hooks before merge

---

## 2. Technology Stack (Canonical Source of Truth)

### Backend Services
| Component | Version | Use Case | Path |
|-----------|---------|----------|------|
| Django | 6.0.2 | Web framework & ORM | `bipdelivery/` |
| Django REST Framework | 3.14.0 | REST API generation | `bipdelivery/api/` |
| djangorestframework-simplejwt | 5.3.0 | JWT auth (access + refresh tokens) | DRF auth layer |
| django-cors-headers | 4.0.0 | Cross-origin requests (frontend → backend) | CORS middleware |
| Pillow | (removed) | Image processing | Image storage handler |
| pytest & pytest-django | Latest | Backend testing | `bipdelivery/tests/` |
| Ruff | Latest | Python linter (primary) | `bipdelivery/` |
| Black | Latest | Python formatter | `bipdelivery/` |

**Database:**
- **Development:** SQLite (`db.sqlite3`)
- **Production:** PostgreSQL (configure via `DATABASE_URL` env var)

**Python Version:** 3.11+ (tested: 3.14.3)

### Frontend Stack
| Component | Version | Use Case | Path |
|-----------|---------|----------|------|
| Vue | 3.x (Composition API) | UI framework with reactivity | `bipflow-frontend/src/` |
| TypeScript | 5.x (strict mode) | Type-safe JavaScript | `**/*.ts`, `**/*.vue` |
| Vite | 5.x | Build bundler & dev server | `vite.config.ts` |
| Vitest | Latest | Unit test runner | `**/*.spec.ts` |
| Cypress | Latest | E2E test runner | `cypress/e2e/` |
| TailwindCSS | 3.x | Utility-first CSS | `tailwind.config.js` |
| Axios | Latest | HTTP client (calls Django API) | `src/services/api.ts` |
| Zod | 3.x | Schema validation (runtime type checking) | `src/schemas/` |

**Node Version:** 18+ | **Package Manager:** npm

---

## 3. Folder Structure Map (Canonical Directory Reference)

### Backend: `bipdelivery/` Module

```
bipdelivery/                           # ← THE MODULE NAME (REQUIRED: NEVER CHANGE)
├── api/                               # ⭐ Main application: all business logic
│   ├── models.py                      # Database schema (Category, Product, Order)
│   ├── serializers.py                 # DRF serializers (validation → JSON conversion)
│   ├── views.py                       # ViewSets (ProductViewSet, CategoryViewSet)
│   ├── urls.py                        # API route definitions (auto-generated by DRF)
│   ├── v1_urls.py                     # Optional: Versioned API routes
│   ├── tests.py                       # Legacy tests (deprecated: move to tests/ folder)
│   ├── migrations/                    # Database migration history (auto-generated)
│   ├── admin.py                       # Django admin site registration
│   └── __init__.py
│
├── core/                              # Django project configuration (NOT a top-level namespace)
│   ├── settings.py                    # Configuration: INSTALLED_APPS, DATABASE, JWT
│   ├── urls.py                        # Root URL router (delegates to api/urls.py)
│   ├── asgi.py                        # Async WSGI for production
│   ├── wsgi.py                        # WSGI for Gunicorn/production
│   ├── views.py                       # Project-level views (if needed)
│   ├── logger.py                      # ⭐ Structured logging service (NOT console.log)
│   └── __init__.py
│
├── tests/                             # Test suite organized by concern
│   ├── __init__.py
│   ├── conftest.py                    # Pytest configuration + Django setup (django.setup() call here)
│   ├── test_api_health.py             # API health check endpoints
│   ├── test_products_api.py           # Product CRUD endpoints
│   ├── test_categories_api.py         # Category management endpoints
│   └── fixtures/                      # Shared test fixtures (factories, mocks)
│
├── manage.py                          # Django CLI entry point (python manage.py runserver)
├── db.sqlite3                         # Development SQLite database (git-ignored)
├── requirements.txt                   # Python dependencies (PINNED VERSIONS ONLY)
└── venv/                              # Virtual environment folder (git-ignored)
```

**CRITICAL—Import Rules:**
- ✅ `from bipdelivery.api.models import Product`
- ✅ `from bipdelivery.core.settings import DEBUG`
- ✅ `from bipdelivery.core.logger import Logger`
- ❌ `from core.models import Product` (WRONG—use full namespace)
- ❌ `from your_app.views import ProductViewSet` (WRONG—generic placeholder forbidden)

### Frontend: `bipflow-frontend/` Module

```
bipflow-frontend/
├── src/
│   ├── components/                    # Reusable Vue components (template + logic)
│   │   ├── dashboard/                 # Dashboard-specific UI
│   │   │   ├── ProductForm.vue        # Product create/edit form
│   │   │   ├── ProductTable.vue       # Product list table
│   │   │   ├── CategorySelector.vue   # Category dropdown/selector
│   │   │   └── layout/
│   │   └── common/                    # Shared UI components (Button, Modal, etc.)
│   │       ├── Button.vue
│   │       ├── Modal.vue
│   │       └── Toast.vue              # ⭐ Professional notifications (NOT alert())
│   │
│   ├── composables/                   # 🔑 Vue 3 Composition functions (state + logic)
│   │   ├── useProducts.ts             # Product CRUD + state management
│   │   ├── useCategories.ts           # Category state + caching
│   │   ├── useToast.ts                # ⭐ Toast notification system
│   │   ├── useAuth.ts                 # Authentication + token management
│   │   └── __tests__/                 # Unit tests for composables
│   │
│   ├── services/                      # API clients + utilities
│   │   ├── api.ts                     # Axios instance (JWT interceptors, error handling)
│   │   ├── product.service.ts         # Product API endpoints
│   │   ├── category.service.ts        # Category API endpoints
│   │   ├── auth.service.ts            # Login/logout/token refresh logic
│   │   └── logger.ts                  # ⭐ Structured logging (NOT console.log)
│   │
│   ├── schemas/                       # Zod runtime validation (TypeScript → runtime safety)
│   │   ├── product.schema.ts          # Product type definitions + validation rules
│   │   ├── category.schema.ts         # Category type definitions
│   │   └── auth.schema.ts             # Auth token validation
│   │
│   ├── views/                         # Page-level Vue components (routable)
│   │   ├── DashboardView.vue          # Main dashboard
│   │   ├── LoginView.vue              # Authentication form
│   │   ├── ProductDetailView.vue      # Single product page
│   │   └── ErrorView.vue              # Error page (404, 500, etc.)
│   │
│   ├── router/                        # Vue Router configuration
│   │   ├── index.ts                   # Route definitions
│   │   ├── auth.routes.ts             # Public: login, signup
│   │   └── dashboard.routes.ts        # Protected: dashboard, products
│   │
│   ├── types/                         # Custom TypeScript types (NOT 'any')
│   │   ├── auth.ts                    # User, JWT token interfaces
│   │   ├── product.ts                 # Product type definitions
│   │   └── api.ts                     # API response types
│   │
│   ├── config/                        # Constants + configuration
│   │   └── api.config.ts              # API base URL + endpoints
│   │
│   ├── App.vue                        # Root component (never modify routing here)
│   └── main.ts                        # Application entry point
│
├── cypress/                           # E2E tests (Cypress framework)
│   ├── e2e/
│   │   ├── auth.cy.ts                 # Login/logout E2E tests
│   │   ├── product-flow.cy.ts         # Product CRUD workflow tests
│   │   └── dashboard.cy.ts            # Dashboard interaction tests
│   ├── support/
│   │   ├── commands.ts                # Cypress custom commands
│   │   └── e2e.ts                     # Global support setup
│   └── fixtures/                      # Test data fixtures
│
├── public/                            # Static assets (favicon, etc.)
├── .env.local                         # ⭐ CREATE LOCALLY: VITE_API_URL=http://127.0.0.1:8000/api/
├── vite.config.ts                     # Bundler config (port 5173, proxy options)
├── vitest.config.ts                   # Unit test runner configuration
├── cypress.config.ts                  # E2E test configuration
├── tsconfig.json                      # TypeScript compiler (strict: true)
├── tailwind.config.js                 # TailwindCSS utility configuration
├── package.json                       # Node dependencies
└── package-lock.json                  # Locked dependency versions
```

**CRITICAL—Import Rules:**
- ✅ `import { useProducts } from '@/composables/useProducts'`
- ✅ `import { Logger } from '@/services/logger'`
- ✅ `import { ProductSchema } from '@/schemas/product.schema'`
- ❌ `import useProducts from '../../composables/useProducts'` (WRONG—use @ alias)
- ❌ `import { Logger } from './services/logger'` (WRONG—use @ alias)

### Root-Level Configuration

```
BipFlow-Oficial/
├── .husky/                            # Git hooks (pre-commit validation)
│   └── pre-commit                     # Runs: TypeScript check + Python lint
├── .github/                           # GitHub workflows (CI/CD)
├── .vscode/                           # VS Code workspace settings
│   ├── settings.json                  # Python interpreter path, linting
│   ├── launch.json                    # Debug configurations
│   ├── tasks.json                     # Development tasks
│   └── extensions.json                # Required extensions
├── docs/                              # Documentation
│   └── api/openapi.yaml               # API specification
├── database/                          # SQL migrations / setup scripts
├── README.md                          # Project README (single source of truth)
├── AI_CONTEXT.md                      # THIS FILE: AI grounding document
├── bootstrap-env.ps1                  # Automated environment setup (PowerShell)
├── pytest.ini                         # Pytest configuration
├── conftest.py                        # Root-level pytest configuration
├── requirements.txt                   # Python dependencies
└── package.json                       # Root Node configuration (shared scripts)
```

---

## 4. Coding Standards (Enterprise-Grade)

### Python Backend Standards

#### ✅ Type Hints (Mandatory for Functions)
**Every function must have explicit return type annotations.**

```python
# ✅ CORRECT: Explicit return types
from typing import List, Optional

def get_available_products(category_id: int) -> List[Product]:
    """Retrieve all available products in a category."""
    return Product.objects.filter(category_id=category_id, is_available=True)

def get_product_image(self, obj: Product) -> Optional[str]:
    """Convert image to absolute URI or return None."""
    if obj.image:
        return request.build_absolute_uri(obj.image.url)
    return None

def save_product_to_cache(product: Product) -> None:
    """Persist product to cache without returning value."""
    cache.set(f"product:{product.id}", product, timeout=3600)

# ❌ WRONG: No return type annotation
def get_product(product_id):  # FORBIDDEN
    return Product.objects.get(id=product_id)

# ❌ WRONG: Any types
def process_data(data: Any) -> Any:  # FORBIDDEN
    pass
```

#### ✅ Docstrings (Google Format)
```python
# ✅ GOOD
def create_product(data: Dict[str, Any], category: Category) -> Product:
    """
    Create a new product with validation and category assignment.

    Validates SKU uniqueness, generates slug, and sets availability based on stock.

    Args:
        data: Dictionary with required fields (name, price, sku, stock_quantity).
        category: Category instance to assign to product.

    Returns:
        Created Product instance with auto-generated ID and slug.

    Raises:
        ValidationError: If SKU already exists or required fields are missing.
        IntegrityError: If database constraint violation occurs.
    """
    # Implementation here
```

#### ✅ Linting Rules (Automated Compliance)
- **Ruff:** Used for Python linting (primary tool)
- **Black:** Used for code formatting (100 character line length)
- **Pre-commit hook:** Runs Ruff + Black before any commit
- **No:** `any` types, `print()` statements, unused imports, bare except

#### ❌ Forbidden Patterns (Python)
```python
# ❌ NO: print() for logging
print("Product created:", product_id)  # Use Logger instead

# ❌ NO: console-style debugging
import pdb; pdb.set_trace()  # Use Logger.debug() instead

# ❌ NO: Bare except
try:
    do_something()
except:  # FORBIDDEN - must specify exception
    pass

# ❌ NO: TODO comments without tracking
# TODO: Add pagination to products endpoint  # FORBIDDEN (add to issue tracker)

# ❌ NO: Portuguese comments mixed with code
# ESSA VIEW É QUE O VUE VAI CHAMAR  # FORBIDDEN - English only

# ❌ NO: Unused imports
import sys  # FORBIDDEN - will fail linting
```

### Vue 3 / TypeScript Standards

#### ✅ Strict TypeScript (No Exceptions)
```typescript
// ✅ CORRECT: Explicit types everywhere
interface ProductProps {
  products: Product[];
  loading: boolean;
  onDelete: (id: number) => void;
}

const props = withDefaults(defineProps<ProductProps>(), {
  products: () => [],
  loading: false,
});

const emit = defineEmits<{
  (e: 'save', data: Product): void;
  (e: 'error', message: string): void;
}>();

// ✅ CORRECT: Typed computed properties
const filteredProducts = computed<Product[]>(() => {
  return props.products.filter((p) => p.is_available);
});

const handleDelete = async (id: number): Promise<void> => {
  await deleteProduct(id);
  emit('save', { id });
};

// ❌ WRONG: any types (FORBIDDEN)
const props = defineProps({
  products: Array as PropType<any>,  // FORBIDDEN
});
```

#### ✅ Error Handling (Structured, Never Raw Alerts)
```typescript
// ✅ CORRECT: Professional logging + Toast
import { Logger } from '@/services/logger';
import { useToast } from '@/composables/useToast';

const { error: toastError, success: toastSuccess } = useToast();

try {
  const response = await updateProduct(id, data);
  Logger.info('Product updated', { productId: id, version: response.version });
  toastSuccess('Product saved successfully');
} catch (err) {
  Logger.error('Product update failed', { productId: id, error: err });
  toastError('Failed to save product. Please try again.');
}

// ❌ WRONG: Raw alerts
alert('Failed to save');  // FORBIDDEN
console.log('Error:', err);  // FORBIDDEN
```

#### ✅ Composables (Reactive State + Logic)
```typescript
// ✅ CORRECT: Clean composable structure
import { ref, computed } from 'vue';
import { Logger } from '@/services/logger';
import { ProductService } from '@/services/product.service';

export function useProducts() {
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const totalRevenue = computed(() =>
    products.value.reduce((sum, p) => sum + Number(p.price), 0)
  );

  const fetchProducts = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      products.value = await ProductService.getAll();
      Logger.info('Products fetched', { count: products.value.length });
    } catch (err) {
      Logger.error('Fetch failed', { error: err });
      error.value = 'Failed to fetch products';
    } finally {
      loading.value = false;
    }
  };

  return { products, loading, error, totalRevenue, fetchProducts };
}

// ❌ WRONG: Unvalidated data
const products = ref(await api.get('products'));  // No validation!

// ❌ WRONG: No error handling
const fetchProducts = async () => {  // No return type!
  products.value = (await axios.get('/api/products')).data;
};
```

#### ❌ Forbidden Patterns (TypeScript)
```typescript
// ❌ NO: @ts-ignore
const data: any = response.data;  // @ts-ignore  # FORBIDDEN

// ❌ NO: Unvalidated API responses
const product = (await api.get('/products/1')).data;  // Must validate with Zod

// ❌ NO: console.log() with emoji
console.log('🚀 Product loaded');  // FORBIDDEN

// ❌ NO: Inline styles
<div style="color: red;">Error</div>  <!-- Use Tailwind classes -->

// ❌ NO: Type casting
const id = response.id as number;  // FORBIDDEN - use validation instead

// ❌ NO: Implicit any
function process(data) {  // FORBIDDEN - must have types
  return data;
}
```

### Shared Standards (Python + TypeScript)

#### ✅ Logging (Structured Only)
```python
# Python
from bipdelivery.core.logger import Logger

Logger.info('Product created', {'sku': 'ABC-123', 'price': 99.99})
Logger.error('Stock check failed', {'product_id': 123, 'reason': 'database'})
```

```typescript
// TypeScript
import { Logger } from '@/services/logger';

Logger.info('Product created', { sku: 'ABC-123', price: 99.99 });
Logger.error('Stock check failed', { productId: 123, reason: 'database' });
```

Output format (structured, no emoji):
```
[INFO] Product created {"sku": "ABC-123", "price": 99.99}
[ERROR] Stock check failed {"productId": 123, "reason": "database"}
```

#### ✅ Error Handling (No Crashes)
- **Backend:** Always return DRF Response with proper status codes (200, 201, 400, 401, 403, 500)
- **Frontend:** Always catch errors, log to Logger, show toast to user
- **Never:** Let errors propagate unhandled

#### ✅ Comments (English-Only, Professional)
```python
# ✅ GOOD: Explains WHY
def calculate_availability(self) -> bool:
    """Determine if product is available for purchase.

    A product is available if quantity > 0 AND not marked as discontinued.
    """
    return self.stock_quantity > 0 and not self.is_discontinued

# ❌ BAD: No emojis, no Portuguese
# 🔥 🎯 THIS IS THE CRITICAL FUNCTION  ← FORBIDDEN
# ESSA FUNÇÃO TEM O LÓGICO IMPORTANTE ← FORBIDDEN (Portuguese)
```

---

## 5. Testing Protocol (State of Grace)

### Backend Testing (pytest)

**Configuration Files:**
- **Test runner:** pytest
- **Django integration:** pytest-django
- **Config file:** `pytest.ini` in root
- **Conftest location:** `bipdelivery/tests/conftest.py`
- **Django setup:** Must call `django.setup()` in conftest.py BEFORE any test runs

```ini
# pytest.ini
[pytest]
python_files = tests.py test_*.py *_tests.py
addopts = --nomigrations --reuse-db -v
testpaths = bipdelivery/tests
```

```python
# bipdelivery/tests/conftest.py
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bipdelivery.core.settings')
django.setup()  # ← CRITICAL: Must be called before imports
```

**Test Commands:**
```bash
# Run all tests
pytest -v

# Run specific test file
pytest bipdelivery/tests/test_products_api.py -v

# Run with coverage
pytest --cov=bipdelivery --cov-report=html

# Run single test
pytest bipdelivery/tests/test_products_api.py::test_create_product -v
```

### Frontend Testing (Vitest + Cypress)

**Unit Tests (Vitest):**
```bash
# Run all unit tests
npm run test:unit

# Watch mode (development)
npm run test:unit -- --watch

# With coverage
npm run coverage
```

**E2E Tests (Cypress):**
```bash
# Open Cypress GUI
npm run cypress:open

# Run headless
npm run cypress:run

# Run specific test file
npm run cypress:run -- --spec cypress/e2e/auth.cy.ts
```

**TypeScript Type Checking:**
```bash
# Check for type errors (no emit)
npm run typecheck
```

### Pre-Commit Validation (State of Grace)

**Husky hook runs automatically before commit:**
```bash
npx husky install  # One-time setup

# Hook checks:
# 1. Frontend: npm run typecheck (no 'any' types allowed)
# 2. Backend: Python syntax check
# 3. Summary: All checks must pass before commit
```

### Quality Gates (100% Pass Required)

| Test | Command | Required | Failure Action |
|------|---------|----------|----------------|
| pytest | `pytest bipdelivery/tests -v` | ✅ YES | Block commit |
| Vitest | `npm run test:unit` | ✅ YES | Block commit |
| TypeScript | `npm run typecheck` | ✅ YES | Block commit |
| Cypress E2E | `npm run test:e2e:run` | ✅ YES (before PR merge) | Block merge |

---

## 6. Quality Gates & Measurement

### Enforcement Checkpoints

**Every commit must pass:**
- ✅ Python syntax check (Ruff)
- ✅ Python format check (Black)
- ✅ TypeScript type check (tsc --noEmit)
- ✅ pytest (all tests)
- ✅ Vitest (all tests)

**Command:**
```powershell
.\check-integrity.ps1  # Run before every commit
```

**Exit Codes:**
- `0` = All checks passed (safe to commit)
- `1+` = Check failed (fix before committing)

### Metrics (Non-Negotiable)

| Metric | Target | Failure Action |
|--------|--------|----------------|
| Type coverage | 100% (no `any`) | Reject PR |
| Test pass rate | 100% | Block commit |
| Linting errors | 0 | Reject PR |
| Code duplication | None | Request refactor |
| Unhandled errors | 0 | Reject PR |
| TODO comments | 0 (tracked in issues) | Reject PR |

---

##  7. Git & Commit Workflow

### Branch Naming Convention
| Prefix | Purpose | Example |
|--------|---------|---------|
| `fix/` | Bug fixes | `fix/product-stock-calculation` |
| `feat/` | New features | `feat/product-inventory-sync` |
| `refactor/` | Code improvements | `refactor/composable-organization` |
| `docs/` | Documentation | `docs/api-authentication-guide` |
| `test/` | Testing additions | `test/product-crud-endpoints` |
| `chore/` | Dependencies, config | `chore/upgrade-django` |

### Commit Message Format (Semantic)
**Format:** `<type>: <description>`

```plaintext
✅ GOOD:
feat: add product image upload with validation
fix: correct stock availability calculation in useProducts
docs: update README with new API endpoints
refactor: extract product filtering logic to ProductService

❌ BAD:
Updated stuff
Fixed bug
WIP: working on things
URGENT: fix this now!!!
Updated things yesterday
```

### Pre-Commit Workflow
```powershell
# 1. Make changes
# 2. Run checks
.\check-integrity.ps1

# If PASS (exit code 0):
git add .
git commit -m "feat: add feature"
git push origin feat/your-feature

# If FAIL (exit code 1+):
# Fix issues and re-run check-integrity.ps1
```

---

## 8. Development Workflow (Daily Routine)

### Starting Work

```powershell
# 1. Navigate to project
cd BipFlow-Oficial

# 2. Activate venv (one-time per terminal session)
.\bootstrap-env.ps1

# 3. Pull latest changes
git pull origin main

# 4. Create feature branch
git checkout -b feat/your-feature

# 5. Keep venv active throughout session
```

### Backend Change Workflow

```bash
cd bipdelivery

# 1. Make model/view/serializer changes

# 2. Add type hints + docstrings

# 3. Run linting (auto-fix where possible)
ruff check . --fix
black . --line-length=100

# 4. Run tests
pytest bipdelivery/tests -v

# 5. Test locally if UI change
python manage.py runserver
# Open http://127.0.0.1:8000 in browser

# 6. If adding migration
python manage.py makemigrations
python manage.py migrate
```

### Frontend Change Workflow

```bash
cd bipflow-frontend

# 1. Edit Vue components, composables, or services

# 2. Ensure strict types (no any)

# 3. Check TypeScript  (must pass)
npm run typecheck

# 4. Run linting (auto-fix where possible)
npm run lint

# 5. Run unit tests
npm run test:unit

# 6. Test locally
npm run dev
# Open http://localhost:5173 in browser

# 7. If modifying user workflows
npm run test:e2e
# Or open Cypress: npm run cypress:open
```

### Committing Changes

```bash
# From project root (BipFlow-Oficial)

# 1. Stage changes
git add .

# 2. Run full integrity check
.\check-integrity.ps1

# If all checks pass (green output):

# 3. Commit
git commit -m "feat: add image upload feature"

# 4. Push branch
git push origin feat/your-feature

# 5. Open PR on GitHub
#    - Clear title + description
#    - Link related issues
#    - Wait for CI/CD
#    - Request review
#    - Squash merge when approved
```

---

## 9. Common Tasks & Commands

### Database Management

```bash
# Create migration after model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Django shell (interactive testing)
python manage.py shell
>>> from bipdelivery.api.models import Product
>>> Product.objects.all()

# Create admin superuser
python manage.py createsuperuser
```

### API Testing

```bash
# Get JWT access token
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Make authenticated request
curl http://127.0.0.1:8000/api/products/ \
  -H "Authorization: Bearer <access_token_here>"
```

### Frontend Debugging

```bash
# Check for TypeScript errors
npm run typecheck

# Check for ESLint errors
npm run lint

# Debug in browser
# 1. Open DevTools (F12)
# 2. Sources tab → Set breakpoints
# 3. Reload page
# 4. Step through code

# Check network requests
# 1. DevTools → Network tab
# 2. Filter by XHR
# 3. Inspect request/response
```

---

## 10. Known Caveats & Gotchas

### ⚠️ Common Mistakes

1. **Forgetting to activate venv**
   - Error: `ModuleNotFoundError: No module named 'django'`
   - Fix: Run `.\bootstrap-env.ps1` in PowerShell

2. **Mismatched Python versions**
   - Error: Syntax errors, import failures
   - Fix: Ensure Python 3.11+ (`python --version`)

3. **Missing `.env.local` in frontend**
   - Error: 404 calling API from browser
   - Fix: Create `bipflow-frontend/.env.local`:
     ```env
     VITE_API_URL=http://127.0.0.1:8000/api/
     ```

4. **Stale npm/pip caches**
   - Error: Old versions installed
   - Fix: Clean reinstall:
     ```bash
     npm ci --clean
     pip install --upgrade --force-reinstall -r requirements.txt
     ```

5. **Database migrations not applied**
   - Error: "Table doesn't exist"
   - Fix: `python manage.py migrate` before runserver

6. **Endpoints returning 201 instead of 200**
   - Issue: DRF returns 201 for POST create
   - Fix: Frontend handles both 200-299 range

### ⚠️ Performance Notes
- **N+1 queries:** Use `select_related()` / `prefetch_related()` in ViewSets
- **Category caching:** Changes rarely; frontend caches ~5min
- **Pagination:** Implement for list endpoints returning >10 items
- **Image compression:** On upload, not on serve
- **Batch operations:** Don't loop 1000 requests; batch them

---

## 11. AI Agent Guidelines

### When Asked About BipFlow, AI Should Know:

✅ **CORRECT:**
> "BipFlow is a Django 6.0 + Vue 3 delivery platform. Backend is DRF REST API with JWT. Frontend is TypeScript Composition API with Zod validation. SQLite dev / PostgreSQL prod. All functions explicit return types, no `any`. Logger service for logging. Toast component for feedback. Namespace: `bipdelivery`. Code duplication forbidden; refactoring means removal + replacement."

❌ **WRONG:**
> "Node.js backend. Console.log debugging. Use `any` types. Just append code."
> "React frontend. FastAPI backend. Generic `your_project` namespace."

### Questions Before Coding:
- Python or TypeScript? → Context determines approach
- Return type annotations? → Always yes
- Error handling? → Logger + Toast
- Emoji logging? → No: structure only
- Refactoring: append or replace? → REPLACE (remove old)
- Namespace correct? → Verify `bipdelivery`, not `core`
- Imports using @ alias? → Yes for frontend

---

## 12. Quick Reference

| Task | Command | Location |
|------|---------|----------|
| Setup | `.\bootstrap-env.ps1` | Root |
| Backend start | `python manage.py runserver` | `bipdelivery/` |
| Frontend start | `npm run dev` | `bipflow-frontend/` |
| Lint Python | `ruff check . --fix` | `bipdelivery/` |
| Format Python | `black . --line-length=100` | `bipdelivery/` |
| Typecheck | `npm run typecheck` | `bipflow-frontend/` |
| Lint TypeScript | `npm run lint` | `bipflow-frontend/` |
| Test Python | `pytest -v` | `bipdelivery/` |
| Test TypeScript | `npm run test:unit` | `bipflow-frontend/` |
| E2E tests | `npm run test:e2e` | `bipflow-frontend/` |
| Pre-commit check | `.\check-integrity.ps1` | Root |
| Migration (make) | `python manage.py makemigrations` | `bipdelivery/` |
| Migration (apply) | `python manage.py migrate` | `bipdelivery/` |
| Django shell | `python manage.py shell` | `bipdelivery/` |
| Create admin | `python manage.py createsuperuser` | `bipdelivery/` |

---

## Final Summary

### BipFlow Is:
- Django 6.0 + DRF + JWT (backend)
- Vue 3 + TypeScript strict (frontend)
- SQLite (dev) / PostgreSQL (prod)
- `bipdelivery` namespace (ALWAYS)
- Structured logging (no emoji/console)
- Errors → Logger → Toast (never alert)
- 100% type coverage (no `any`)
- 100% test pass rate

### What To Do:
✅ Explicit return types (Python + TypeScript)
✅ Docstrings / JSDoc comments
✅ Logger service for logging
✅ Toast component for feedback
✅ Full namespace (`from bipdelivery...`)
✅ @ alias for frontend imports
✅ Run `.\check-integrity.ps1` before push
✅ Semantic commits (`feat:`, `fix:`, `refactor:`)
✅ Replace code when refactoring (delete old)
✅ Validate API responses with Zod

### What NOT To Do:
❌ `any` types (Python/TypeScript)
❌ `console.log()` / `print()` logging
❌ `alert()` feedback
❌ Skip error handling
❌ Commit without pre-commit checks
❌ Leave untracked TODO/FIXME
❌ Mix Portuguese + English comments
❌ Code duplication
❌ Generic namespaces (`core`, `your_app`)
❌ Assume folder structure (always verify)

---

## Authoritative Statement

**This document is the canonical truth for BipFlow.**

If an LLM contradicts it based on general training, **trust this document.** This represents the real, tested, enterprise-grade architecture and standards.

**Edition:** 2.0 Enterprise
**Authority:** Principal Developer Experience Engineer
**Updated:** April 2026
**Status:** ✅ Authoritative Source of Truth
