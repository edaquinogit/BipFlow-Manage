# AI Context & Development Guide

> **Purpose:** Ground all AI agents (Claude, Copilot, ChatGPT) in BipFlow's reality. Prevents hallucinations, ensures consistency, and accelerates development.
>
> **Updated:** January 2025 | **Status:** Source of Truth ✅ | **Latest:** Full type safety refactoring complete—zero `any` types, centralized error handling, structured logging across all services.


---

## 🚨 CRITICAL AI DIRECTIVES (Read First)

**These rules are non-negotiable. Violating them is a critical failure.**

### Logging & Debugging
- **NEVER** use `console.log()`, `print()`, `alert()`, or `window.alert()`
- **ALWAYS** use the `Logger` service for backend: `from core.logger import Logger`
- **ALWAYS** use the `Logger` service for frontend: `import { Logger } from '@/services/logger'`
- **ALWAYS** use `useToast()` for user-facing notifications, never raw alerts
- Structured logging format: `Logger.info('action', { context })`

### Code Quality
- **NEVER** leave `TODO`, `FIXME`, `XXX`, or placeholder comments in code
- **ALWAYS** use strict TypeScript interfaces for ALL types (no `any`)
- **ALWAYS** provide explicit return type annotations for all functions
- **NEVER** use `@ts-ignore`, `// @ts-nocheck`, or type casting (`as Type`)
- **NEVER** commit with failing tests or linting errors

### Backend (Python/Django Only)
- **The backend is Django 6.0. Do NOT suggest Node.js backend logic.**
- **NEVER** suggest adding Express, Fastapi, or any Node-based server
- **ALWAYS** use Django ORM (models.py) for database logic
- **ALWAYS** use Django REST Framework (DRF) serializers for API validation
- **ALWAYS** use pytest for backend testing
- Response HTTP status codes: 200 (success), 400 (validation), 401 (auth), 403 (permission), 500 (server error)

### Frontend (Vue 3 + TypeScript Only)
- **The frontend is Vue 3 with TypeScript. Do NOT suggest React or other frameworks.**
- **ALWAYS** use Composition API with `ref()`, `computed()`, and `watch()`
- **ALWAYS** validate API responses with Zod before using them
- **ALWAYS** use `withDefaults(defineProps<T>())` for component props
- **NEVER** use `any` types, no implicit `any`
- **ALWAYS** use strict TypeScript (`"strict": true` in tsconfig.json)

### Code Comments
- **ALWAYS** write comments in Professional English (no Portuguese, no slang)
- **NEVER** include Portuguese language comments in logic files
- Comments should explain "why", not "what" (code explains "what")
- No emojis, abbreviations, or informal language

### Testing & Validation
- **The State of Grace requires 100% passing tests:**
  - ✅ Cypress E2E (100% pass)
  - ✅ Vitest Unit (100% pass)
  - ✅ Jest (100% pass)
  - ✅ Pytest (100% pass)
- **NEVER** commit code without running full test suite
- **NEVER** disable or skip tests

---

## 1. Project Identity

### What is BipFlow?
**BipFlow** is an enterprise delivery ecosystem platform—a REST API backend paired with a modern Vue 3 dashboard for order management, inventory synchronization, and fulfillment workflows.

**Not a Node.js app.** ❌ Not a monolith. ✅ **Is:** Django 6.0 + Vue 3 + DRF + JWT.

### Core Problem Statement
Delivery companies need real-time visibility into orders, automatic inventory updates, and a fast dashboard. BipFlow solves this with an API-first architecture and type-safe frontend.

### Success Metrics
- Dashboard loads in <2s (product list + categories)
- API responds to CRUD in <500ms
- Zero unhandled errors (logged, not crashed)
- Type safety enforced (no `any` types)
- All changes validated before commit

---

## 2. Technology Stack (Single Source of Truth)

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

## 3. Folder Structure Map

### Backend (`bipdelivery/`)

