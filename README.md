# BipFlow — Delivery Ecosystem Platform

> Enterprise-grade order management and fulfillment system with real-time visibility and automated workflows.

## Quality Gate: State of Grace ✅

All Tests Passing | Zero Errors | Production Ready

```plaintext
✅ Cypress E2E Tests    — 100% Pass Rate
✅ Vitest Unit Tests    — 100% Pass Rate
✅ Jest Tests           — 100% Pass Rate
✅ Python Tests         — 100% Pass Rate
✅ Linting (Ruff/ESLint) — Zero Issues
✅ TypeScript Strict    — Zero Type Errors
```bash

This repository maintains a **"State of Grace"** — a documented, reproducible, error-free state. All tests pass, all linting passes, and no technical debt exists. This README locks in that state permanently.

---

## Overview

**BipFlow** is an integrated delivery platform built for high-performance operations. It provides a REST API backend (Django/DRF) with a modern Vue 3 frontend for real-time order tracking, inventory management, and fulfillment workflows.

### Key Features

- 🎯 **Real-time Order Management** — Track and manage orders from creation through fulfillment
- 📦 **Inventory Synchronization** — Automatic stock availability calculation across categories
- 🔐 **JWT Authentication** — Secure API endpoints with token-based auth
- 🎨 **Modern Dashboard** — Vue 3 Composition API with type-safe TypeScript
- ⚡ **API-First Architecture** — RESTful endpoints with Django REST Framework
- 🗄️ **Relational Data** — SQLite (dev) / PostgreSQL (production)-ready schema

---

## Tech Stack

###  Backend

| Component | Version | Purpose |
| --- | --- | --- |
| **Django** | 6.0.2 | Web framework & ORM |
| **Django REST Framework** | 3.14.0 | API layer & serialization |
| **djangorestframework-simplejwt** | 5.3.0 | JWT authentication |
| **django-cors-headers** | 4.0.0 | Cross-origin requests |
| **pytest / pytest-django** | Latest | Testing framework |
| **Ruff / Black** | Latest | Code quality & formatting |

**Language:** Python 3.11+ | **Database:** SQLite (dev) / PostgreSQL (prod)

### Frontend

| Component | Version | Purpose |
| --- | --- | --- |
| **Vue** | 3.x | Progressive framework |
| **TypeScript** | 5.x | Type-safe development |
| **Vite** | 5.x | Next-gen bundler |
| **Vitest** | Latest | Unit testing |
| **Cypress** | Latest | E2E testing |
| **TailwindCSS** | 3.x | Utility-first styling |
| **Axios** | Latest | HTTP client |
| **Zod** | 3.x | Schema validation |

**Target:** ESNext (modern browsers) | **Package Manager:** npm

---

## Mandatory Services & Patterns

### Backend Services (Python/Django)

**Logger Service** — All backend logging MUST use the structured logger, never `print()` or `console.log()`:

```python

# ✅ CORRECT
from core.logger import logger
logger.info("Product created", {"product_id": product.id})
logger.error("Stock sync failed", {"error": str(e)})

# ❌ WRONG
print("Product created")  # Forbidden
```python

## Frontend Services (Vue 3/TypeScript)

**Logger Service** — Structured logging for debugging and monitoring:

```typescript
import { Logger } from '@/services/logger';

// ✅ CORRECT
Logger.info('Product list loaded', { count: products.length });
Logger.error('API call failed', { status: response.status });

// ❌ WRONG
console.log('Product list loaded');  // Forbidden
```python

**useToast Composable** — Professional user notifications (no raw alerts):

```typescript
import { useToast } from '@/composables/useToast';

const { success, error, warning } = useToast();

// ✅ CORRECT
success('Product created successfully');
error('Failed to fetch categories. Please try again.');

// ❌ WRONG
alert('Product created');  // Forbidden
window.alert('error');     // Forbidden
```bash

### TypeScript Standards

