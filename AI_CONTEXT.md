# 🛰️ BipFlow AI Context & Development Standards

**Last Updated**: April 5, 2026 | **Version**: 1.0.0

This document defines the strict coding standards, architectural patterns, and absolute requirements for the BipFlow Full-Stack system. **All developers and AI assistants MUST follow these standards without exception.**

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Backend Architecture Standards](#backend-architecture-standards)
3. [Frontend Architecture Standards](#frontend-architecture-standards)
4. [Image & Media Handling](#image--media-handling)
5. [CRUD Operations & API Routing](#crud-operations--api-routing)
6. [Error Handling Standards](#error-handling-standards)
7. [State Management & Reactivity](#state-management--reactivity)
8. [Authentication & Security](#authentication--security)
9. [Documentation & API Docs](#documentation--api-docs)
10. [Testing & Validation](#testing--validation)

---

## 📱 Project Overview

**BipFlow** is a Full-Stack Asset Management System designed with the following principles:

- **Frontend**: Vue 3.4+ with TypeScript, Vite, Tailwind CSS
- **Backend**: Django 6.0+ with Django REST Framework (DRF)
- **Database**: SQLite (dev) / PostgreSQL (production)
- **Authentication**: JWT (djangorestframework-simplejwt)
- **API Documentation**: OpenAPI 3.0 (drf-spectacular + Swagger UI)

### Key Technical Decisions

- ✅ **TypeScript everywhere** for type safety
- ✅ **Vue 3 `<script setup>`** as the only accepted component syntax
- ✅ **Composite Pattern** for state management (composables)
- ✅ **Absolute image URLs** required in all responses
- ✅ **Cache invalidation** via `item.id + item.updated_at` keys
- ✅ **Atomic operations** (POST for create, PATCH for update, never PUT)

---

## 🏗️ Backend Architecture Standards

### 1. Models & Database

**Requirement**: All models MUST include audit timestamps.

```python
class Entity(models.Model):
    # Business fields
    name = models.CharField(max_length=255)
    
    # Audit trail (MANDATORY)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
```

**Standard**: `auto_now=True` ensures the timestamp updates automatically on every save.

### 2. Serializers & Absolute URLs

**CRITICAL REQUIREMENT**: All image fields MUST return absolute URLs, not relative paths.

```python
class EntitySerializer(serializers.ModelSerializer):
    """🚀 REQUIRED: Image field returns ABSOLUTE URL only on read."""
    
    class Meta:
        model = Entity
        fields = ['id', 'name', 'image', 'created_at', 'updated_at']
        read_only_fields = ('created_at', 'updated_at')
        extra_kwargs = {
            'image': {'required': False, 'allow_null': True},
        }
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.image:
            path = instance.image.url
            request = self.context.get('request')
            
            # ✅ PRIORITY 1: Use request context if available
            if request is not None:
                data['image'] = request.build_absolute_uri(path)
            # ✅ PRIORITY 2: Fall back to PUBLIC_BASE_URL
            else:
                base = (getattr(settings, 'PUBLIC_BASE_URL', '') or '').rstrip('/')
                data['image'] = (
                    f'{base}{path}' if path.startswith('/') else f'{base}/{path}'
                ) if base else path
        else:
            data['image'] = None
        return data
```

**Key Points**:
- ✅ `to_representation()` converts relative URLs to absolute
- ✅ Always check `request` context first
- ✅ Fall back to `PUBLIC_BASE_URL` from settings (for tasks, shell, async operations)
- ✅ Return `None` if no image, never empty string

### 3. ViewSets & Permissions

**Requirement**: All ViewSets MUST have explicit permission classes.

```python
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

class EntityViewSet(viewsets.ModelViewSet):
    """🚀 CRUD operations with authentication."""
    queryset = Entity.objects.all()
    serializer_class = EntitySerializer
    permission_classes = [IsAuthenticated]  # ✅ REQUIRED
    
    # Optional: Add custom filtering, pagination, etc.
```

**HTTP Verb Routing**:
- `GET /api/v1/entities/` → List all (200 OK)
- `GET /api/v1/entities/{id}/` → Retrieve one (200 OK)
- `POST /api/v1/entities/` → Create new (201 Created) ← **Always POST for creation**
- `PATCH /api/v1/entities/{id}/` → Update existing (200 OK) ← **Always PATCH, never PUT**
- `DELETE /api/v1/entities/{id}/` → Delete (204 No Content)

### 4. Settings Configuration

**Required settings.py entries**:

```python
# ✅ Base URL for absolute image URLs (when request context unavailable)
PUBLIC_BASE_URL = os.environ.get(
    'DJANGO_PUBLIC_BASE_URL',
    'http://127.0.0.1:8000' if DEBUG else ''
).strip().rstrip('/')

# ✅ CORS configuration
CORS_ALLOW_ALL_ORIGINS = DEBUG
if not DEBUG:
    CORS_ALLOWED_ORIGINS = os.environ.get(
        'CORS_ALLOWED_ORIGINS',
        'https://yourdomain.com'
    ).split(',')
else:
    CORS_ALLOWED_ORIGINS = [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:8000',
        'http://localhost:8000',
    ]

# ✅ REST Framework & DRF-Spectacular
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'BipFlow API',
    'DESCRIPTION': 'Full-stack asset management system',
    'VERSION': '1.0.0',
}

# ✅ Media & static file serving
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
```

### 5. URL Configuration

**Requirement**: Media and static files must be served in DEBUG mode.

```python
# urls.py
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularSwaggerView, SpectacularAPIView

urlpatterns = [
    # 📚 Auto-generated documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    # 🚀 Business API
    path('api/', include('api.urls')),
]

# ✅ Serve media in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
```

---

## 💻 Frontend Architecture Standards

### 1. Component Structure

**ONLY ALLOWED SYNTAX**: Vue 3 `<script setup lang="ts">`

```vue
<script setup lang="ts">
/**
 * ✨ Vue 3 Composition API with <script setup>
 * 
 * Requirements:
 * - Must use TypeScript (lang="ts")
 * - Never use Options API
 * - Never use class components
 * - Always include JSDoc comments for clarity
 */

import { ref, computed, onMounted } from 'vue';
import type { Entity } from '@/schemas/entity.schema';
import { useEntity } from '@/composables/useEntity';
import { resolveMediaSrc } from '@/lib/apiBase';  // ✅ REQUIRED
import { formatDrfErrorPayload } from '@/lib/drfErrors';  // ✅ REQUIRED

// State
const items = ref<Entity[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Computed
const hasItems = computed(() => items.value.length > 0);

// Lifecycle
onMounted(async () => {
  // Initialize
});
</script>

<template>
  <div><!-- Content --></div>
</template>

<style scoped>
/* Scoped styles */
</style>
```

### 2. Composables & State Management

**Pattern**: Singleton reactive store at module level, exposed via composable function.

```typescript
// ✅ CORRECT: Module-level singleton store
const items = ref<Entity[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

export function useEntity() {
  // All operations mutate module-level store
  const fetchData = async () => {
    loading.value = true;
    items.value = await EntityService.getAll();
    loading.value = false;
  };

  return {
    items,
    loading,
    error,
    fetchData,
  };
}
```

**NOT ALLOWED**:
```typescript
// ❌ WRONG: Creating new store per consumer
export function useEntity() {
  const items = ref<Entity[]>([]);  // New instance per call!
  // ...
}
```

### 3. Image Rendering

**CRITICAL REQUIREMENT**: Always use `resolveMediaSrc()` to convert relative paths to absolute URLs.

```vue
<script setup lang="ts">
import { resolveMediaSrc } from '@/lib/apiBase';

const product = ref<Product>({
  id: 1,
  image: '/media/products/item.jpg',  // ← Relative from API
  updated_at: '2026-04-05T10:30:00Z',
});

const resolvedImageUrl = computed(() => 
  product.value.image ? resolveMediaSrc(product.value.image) : null
);
</script>

<template>
  <!-- ✅ CORRECT: Image displays with resolved absolute URL -->
  <img :src="resolvedImageUrl" alt="Product" />
</template>
```

**How it works**:
- `resolveMediaSrc('/media/foo.jpg')` returns `'http://127.0.0.1:8000/media/foo.jpg'`
- Honors `VITE_BACKEND_ORIGIN` environment variable
- Falls back to `http://127.0.0.1:8000` for localhost development

### 4. Cache Invalidation via `:key`

**ABSOLUTE REQUIREMENT**: Every list item must have a dynamic key that includes `updated_at`.

```vue
<template>
  <!-- ✅ CORRECT: Key includes both id and updated_at -->
  <div
    v-for="product in products"
    :key="`${product.id}-${product.updated_at}`"
    class="product-card"
  >
    <!-- Content -->
  </div>
</template>
```

**Why this matters**:
- When backend returns `updated_at` timestamp, Vue detects change
- Component is re-created (not just re-rendered)
- Fresh image is loaded, cache busting works correctly
- Prevents stale image display after update

### 5. Error Handling

**Requirement**: All API errors must be formatted using `formatDrfErrorPayload()`.

```typescript
import { formatDrfErrorPayload, isAxiosError } from '@/lib/drfErrors';

try {
  await EntityService.create(data);
} catch (err: unknown) {
  if (isAxiosError(err) && err.response?.data) {
    // ✅ CORRECT: Translate DRF error structure
    const message = formatDrfErrorPayload(err.response.data);
    console.error('API Error:', message);
  } else if (err instanceof Error) {
    console.error('Error:', err.message);
  }
}
```

---

## 🖼️ Image & Media Handling

### Absolute Requirement

**EVERY image field MUST be served and consumed as an absolute URL.**

#### Scenario 1: Image Upload

```typescript
// 1. User selects file in Vue component
const file = inputElement.files[0];

// 2. Frontend sends to backend as FormData
const formData = new FormData();
formData.append('image', file);

// 3. Backend receives, Django stores at /media/products/2026/04/image.jpg
// 4. Backend serializer converts to absolute URL:
// {
//   "id": 1,
//   "image": "http://127.0.0.1:8000/media/products/2026/04/image.jpg"  ← ABSOLUTE
// }

// 5. Frontend receives absolute URL and renders directly
<img :src="product.image" />  // Works because URL is absolute
```

#### Scenario 2: Relative Path from Query

```python
# Django REST response
{
  "id": 1,
  "image": "/media/products/2026/04/file.jpg"  # Relative
}
```

Frontend must resolve:

```typescript
const resolved = resolveMediaSrc(product.image);
// Returns: "http://127.0.0.1:8000/media/products/2026/04/file.jpg"
```

### Environment Configuration

**Frontend** (`.env.local`):

```
VITE_API_URL=http://127.0.0.1:8000/api/
VITE_BACKEND_ORIGIN=http://127.0.0.1:8000
```

**Backend** (`bipdelivery/.env`):

```
DJANGO_PUBLIC_BASE_URL=http://127.0.0.1:8000
```

---

## 🔄 CRUD Operations & API Routing

### Strict HTTP Verb Rules

| Operation | HTTP Method | Status | Endpoint | Rule |
|-----------|-------------|--------|----------|------|
| **Create** | POST | 201 Created | `/api/v1/entities/` | Send complete data + File fields |
| **Read** | GET | 200 OK | `/api/v1/entities/` or `/{id}/` | No body |
| **Update** | PATCH | 200 OK | `/api/v1/entities/{id}/` | Send ONLY changed fields |
| **Delete** | DELETE | 204 No Content | `/api/v1/entities/{id}/` | No body |

### CRITICAL RULE: Always POST for Create, Always PATCH for Update

```typescript
// ❌ WRONG: Using PUT for update
await axios.put(`/api/v1/products/${id}/`, data);  // ← NEVER DO THIS

// ✅ CORRECT: Use PATCH for update
await axios.patch(`/api/v1/products/${id}/`, data);  // ← Always this
```

### Why PATCH, not PUT?

- **PUT**: Replaces entire resource (requires all fields, may trigger validation errors)
- **PATCH**: Updates only specified fields (skips validation for unchanged fields)
- **BipFlow Standard**: Use PATCH to avoid "SKU already exists" when only modifying name

### Frontend Decision Logic

```typescript
// In DashboardView.handleSave():

if (selectedProduct.value?.id) {
  // ✅ Product has ID → use updateProduct (PATCH)
  await updateProduct(selectedProduct.value.id, formData);
} else {
  // ✅ No ID → use createProduct (POST)
  await createProduct(formData);
}
```

---

## 🛡️ Error Handling Standards

### DRF Error Format

Django REST Framework returns errors in this structure:

```json
{
  "sku": ["This field may not be blank."],
  "name": ["Ensure this field has at most 255 characters."],
  "non_field_errors": ["Invalid request"]
}
```

### Frontend Conversion

```typescript
import { formatDrfErrorPayload } from '@/lib/drfErrors';

try {
  await api.post('/products/', data);
} catch (error) {
  if (isAxiosError(error) && error.response?.data) {
    // ✅ Format DRF error into human-readable string
    const message = formatDrfErrorPayload(error.response.data);
    console.error(message);
    // Output: "sku: This field may not be blank. name: Ensure this field has at most 255 characters."
  }
}
```

### Error State Management

Every page component MUST have these states:

```typescript
const loading = ref(false);     // Async operation in progress
const error = ref<string | null>(null);  // Last error message
const isSaving = ref(false);    // Form submission in progress
const isDeletingAction = ref(false);  // Delete confirmation in progress
```

---

## ⚡ State Management & Reactivity

### Reactive URLs & Cache Busting

```typescript
// ❌ WRONG: Static cache nonce
<img :src="resolveMediaSrc(image)" />

// ✅ CORRECT: Dynamic cache nonce from updated_at
<img :src="resolveMediaSrc(image, product.updated_at)" />
```

### List Item Keys

From the backend, every entity response includes timestamps:

```json
{
  "id": 1,
  "name": "Product A",
  "updated_at": "2026-04-05T10:30:00Z",
  "created_at": "2026-04-01T00:00:00Z"
}
```

Frontend must use in list rendering:

```vue
<component
  v-for="item in items"
  :key="`${item.id}-${item.updated_at}`"  <!-- ✅ REQUIRED FORMAT -->
/>
```

---

## 🔐 Authentication & Security

### JWT Tokens

All API requests (except `/auth/token/`) require JWT authentication:

```typescript
// ✅ Axios interceptor adds Authorization header
headers: {
  'Authorization': 'Bearer eyJhbGc...'
}
```

### CORS Configuration

**Development**:
```python
CORS_ALLOWED_ORIGINS = [
    'http://127.0.0.1:5173',  # Vite dev server
    'http://localhost:5173',
]
```

**Production**:
```python
CORS_ALLOWED_ORIGINS = [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
]
```

---

## 📚 Documentation & API Docs

### Auto-Generated Documentation

**drf-spectacular** automatically generates API docs from your ViewSets and Serializers:

```
📂 Swagger UI (Interactive)
  └─ http://127.0.0.1:8000/api/docs/

📂 ReDoc (Reader-friendly)
  └─ http://127.0.0.1:8000/api/redoc/

📄 OpenAPI Schema (JSON)
  └─ http://127.0.0.1:8000/api/schema/
```

**No manual endpoint documentation needed!** Everything is auto-generated from ViewSet docstrings:

```python
class ProductViewSet(viewsets.ModelViewSet):
    """
    🛰️ Product Management API
    
    Retrieve, create, update, and delete products from the inventory.
    
    - **GET** /api/v1/products/ → List all products
    - **POST** /api/v1/products/ → Create product
    - **PATCH** /api/v1/products/{id}/ → Update product
    - **DELETE** /api/v1/products/{id}/ → Delete product
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
```

---

## ✅ Testing & Validation

### Frontend Tests

All composables must have unit tests:

```typescript
// composables/__tests__/useEntity.spec.ts
import { useEntity, resetEntityCatalogForTests } from '../useEntity';

describe('useEntity', () => {
  beforeEach(() => {
    resetEntityCatalogForTests();
  });

  it('should load entities', async () => {
    const { items, fetchData } = useEntity();
    await fetchData();
    expect(items.value).toHaveLength(greaterThan(0));
  });
});
```

### Backend Tests

All ViewSets should be tested:

```python
# api/tests.py
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Product

class ProductAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
    
    def test_create_product(self):
        response = self.client.post('/api/v1/products/', {
            'name': 'Test',
            'sku': 'TEST-001',
            'price': '100.00'
        })
        self.assertEqual(response.status_code, 201)
```

---

## 📋 Checklist for New Features

When implementing a new page/feature, verify:

- [ ] Backend ViewSet created with explicit `permission_classes`
- [ ] Serializer includes `updated_at` in read_only_fields
- [ ] Serializer uses `to_representation()` for absolute image URLs
- [ ] Frontend component uses `<script setup lang="ts">`
- [ ] Composable follows singleton pattern
- [ ] All list items have `:key="{id}-{updated_at}"`
- [ ] Image fields use `resolveMediaSrc()`
- [ ] Error handling uses `formatDrfErrorPayload()`
- [ ] PATCH is used for updates, never PUT
- [ ] POST is used for creation
- [ ] `.env` files documented with required keys
- [ ] Swagger UI documentation auto-generates correctly

---

## 🚀 Quick Reference: Copy-Paste Templates

### Backend ViewSet Template

```python
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Entity
from .serializers import EntitySerializer

class EntityViewSet(viewsets.ModelViewSet):
    queryset = Entity.objects.all()
    serializer_class = EntitySerializer
    permission_classes = [IsAuthenticated]
```

### Frontend Component Template

Use the **Perfect Page Template** located at:

```
bipflow-frontend/src/templates/PERFECT_PAGE.TEMPLATE.vue
```

Copy and customize for your entity.

### Frontend Composable Template

Use the **Perfect Composable Template** located at:

```
bipflow-frontend/src/templates/useEntity.TEMPLATE.ts
```

Copy and customize for your entity.

---

## 📞 Enforcement & Violations

### What Happens If These Standards Are Violated?

❌ **Not Allowed**:
- Relative image URLs in API responses
- PUT requests for updates
- POST requests for updates
- Vue Options API or class components
- Composables without singleton pattern
- List items without `updated_at` in `:key`
- Manual endpoint documentation

✅ **Always Required**:
- Absolute image URLs
- PATCH for updates
- `<script setup lang="ts">`
- Singleton composables
- Dynamic list keys
- Auto-generated docs

---

**Last Updated**: April 5, 2026

**Questions?** Refer to this file. It is the source of truth for BipFlow development.