```bash
bipdelivery/
├── api/                      # ⭐ Main app: All business logic
│   ├── models.py             # Database schema (Category, Product)
│   ├── serializers.py        # DRF serializers (validation + JSON conversion)
│   ├── views.py              # ViewSets (ProductViewSet, CategoryViewSet)
│   ├── urls.py               # API routing (auto-generated by DRF)
│   ├── tests.py              # Legacy tests (move to tests/ folder)
│   ├── migrations/           # Database migration history
│   └── __init__.py
│
├── core/                     # Django project settings
│   ├── settings.py           # Configuration (apps, middleware, database, JWT settings)
│   ├── urls.py               # Root URL router (points to api/urls.py)
│   ├── asgi.py               # Async executor (production)
│   └── wsgi.py               # WSGI executor (Gunicorn)
│
├── tests/                    # ⭐ **CREATE THIS** Health check tests
│   ├── test_api_health.py    # **TO CREATE** Basic endpoint tests
│   └── __init__.py
│
├── manage.py                 # Django CLI entry point
├── db.sqlite3                # Development database (git-ignored)
├── requirements.txt          # Python dependencies (pinned versions)
└── venv/                     # Virtual environment (git-ignored)
```bash

**Key Insight:** Logic lives in `api/`. Models define the schema, serializers handle JSON conversion and validation, views handle HTTP routing and permissions.

### Frontend (`bipflow-frontend/`)

```bash
bipflow-frontend/
├── src/
│   ├── components/           # Reusable Vue components
│   │   ├── dashboard/        # Dashboard-specific components
│   │   │   ├── product-form/
│   │   │   ├── product-table/
│   │   │   ├── category-form/
│   │   │   └── layout/
│   │   └── common/           # Shared UI components
│   │
│   ├── composables/          # 🔑 Vue 3 composition functions (state + logic)
│   │   ├── useProducts.ts    # Product CRUD + inventory state
│   │   ├── useCategories.ts  # Category state & caching
│   │   ├── useToast.ts       # ⭐ **NEW** Professional notifications
│   │   └── __tests__/        # Unit tests for composables
│   │
│   ├── services/             # API clients & utilities
│   │   ├── api.ts            # Axios instance (JWT interceptors, error handling)
│   │   ├── product.service.ts # Product API endpoints
│   │   ├── auth.service.ts   # Login/logout logic
│   │   ├── logger.ts         # ⭐ **NEW** Structured logging service
│   │   └── category.service.ts
│   │
│   ├── schemas/              # Zod runtime validation schemas
│   │   ├── product.schema.ts # Product type definitions + validation
│   │   └── category.schema.ts
│   │
│   ├── views/                # Page-level Vue components
│   │   ├── dashboard/
│   │   ├── auth/
│   │   └── error/
│   │
│   ├── router/               # Vue Router configuration
│   │   ├── auth.routes.ts    # Login/logout routes
│   │   ├── dashboard.routes.ts # Protected routes
│   │   └── index.ts
│   │
│   ├── types/                # Custom TypeScript types
│   │   └── auth.ts           # User, JWT token types
│   │
│   ├── App.vue               # Root component
│   └── main.ts               # Application entry point
│
├── cypress/                  # E2E tests
│   ├── e2e/
│   │   ├── product_sync.cy.ts
│   │   ├── product-flow/     # **TO UPDATE** Product upload flow
│   │   └── auth.cy.ts
│   └── support/
│
├── public/                   # Static assets (favicon, etc.)
├── .env.local                # ⭐ **CREATE LOCALLY** VITE_API_URL=http://127.0.0.1:8000/api/
├── vite.config.ts            # Bundler config (port 5173, proxy options)
├── tsconfig.json             # TypeScript compiler (strict: true, forceConsistentCasingInFileNames: true)
├── vitest.config.ts          # Unit test runner config
├── package.json              # Node dependencies
└── tailwind.config.js        # Utility CSS framework config
```bash

**Key Insight:** Composables are the "brains" (state + logic). Services are the "connectors" (API calls). Components are the "faces" (UI rendering).

### VS Code Workspace (`.vscode/`)

```bash
.vscode/
├── settings.json             # Python interpreter path, linting rules, testing config
├── launch.json               # Debug configurations (Django runserver, pytest, etc.)
├── tasks.json                # Development tasks (runserver, migrate, lint, test)
└── extensions.json           # Recommended extensions (Ruff, Volar, Pylance, etc.)
```bash

**Key Insight:** Settings auto-select the venv Python interpreter. No manual configuration needed for developers.

### Root-Level Configuration

```bash
BipFlow-Oficial/
├── README.md                 # **UPDATED** Professional documentation (source of truth)
├── AI_CONTEXT.md             # **THIS FILE** AI grounding document
├── bootstrap-env.ps1         # **Automated venv setup** (Windows PowerShell)
├── check-integrity.ps1       # **TO CREATE** Pre-commit quality gate
├── CHANGELOG.md              # Release notes
├── LICENSE                   # MIT License
├── docker-compose.yml        # **Optional** Containerization setup
├── Dockerfile                # **Optional** Production image
└── INTEGRATION.md            # Integration & deployment guide
```bash