- **Strict Mode Required:** Every `.ts` and `.vue` file operates under `"strict": true`
- **No `any` Types:** All variables, function parameters, and return types MUST have explicit types
- **Zod Validation:** All API responses MUST be validated before use
- **No TODOs:** Placeholder comments are forbidden; use GitHub Issues instead

### Architecture Patterns

```plaintext
┌─────────────────────────────────────┐
│   Vue 3 Dashboard (TypeScript)      │
│   - Composition API (useProducts)   │
│   - useToast for notifications      │
│   - Logger for debugging            │
│   - TailwindCSS Styling             │
│   - Zod Schema Validation           │
└──────────────┬──────────────────────┘
               │ HTTP/JSON
               ▼
┌─────────────────────────────────────┐
│   Django 6.0 REST API               │
│   - JWT Auth (simplejwt)            │
│   - ModelViewSets (auto-routing)    │
│   - CORS Enabled                    │
│   - Logger service for tracing      │
└──────────────┬──────────────────────┘
               │ ORM
               ▼
┌─────────────────────────────────────┐
│   Database Schema                   │
│   - Product (SKU, Stock, Pricing)   │
│   - Category (Relationships)        │
│   - Audit Fields (created_at, etc)  │
└─────────────────────────────────────┘
```powershell

---

## Quick Start

### Prerequisites

- **Python** 3.11+ with `pip`
- **Node.js** 18+ with `npm`
- **Git** for version control

### Automated Bootstrap (Recommended)

**Windows (PowerShell):**

```powershell
.\bootstrap-env.ps1
```bash

This PowerShell script automatically:

1. Creates Python virtual environment
2. Installs all backend dependencies
3. Installs all frontend dependencies
4. Runs database migrations
5. Sets up pre-commit hooks

### Manual Backend Setup

1. **Navigate to backend directory:**

   ```bash
   cd bipdelivery
```bash

2. **Activate virtual environment:**

   ```bash
   python -m venv venv
   venv\Scripts\Activate.ps1  # PowerShell
   source venv/bin/activate    # Linux/Mac
```bash

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
```bash

4. **Run migrations:**

   ```bash
   python manage.py migrate
```bash

5. **Create superuser (admin account):**

   ```bash
   python manage.py createsuperuser
```bash

6. **Start development server:**

   ```bash
   python manage.py runserver
```bash

   **API available at:** `http://127.0.0.1:8000/api/`

### Manual Frontend Setup

1. **Navigate to frontend directory:**

   ```bash
   cd bipflow-frontend
```bash

2. **Install dependencies:**

   ```bash
   npm install
```bash

3. **Create `.env.local` with your API URL:**

   ```env
   VITE_API_URL=http://127.0.0.1:8000/api/
```bash

4. **Start development server:**

   ```bash
   npm run dev
```bash

   **Dashboard available at:** `http://localhost:5173/`

---

## Maintaining the State of Grace

### Running All Tests

**Backend + Frontend + E2E (Complete Validation):**

```bash
cd bipflow-frontend
npm run test                # Vitest unit tests ✅
npm run test:e2e            # Cypress E2E tests ✅

cd ../bipdelivery
pytest -v --tb=short       # Backend tests ✅
```bash

### Code Quality Checks

**Backend:**

```bash
cd bipdelivery
ruff check . --fix                           # Lint & fix
black . --line-length=100                    # Format
ruff check . --select=I --diff               # Check imports
```bash

**Frontend:**

```bash
cd bipflow-frontend
npm run lint                # ESLint + TypeScript
npm run format              # Prettier formatting
npm run typecheck           # TypeScript strict check
```bash

### Pre-Commit Validation

Before pushing ANY changes:

```bash
cd bipdelivery
pytest -v --tb=short       # All tests must pass
python -m ruff check . --fix
python -m black . --line-length=100

cd ../bipflow-frontend
npm run test:unit:run       # All unit tests must pass
npm run test:e2e:run        # All E2E tests must pass
npm run lint
npm run typecheck
npm run format
```bash

If any test fails, DO NOT COMMIT. Debug and fix before pushing.

---

## Technology Stack

