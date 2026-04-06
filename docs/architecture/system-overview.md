# System Architecture Overview

> High-level system design and component interactions for BipFlow delivery ecosystem

---

## Architecture Diagram

```plaintext
┌─────────────────────────────────────────────────────────────┐
│                    BipFlow Delivery System                   │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
         ┌──────▼──────┐ ┌────▼────┐ ┌─────▼─────┐
         │   Frontend   │ │ Backend │ │ Database  │
         │  (Vue 3/TS)  │ │(Django) │ │(SQLite)   │
         └──────┬──────┘ └────┬────┘ └─────┬─────┘
                │             │            │
          REST API ◄──────────►  ORM ◄────►│
                │            │             │
         ┌──────▼──────────────────────────▼────┐
         │      Authentication (JWT Token)      │
         └───────────────────────────────────────┘
```

---

## Core Components

### 1. Vue 3 Frontend (TypeScript)
- **Framework**: Vue 3 Composition API
- **TypeScript**: Strict mode (`strict: true`)
- **Key Features**:
  - Real-time product listing and inventory
  - Order management dashboard
  - Image upload with preview
  - Responsive design with TailwindCSS

### 2. Django REST API Backend
- **Framework**: Django 6.0 + Django REST Framework
- **Authentication**: JWT (Simple JWT)
- **Key Features**:
  - Product CRUD operations
  - Category management
  - Inventory calculation
  - CORS support for frontend requests

### 3. Data Layer
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Django ORM
- **Migrations**: Django migrations system

---

## Data Flow

### Order Creation Flow
1. User fills form in Vue dashboard
2. Frontend validates via Zod schema
3. Sends POST to `/api/products/` with JWT token
4. Django ViewSet receives and validates
5. Model saved to database
6. Response returned with product ID
7. Frontend shows success toast

---

## Deployment & CI/CD

### Local Development
- `npm run dev` — Frontend development server
- `python manage.py runserver` — Django development server
- SQLite database auto-created on first migration

### Testing
- **Frontend**: Vitest + Cypress
- **Backend**: pytest + pytest-django
- **Linting**: ESLint + Ruff
- **Type Checking**: TypeScript strict mode

### Production
- Frontend: Build with Vite → static files
- Backend: Gunicorn + PostgreSQL
- Docker containerization ready

---

## Security Considerations

- JWT tokens for API authentication
- CORS headers restricted to frontend domain
- CSRF protection on POST/PUT/DELETE
- Input validation via Zod (frontend) + DRF serializers (backend)
- Environment variables for sensitive data

---

Last Updated: April 2026