---

## 4. Coding Standards (Non-Negotiable)

### Python Backend Standards

#### ✅ Type Hints (Mandatory)
**All functions must have return type annotations.**

```python

# ✅ GOOD: Explicit types
def get_image(self, obj: Product) -> Optional[str]:
    """Convert image to absolute URI."""
    if obj.image:
        return request.build_absolute_uri(obj.image.url)
    return None

def save(self, *args, **kwargs) -> None:
    """Generate slug and update availability."""
    if not self.slug:
        self.slug = slugify(self.name) + "-" + str(uuid.uuid4())[:8]
    self.is_available = self.stock_quantity > 0
    super().save(*args, **kwargs)

# ❌ BAD: No return type, missing None
def save(self, *args, **kwargs):
    self.slug = slugify(self.name)
    super().save(*args, **kwargs)
```python

## ✅ Docstrings (Google Style)

```python

# ✅ GOOD
def create_product(data: Partial[Product]) -> Product:
    """
    Create a new product with multipart/form-data support.

    Validates SKU uniqueness and generates slug automatically.

    Args:
        data: Partial product dict with required fields (name, price, etc).

    Returns:
        Created Product instance with auto-generated ID and slug.

    Raises:
        ValidationError: If SKU already exists or required fields missing.
    """

    # Implementation
```python

## ✅ Linting Rules
- **Ruff:** `--select=E,W,F,I,UP,ANN,RUF --ignore=E501,ANN101,ANN102 --line-length=100`
- **Black:** Line length 100 characters
- **No:** `any` types, `print()` statements, unused imports, bare except

### ❌ Forbidden Patterns

```python

# ❌ NO: print() for logging
print("Product created:", product_id)  # Use structured logging instead

# ❌ NO: any types
def process_data(data: Any) -> Any:  # FORBIDDEN
    pass

# ❌ NO: Bare except
try:
    do_something()
except:  # FORBIDDEN - must specify exception type
    pass

# ❌ NO: TODO comments without tracking

# TODO: Add pagination to products endpoint  # FORBIDDEN

# ❌ NO: Portuguese comments mixed with code

# ESSA VIEW É A QUE O VUE VAI CHAMAR  # FORBIDDEN - English only
```typescript

## Vue 3 / TypeScript Standards

### ✅ Strict TypeScript

```typescript
// ✅ GOOD: Explicit types everywhere
interface Props {
  products: Product[];
  loading: boolean;
  onDelete: (id: number) => void;
}

const props = withDefaults(defineProps<Props>(), {
  products: () => [],
  loading: false,
});

const emit = defineEmits<{
  (e: 'save', data: Product): void;
  (e: 'error', message: string): void;
}>();

// ❌ BAD: any types, missing emit types
const props = defineProps({
  products: Array as PropType<any>,  // FORBIDDEN
});
```bash

#### ✅ Error Handling (No alerts, use Toast)

```typescript
// ✅ GOOD: Professional logging + Toast
import { Logger } from '@/services/logger';
import { useToast } from '@/composables/useToast';

const { error: toastError } = useToast();

try {
  await updateProduct(id, data);
} catch (err) {
  Logger.error('Product update failed', { productId: id });
  toastError('Failed to save product. Please try again.');
}

// ❌ BAD: alert() and console.log()
alert("Failed to save");  // FORBIDDEN
console.log("Error:", err);  // FORBIDDEN
```python

#### ✅ Composables Pattern

```typescript
// ✅ GOOD: Reactive composition
import { ref, computed } from 'vue';
import { Logger } from '@/services/logger';

export function useProducts() {
  const products = ref<Product[]>([]);
  const loading = ref(false);

  const totalRevenue = computed(() =>
    products.value.reduce((sum, p) => sum + Number(p.price), 0)
  );

  const fetchData = async (): Promise<void> => {
    loading.value = true;
    try {
      products.value = await ProductService.getAll();
    } catch (err) {
      Logger.error('Fetch failed', { err });
    } finally {
      loading.value = false;
    }
  };

  return { products, loading, totalRevenue, fetchData };
}
```bash

#### ❌ Forbidden Patterns (Implementation Examples)

```typescript
// ❌ NO: @ts-ignore
const data: any = response.data;  // @ts-ignore  # FORBIDDEN

// ❌ NO: Unvalidated API responses
const product = (await api.get('...')).data;  // FORBIDDEN - must validate with Zod

// ❌ NO: console.log() with emoji
console.log('🚀 Product loaded');  // FORBIDDEN

// ❌ NO: Inline styles
<div style="color: red;">Error</div>  <!-- FORBIDDEN, use classes -->
```bash