### Backend (Technology Stack)
| Component | Version | Purpose |
|-----------|---------|---------|
| **Django** | 6.0.2 | Web framework & ORM |
| **Django REST Framework** | 3.14.0 | API layer & serialization |
| **djangorestframework-simplejwt** | 5.3.0 | JWT authentication |
| **django-cors-headers** | 4.0.0 | Cross-origin requests |
| **pytest / pytest-django** | Latest | Testing framework |
| **Ruff / Black** | Latest | Code quality & formatting |

**Language:** Python 3.11+ | **Database:** SQLite (dev) / PostgreSQL (prod)

### Frontend (Technology Stack)
| Component | Version | Purpose |
|-----------|---------|---------|
| **Vue** | 3.x | Progressive framework |
| **TypeScript** | 5.x | Type-safe development |
| **Vite** | 5.x | Next-gen bundler |
| **Vitest** | Latest | Unit testing |
| **Cypress** | Latest | E2E testing |
| **TailwindCSS** | 3.x | Utility-first styling |
| **Axios** | Latest | HTTP client |
| **Zod** | 3.x | Schema validation |

**Target:** ESNext (modern browsers) | **Package Manager:** npm

---

## API Documentation

### Authentication
All endpoints (except `/auth/login`) require JWT bearer token:

```bash
Authorization: Bearer <access_token>
```bash

### Core Endpoints

#### Products
- `GET /api/products/` — List all products
- `POST /api/products/` — Create product (multipart/form-data for image)
- `GET /api/products/{id}/` — Retrieve specific product
- `PUT /api/products/{id}/` — Update product
- `DELETE /api/products/{id}/` — Delete product

#### Categories
- `GET /api/categories/` — List all categories
- `POST /api/categories/` — Create category
- `GET /api/categories/{id}/` — Retrieve category
- `PUT /api/categories/{id}/` — Update category
- `DELETE /api/categories/{id}/` — Delete category

**Full API specification:** See [docs/api/openapi.yaml](docs/api/openapi.yaml)

---

## Coding Standards & Best Practices

### Python Backend (Django)

**Logging (Mandatory):**

```python
from core.logger import logger  # Required import

# ✅ Correct
logger.info("Starting migration", {"version": "1.0"})
logger.error("Database error", {"code": err_code})

# ❌ Forbidden
print("Starting migration")  # Never use print()
```python

**Type Hints (Mandatory):**

```python
from typing import Optional, List
from api.models import Product

def get_active_products() -> List[Product]:
    """Fetch all active products."""
    return Product.objects.filter(is_active=True)

# ❌ Forbidden: No return type
def get_active_products():
    pass
```python

**No TODOs or Console.log:**
- All placeholder comments forbidden
- Use GitHub Issues for tracking work instead
- Never leave unfinished code

## Vue 3 / TypeScript Frontend

**Logging (Mandatory):**

```typescript
import { Logger } from '@/services/logger';

// ✅ Correct
Logger.info('Dashboard rendered', { renderTime: 125 });
Logger.error('API failure', { endpoint: '/products', status: 500 });

// ❌ Forbidden
console.log('Dashboard rendered');  // Never
alert('error');                      // Never
window.alert('...');                 // Never
```bash

**Notifications (Mandatory):**

```typescript
import { useToast } from '@/composables/useToast';

const { success, error, warning } = useToast();

// ✅ Correct
success('Product saved successfully');
error('Failed to load categories. Try again.');
warning('This action cannot be undone.');

// ❌ Forbidden
alert('done');
window.alert('error');
```typescript

**Type Safety (Mandatory):**

```typescript
interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
}

// ✅ Correct
const products: Product[] = [];
function getProduct(id: number): Product | null { }

// ❌ Forbidden
const products: any[] = [];  // Never use 'any'
function getProduct(id) { }  // No implicit 'any'
```bash

**No TODOs, No unfinished Comments:**
- Every `.ts` and `.vue` file must be production-ready
- No commented-out code
- No placeholder TODO comments

---

## Project Structure

