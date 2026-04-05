# 01 - ARCHITECTURE & SYSTEM DESIGN

> The "How" of BipFlow — technical structure, patterns, and design decisions

## Overview

This level documents the **system architecture**, **design patterns**, **data models**, and **system flows** that implement the requirements from Discovery level.

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                     BIPFLOW SYSTEM ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              FRONTEND LAYER (Vue 3 + TypeScript)        │   │\n│  │  ├─ Components (Feature-based)                          │   │
│  │  ├─ Composables (State Management)                      │   │
│  │  ├─ Services (API Communication via Axios)             │   │
│  │  └─ Schemas (Zod Validation)                           │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │ HTTP/REST                             │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │           API GATEWAY LAYER (Django REST)              │   │
│  │  ├─ Authentication (JWT via drf-simplejwt)             │   │
│  │  ├─ Routing (URL pattern matching)                     │   │
│  │  └─ CORS (corsheaders middleware)                      │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │        BUSINESS LOGIC LAYER (Django Apps)              │   │
│  │  ├─ ProductViewSet (CRUD + Pagination)                 │   │
│  │  ├─ CategoryViewSet (CRUD)                             │   │
│  │  ├─ Serializers (Data Transformation)                  │   │
│  │  └─ Models (ORM Layer)                                 │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │ ORM                                    │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │         PERSISTENCE LAYER (PostgreSQL)                 │   │
│  │  ├─ Category TABLE (id, name, slug)                    │   │
│  │  └─ Product TABLE (id, sku, name, ..., category_id)   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Category Entity

```text
Category
├─ id (PK, Auto)
├─ name (STRING, UNIQUE)
├─ slug (STRING, UNIQUE, Auto-generated)
├─ created_at (TIMESTAMP, Auto)
└─ products (FK Relation, Product.category)
```

### Product Entity

```text
Product
├─ id (PK, Auto)
├─ sku (STRING, UNIQUE, Nullable) — Stock Keeping Unit
├─ category_id (FK → Category, Protected Delete)
├─ name (STRING)
├─ slug (STRING, UUID-based)
├─ description (TEXT)
├─ price (DECIMAL)
├─ size (STRING, Nullable)
├─ stock_quantity (INTEGER, Default=0)
├─ is_available (BOOLEAN, Auto-calculated)
├─ image (FILE UPLOAD)
├─ created_at (TIMESTAMP, Auto)
└─ updated_at (TIMESTAMP, Auto)
```

### Indexes

- `products.sku` — Fast lookup by barcode
- `products.category, products.created_at` — Efficient category filtering + sorting

## API Endpoints (REST)

| Endpoint | Method | Purpose | Auth |
| --- | --- | --- | --- |
| `/api/auth/token/` | POST | JWT login | None |
| `/api/v1/products/` | GET | List products (paginated) | JWT |
| `/api/v1/products/` | POST | Create product | JWT |
| `/api/v1/products/{id}/` | GET | Retrieve product | JWT |
| `/api/v1/products/{id}/` | PATCH/PUT | Update product | JWT |
| `/api/v1/products/{id}/` | DELETE | Delete product | JWT |
| `/api/v1/categories/` | GET | List categories | JWT |
| `/api/v1/categories/` | POST | Create category | JWT |
| `/api/v1/categories/{id}/` | GET/PATCH/DELETE | Category CRUD | JWT |
| `/api/docs/` | GET | Swagger UI | None |
| `/api/redoc/` | GET | ReDoc UI | None |

## Frontend Architecture

### Component Structure (Feature-Based)

```text
src/
├─ components/
│  ├─ common/            (Reusable: FormInput, Sidebar, etc.)
│  └─ dashboard/
│     ├─ category-form/  (Category CRUD)
│     ├─ product-form/   (Product CRUD with image upload)
│     ├─ product-table/  (Product listing with filters)
│     ├─ stats/          (Dashboard metrics)
│     └─ layout/         (Navigation, page structure)
│
├─ composables/
│  ├─ useProducts.ts     (Product state + API calls)
│  ├─ useCategories.ts   (Category state + API calls)
│  └─ useProductState.ts (Shared product form state)
│
├─ services/
│  ├─ product.service.ts (Product API layer)
│  ├─ category.service.ts (Category API layer)
│  └─ api.ts             (Axios instance with interceptors)
│
├─ schemas/
│  └─ product.schema.ts  (Zod validation rules)
│
└─ types/
   ├─ auth.ts            (Login, JWT types)
   └─ ...                (Other domain types)
```

### State Management Pattern

- **Composables** use Vue 3 Composition API for reactive state
- **5-minute cache TTL** to reduce API calls
- **Optimistic updates** with automatic rollback on failure
- **Granular loading states** (isLoading, error, data)

## Design Patterns Applied

| Pattern | Location | Purpose |
| --- | --- | --- |
| **Service Layer** | `src/services/` | Separate API communication from UI |
| **Singleton (Composables)** | `useProducts()` | Single source of truth for state |
| **Repository Pattern** | ViewSet classes | Abstract DB access for business logic |
| **Dependency Injection** | Serializers | Decouple data transformation from views |
| **Data Mapper** | `serializers.py` | Transform between API/ORM representations |

## Security Architecture

1. **Authentication**:  - JWT Bearer tokens issued by `/api/auth/token/`
   - Tokens validated on every protected endpoint
   
2. **Authorization**:
   - Row-level access control (future: teams/organizations)
   - Currently all authenticated users = same data access

3. **Transport Security**:
   - HTTPS enforced in production
   - CORS restricted to whitelisted domains

4. **Data Validation**:
   - Frontend: Zod schema validation
   - Backend: DRF serializer validation
   - Double validation ensures defense-in-depth

---

## Navigation

- **Previous**: [00-discovery/](../00-discovery/README.md) - Requirements and goals
- **Next**: [02-api-specs/](../02-api-specs/README.md) - Detailed API contracts
- **Related**: [03-frontend/](../03-frontend/README.md) - Frontend component rules