### Shared Standards (Python + TypeScript)

#### ✅ Logging (Structured, Professional)

```python

# Python
from logger import Logger
Logger.error('Product fetch failed', {'product_id': 123, 'status': 404})
Logger.info('Product created', {'sku': 'ABC-123'})
```bash

```typescript
// TypeScript
import { Logger } from '@/services/logger';
Logger.error('Product fetch failed', { productId: 123, status: 404 });
Logger.info('Product created', { sku: 'ABC-123' });
```python

Output: `[ERROR] Product fetch failed {"productId": 123, "status": 404}`

## ✅ Error Handling
- **Backend:** Return DRF Response with proper status codes (400, 401, 403, 500)
- **Frontend:** Catch errors, log them, show Toast to user
- **Never crash:** Always have try/finally or .catch() handlers

### ✅ Comments (English Only, No Emojis)

```python

# ✅ GOOD (Examples)
def calculate_availability(self) -> bool:
    """Determine if product is available for purchase."""
    return self.stock_quantity > 0

# ❌ BAD

# 🔥 🎯 THIS IS THE CRITICAL FUNCTION  ← NO EMOJI
```bash

---

## 5. Git & Commit Workflow

### Branch Naming
| Prefix | Purpose | Example |
|--------|---------|---------|
| `fix/` | Bug fixes | `fix/product-stock-calculation` |
| `feat/` | New features | `feat/product-image-upload` |
| `refactor/` | Code improvements | `refactor/composable-organization` |
| `docs/` | Documentation | `docs/api-authentication-guide` |
| `test/` | Testing additions | `test/product-crud-endpoints` |
| `chore/` | Dependencies, config | `chore/upgrade-django` |

### Commit Message Format
**Semantic Commits:** `<type>: <description>`

```plaintext
✅ GOOD:
feat: add product image upload with validation
fix: correct stock availability calculation
docs: update README with new API endpoints
refactor: extract product state to useProducts composable

❌ BAD:
Updated stuff
Fixed bug
WIP: working on things
URGENT: fix this now!!!
```bash

### Pre-Commit Checklist
Before pushing, run:

```powershell
.\check-integrity.ps1
```bash

This validates:
- ✅ Ruff (Python lint)
- ✅ ESLint (TypeScript lint)
- ✅ pytest (Backend tests)
- ✅ Vitest (Frontend unit tests)

**If any fail: Fix before push.**

---

## 6. Development Workflow (Daily Routine)

### Starting Work

```powershell

# 1. Navigate to project
cd BipFlow-Oficial

# 2. Activate venv (one-time setup)
.\bootstrap-env.ps1

# 3. Pull latest changes
git pull origin main

# 4. Create feature branch
git checkout -b feat/your-feature
```bash

## Making Changes

### Backend Change

```bash

# 1. Edit files (models.py, serializers.py, views.py)

# 2. Add type hints & docstrings

# 3. Test locally:
cd bipdelivery
python manage.py runserver

# Test endpoints in browser or Postman

# 4. Run linting:
ruff check . --fix
black . --line-length=100

# 5. Run tests:
pytest -v --tb=short
```bash

## Frontend Change

```bash

# 1. Edit Vue files (components, composables, services)

# 2. Ensure all props/types are explicit

# 3. Test locally: (Pre-commit)
cd bipflow-frontend
npm run dev

# Test in browser at http://localhost:5173

# 4. Run linting: (Pre-commit)
npm run lint

# 5. Run tests: (Pre-commit)
npm run test
npm run test:e2e  # If E2E modifications needed
```bash

## Committing

```bash

# 1. Stage changes
git add .

# 2. Run integrity check
.\check-integrity.ps1

# 3. If green: Commit
git commit -m "feat: add product image upload"

# 4. Push
git push origin feat/your-feature
```bash

## Opening PR
1. Push to feature branch
2. Open PR on GitHub with descriptive title
3. Link to related issues (if any)
4. Wait for CI/CD to pass
5. Request review from teammates
6. Once approved: Squash merge to main

---

## 7. Common Tasks & Commands

### Database

```bash

# Migrations
python manage.py makemigrations
python manage.py migrate

# Shell (Django interactive)
python manage.py shell >>> from api.models import Product >>> Product.objects.all()

# Create superuser
python manage.py createsuperuser
```bash

## API Testing