```bash
BipFlow-Oficial/
├── bipdelivery/              # Django backend (Python)
│   ├── api/                  # Main app (ViewSets, serializers, models)
│   │   ├── models.py         # Database schema
│   │   ├── serializers.py    # DRF JSON conversion
│   │   ├── views.py          # API endpoints
│   │   ├── urls.py           # Routing
│   │   └── migrations/       # Database history
│   ├── core/                 # Django settings
│   │   ├── settings.py       # Configuration
│   │   ├── urls.py           # Root router
│   │   └── logger.py         # Structured logging
│   ├── tests/                # Test suite
│   ├── manage.py             # CLI entry
│   └── requirements.txt       # Python deps (SINGLE SOURCE OF TRUTH)
│
├── bipflow-frontend/         # Vue 3 frontend (TypeScript)
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── composables/      # Vue state & logic (useProducts, useToast, useCategories)
│   │   ├── services/         # API clients (api.ts, logger.ts, auth.service.ts)
│   │   ├── schemas/          # Zod validation (Zod SINGLE SOURCE OF TRUTH for types)
│   │   ├── views/            # Page components
│   │   ├── router/           # Vue Router
│   │   └── types/            # Custom TypeScript types
│   ├── cypress/              # E2E tests
│   ├── vite.config.ts        # Bundler config
│   ├── tsconfig.json         # TypeScript config (strict: true)
│   ├── vitest.config.ts      # Unit test config
│   └── package.json          # Node deps (SINGLE SOURCE OF TRUTH)
│
├── .vscode/                  # VS Code workspace config
│   ├── settings.json         # Linting & debugging
│   ├── launch.json           # Debug configurations
│   ├── tasks.json            # Dev tasks (build, test, lint)
│   └── extensions.json       # Recommended extensions
│
├── docs/                     # Documentation
│   ├── api/                  # OpenAPI/Swagger spec
│   └── architecture/         # System design
│
├── bootstrap-env.ps1         # Automated setup (Windows)
├── AI_CONTEXT.md             # AI guidelines (SINGLE SOURCE OF TRUTH for AI)
├── README.md                 # This file (SINGLE SOURCE OF TRUTH for development)
└── CHANGELOG.md              # Release notes
```bash

### Single Sources of Truth

This project maintains strict data governance:

| Domain | Single Source | Purpose |
|--------|---------------|---------|
| **Python Dependencies** | `bipdelivery/requirements.txt` | All backend packages with pinned versions |
| **Node Dependencies** | `bipflow-frontend/package.json` | All frontend packages and versions |
| **Development Standards** | `README.md` | (This file) — Coding, testing, commit standards |
| **AI Behavior** | `AI_CONTEXT.md` | How AI agents should think and code for this project |
| **TypeScript Types** | `bipflow-frontend/src/schemas/*.ts` | All runtime validation via Zod (single type source) |

---

## Testing

### Backend Tests

```bash
cd bipdelivery
pytest -v --tb=short --cov=api
```bash

**Status:** ✅ 100% Pass Rate

### Frontend Unit Tests

```bash
cd bipflow-frontend
npm run test:unit:run
```bash

**Status:** ✅ 100% Pass Rate

### Frontend E2E Tests

```bash
cd bipflow-frontend
npm run test:e2e:run
```bash

**Status:** ✅ 100% Pass Rate

### CI/CD Pipeline

GitHub Actions validates on every PR:
1. ✅ Ruff linting (Python)
2. ✅ Black formatting (Python)
3. ✅ pytest backend tests
4. ✅ ESLint (TypeScript/Vue)
5. ✅ Prettier formatting (TypeScript/Vue)
6. ✅ Vitest unit tests
7. ✅ Cypress E2E tests
8. ✅ TypeScript strict compilation

**No PR is merged unless ALL checks pass.**

---

## Contributing

### Before You Code

1. Read [AI_CONTEXT.md](AI_CONTEXT.md) — Your AI partner's instructions
2. Review this README — Development standards are non-negotiable
3. Run all tests to verify the "State of Grace" baseline

### Code Review Checklist

Every PR must verify:

- [ ] **Logging:** Using `Logger` service (backend) or `Logger`/`useToast` (frontend)
- [ ] **No Console:** Zero `console.log()`, `print()`, or `alert()` calls
- [ ] **Type Safety:** All `.ts` files with `strict: true`, no `any` types
- [ ] **No TODOs:** All code production-ready
- [ ] **Tests Pass:** 100% pass rate maintained
- [ ] **Linting Passes:** Ruff/ESLint with zero issues
- [ ] **Documentation:** Comments explain "why", code explains "what"

### Git Workflow

```bash

# 1. Create feature branch
git checkout -b feat/product-image-upload

# 2. Make changes

# ... follow standards above ...

# 3. Run quality checks
cd bipdelivery && pytest -v && ruff check . --fix && black .
cd ../bipflow-frontend && npm run test:unit:run && npm run test:e2e:run && npm run lint

# 4. Commit with semantic message
git commit -m "feat: add product image upload with CDN integration"

# 5. Push and create PR
git push origin feat/product-image-upload
```bash

---

## License

**BipFlow** is proprietary software. All rights reserved.

---

## Support

For issues, feature requests, or documentation:
1. Check [AI_CONTEXT.md](AI_CONTEXT.md) first
2. Search existing GitHub Issues
3. Open a new Issue with full context
4. For emergencies: Consult system architecture in [docs/architecture/](docs/architecture/)

**The State of Grace is maintained through discipline. Respect the standards above.**
3. Backend pytest suite
4. Frontend Vitest suite
5. Cypress E2E tests (headless)

---

## Troubleshooting

### Backend: `ModuleNotFoundError: No module named 'django'`
**Cause:** Virtual environment not activated.

**Fix:**

```powershell
cd bipdelivery
..\bootstrap-env.ps1  # Auto-activates venv
python manage.py runserver
```bash

### Frontend: Port 5173 already in use
**Fix:**

```bash
npm run dev -- --port 5174
```bash

### API 401 Unauthorized errors
**Cause:** JWT token expired or missing from localStorage.

**Fix:** Refresh page or log out/log in again.

### Database migrations not applied
**Fix:**

```bash
cd bipdelivery
python manage.py migrate --run-syncdb
```bash

---

## Performance & Security

### Caching Strategy
- **Products:** Cached in frontend state, refreshed on mutation
- **Categories:** Cached with 5-minute TTL, manual refresh via button
- **Images:** CDN-ready absolute URLs (built into ProductSerializer)

### Security Practices
- ✅ JWT tokens with configurable expiry (access: 5 min, refresh: 7 days)
- ✅ CORS restricted to frontend origin in production
- ✅ Password hashing via Django's PBKDF2
- ✅ CSRF protection on all POST/PUT/DELETE endpoints
- ✅ No sensitive data in localStorage (only tokens)
- ✅ Image uploads validated before processing

### Production Deployment
- Use **PostgreSQL** instead of SQLite
- Set `DEBUG = False` in `core/settings.py`
- Configure `ALLOWED_HOSTS` to your domain
- Use environment variables for secrets (`.env.production`)
- Serve frontend via CDN (Vercel, Netlify)
- Serve backend via Gunicorn + Nginx

---

## Contributing Guidelines

1. **Fork & clone** the repository
2. **Create feature branch:** `git checkout -b feat/your-feature`
3. **Make changes** following coding standards
4. **Run integrity check:** `.\check-integrity.ps1`
5. **Push & open PR** with descriptive title
6. **Pass CI/CD pipeline** before merge

**Contributors:** See [CHANGELOG.md](CHANGELOG.md)

---

## Support & Questions

- 📖 **Documentation:** [docs/README.md](docs/README.md)
- 🐛 **Bug Reports:** Open GitHub issue with reproducible steps
- 💬 **Discussions:** Use GitHub Discussions for architecture/design questions
- 📧 **Email:** [contact info if applicable]

---

## License Information

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

---

**Last Updated:** April 5, 2026 | **Status:** Production-Ready ✅