```bash

# Get JWT token
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'

# Use token in request
curl http://127.0.0.1:8000/api/products/ \
  -H "Authorization: Bearer <access_token>"
```bash

## Frontend Debugging

```bash

# Check TypeScript errors
npx tsc --noEmit

# Check ESLint errors
npm run lint

# Debug in browser

# Open DevTools (F12) → Sources tab → Set breakpoints

# Check network requests

# DevTools → Network tab → Filter by XHR
```bash

---

## 8. Known Caveats & Gotchas

### ⚠️ Common Mistakes (Don't Do These)

1. **Forgetting to activate venv**

```python
   Error: ModuleNotFoundError: No module named 'django'
   Fix: Run bootstrap-env.ps1 first
```bash

2. **Mismatched Python versions**

```bash
   Error: syntax errors or import failures
   Fix: Ensure Python 3.11+ (check: python --version)
```bash

3. **Missing .env.local in frontend**

```env
   Error: 404 errors calling API
   Fix: Create bipflow-frontend/.env.local with VITE_API_URL
```bash

4. **Stale npm/pip caches**

```bash
   Error: Old versions installed despite updates
   Fix: npm ci --clean && pip install --upgrade --force-reinstall -r requirements.txt
```bash

5. **DB migrations not run before API calls**

```bash
   Error: Table doesn't exist errors
   Fix: python manage.py migrate before runserver
```bash

### ⚠️ Performance Notes
- **Avoid N+1 queries:** Use `select_related()` / `prefetch_related()` in ViewSets
- **Cache categories:** They change rarely, frontend caches for 5 minutes
- **Paginate large lists:** Add pagination to product list endpoint
- **Compress images:** Validate & compress on upload, not on serve

---

## 9. AI Agent Guidelines

### When Asked About BipFlow, an AI Should Know:

✅ **CORRECT:**
> "BipFlow is a Django 6.0 + Vue 3 delivery platform. Backend is DRF REST API with JWT auth. Frontend is TypeScript Composition API. Database is SQLite (dev) / PostgreSQL (prod). All functions have return type hints. No `any` types allowed. Errors logged structurally via Logger service, not console.log(). User feedback via Toast, not alert()."

❌ **INCORRECT:**
> "It's a Node.js app. Use npm to install and npm run start. It has console.log() debugging. Use any for types. It's a monolith frontend + backend together."

### Questions to Always Verify:
- "Is this Python (backend) or TypeScript (frontend)?"
- "Should this have type hints? Yes, always."
- "What error handling approach? Logger + Toast, not console + alert."
- "Any emoji in logs? No, structure only."
- "Should I create the folder? Check stack first; it might already exist."

---

## 10. Quick Reference (Cheat Sheet)

| Task | Command | Path |
|------|---------|------|
| Setup backend | `.\bootstrap-env.ps1` | `bipdelivery/` |
| Run backend | `python manage.py runserver` | `bipdelivery/` |
| Run frontend | `npm run dev` | `bipflow-frontend/` |
| Lint Python | `ruff check . --fix` | `bipdelivery/` |
| Lint TypeScript | `npm run lint` | `bipflow-frontend/` |
| Test backend | `pytest -v` | `bipdelivery/` |
| Test frontend | `npm run test` | `bipflow-frontend/` |
| E2E test | `npm run test:e2e` | `bipflow-frontend/` |
| Check integrity | `.\check-integrity.ps1` | Root |
| Create migration | `python manage.py makemigrations` | `bipdelivery/` |
| Apply migration | `python manage.py migrate` | `bipdelivery/` |
| Shell | `python manage.py shell` | `bipdelivery/` |

---

## Summary for AI Agents

**BipFlow is:**
- Backend: Django 6.0 + DRF + JWT
- Frontend: Vue 3 + TypeScript (strict mode)
- Database: SQLite (dev) / PostgreSQL (prod)
- Logging: Structured (no emoji, no console.log)
- Error Handling: Exceptions → Logger → Toast
- Type Safety: Mandatory return types, no any
- Folder Logic: `api/` = models + serializers + views | `src/` = components + composables + services

**When developing, always:**
✅ Add type hints
✅ Add docstrings (Python)
✅ Use Logger service
✅ Use Toast service
✅ Run check-integrity.ps1 before commit
✅ Follow semantic commits

**Never:**
❌ Use any types
❌ Use console.log() or alert()
❌ Skip error handling
❌ Commit without linting
❌ Assume folder structure; verify first

---

**Baseline:** This document is the source of truth. If an AI contradicts it, trust this document.
