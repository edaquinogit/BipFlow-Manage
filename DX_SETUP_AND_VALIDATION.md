# 🛰️ BipFlow DX Pipeline — Setup & Validation Guide

**Date**: April 5, 2026 | **Status**: Complete and Ready for Use

This guide walks through setting up and validating the complete DX automation pipeline for BipFlow.

---

## 📚 What's Included

### 1. ✅ Automated API Documentation
- **Tool**: drf-spectacular (OpenAPI 3.0)
- **UI**: Swagger interactive explorer + ReDoc reader-friendly
- **Status**: Auto-generated, zero manual documentation

### 2. ✅ Perfect Vue 3 Template
- **File**: `bipflow-frontend/src/templates/PERFECT_PAGE.TEMPLATE.vue`
- **Includes**: All standardized patterns (media resolution, error handling, reactivity)
- **Status**: Copy-paste ready for new pages

### 3. ✅ Perfect Composable Template
- **File**: `bipflow-frontend/src/templates/useEntity.TEMPLATE.ts`
- **Includes**: Singleton state, CRUD ops, DRF error handling
- **Status**: Copy-paste ready for new composables

### 4. ✅ AI Context Standards
- **File**: `AI_CONTEXT.md` (comprehensive 400+ line reference)
- **File**: `.cursorrules` (Cursor AI specific rules)
- **Status**: Reference guides for AI-assisted development

### 5. ✅ Backend Configuration
- **drf-spectacular**: Installed and configured
- **Settings**: Updated with auto-docs config
- **URLs**: Configured with Swagger UI endpoints
- **Status**: Ready to auto-document any endpoint

---

## 🚀 Setup Instructions

### Step 1: Install drf-spectacular Package

```bash
cd bipdelivery

# Install the package
pip install drf-spectacular==0.30.1

# Verify it's installed
pip show drf-spectacular
```

### Step 2: Apply Configuration (Already Done ✅)

Configuration has been applied to:
- ✅ `bipdelivery/requirements.txt` — Package added
- ✅ `bipdelivery/core/settings.py` — Installed app + REST_FRAMEWORK config
- ✅ `bipdelivery/core/urls.py` — Swagger UI endpoints added

No additional setup needed!

### Step 3: Verify Setup

Run Django dev server:

```bash
cd bipdelivery
python manage.py runserver 0.0.0.0:8000
```

**Test Swagger UI**:
- Open browser: `http://127.0.0.1:8000/api/docs/`
- You should see interactive API documentation
- Try expanding the Products endpoint

**Test ReDoc**:
- Open browser: `http://127.0.0.1:8000/api/redoc/`
- Reader-friendly documentation (better for PDFs/sharing)

**Test Schema Endpoint**:
- Open browser: `http://127.0.0.1:8000/api/schema/`
- Raw OpenAPI 3.0 schema in JSON format

---

## 📝 Frontend Templates Usage

### Using the Perfect Page Template

**Step 1**: Copy the template

```bash
cd bipflow-frontend/src

# Copy to new file
cp templates/PERFECT_PAGE.TEMPLATE.vue views/mymodule/MyNewPage.vue
```

**Step 2**: Replace placeholders

In `MyNewPage.vue`:

```vue
<script setup lang="ts">
// Replace all instances of:
//   Entity → MyEntity (or Product, Order, Customer, etc)
//   entity → myEntity
//   entities → myEntities

import { useMyEntity } from '@/composables/useMyEntity';
import type { MyEntity } from '@/schemas/myentity.schema';
import MyEntityService from '@/services/myentity.service';
// ... rest stays the same
</script>
```

**Step 3**: Customize for your domain

- Update section titles in template
- Adjust form fields to match your data
- Update button labels

### Using the Perfect Composable Template

**Step 1**: Copy the template

```bash
cd bipflow-frontend/src/composables

# Copy and rename
cp ../templates/useEntity.TEMPLATE.ts useMyEntity.ts
```

**Step 2**: Replace placeholders

In `useMyEntity.ts`:

```typescript
// Replace:
//   Entity → MyEntity
//   EntityService → MyEntityService
//   entity → myEntity
//   entityLogger → myEntityLogger

import type { MyEntity } from '@/schemas/myentity.schema';
import MyEntityService from '@/services/myentity.service';
import { myEntityLogger } from '@/lib/logger';

const items = ref<MyEntity[]>([]);
// ... rest of implementation
```

**Step 3**: Verify all required imports are present

```typescript
// ✅ Must have:
import { formatDrfErrorPayload, isAxiosError } from '@/lib/drfErrors';
import { entityLogger } from '@/lib/logger';
```

---

## 🧪 Validation Checklist

After setting up a new feature, verify:

### Backend Validation

- [ ] **Model** has `created_at` and `updated_at` fields
- [ ] **Serializer** exports these fields as read-only
- [ ] **Serializer** uses `to_representation()` for image absolute URLs
- [ ] **ViewSet** has `permission_classes = [IsAuthenticated]`
- [ ] **Swagger UI** shows all endpoints at `/api/docs/`

**Test Command**:
```bash
# Check if Swagger auto-generates your endpoint
curl http://127.0.0.1:8000/api/schema/ | grep "myendpoint"
```

### Frontend Validation

- [ ] **Page component** uses `<script setup lang="ts">`
- [ ] **Composable** is module-level singleton
- [ ] **List items** have `:key="{id}-{updated_at}"` binding
- [ ] **Images** use `resolveMediaSrc()` helper
- [ ] **Errors** use `formatDrfErrorPayload()`
- [ ] **Create** uses POST request
- [ ] **Update** uses PATCH request (not PUT)

**Test Commands**:
```bash
cd bipflow-frontend

# Run type checking
npx tsc --noEmit

# Run linting
npm run lint

# Run tests (if configured)
npm run test
```

---

## 📊 Feature Implementation Workflow (10x Faster)

### Traditional Approach (Before DX Pipeline)

1. Design schema/model (1 hour)
2. Write Django ViewSet (30 min)
3. Write serializer (30 min)
4. Write manual endpoint docs (1 hour)
5. Create Vue page (1 hour)
6. Create composable (30 min)
7. Test everything (1 hour)
8. Debug CRUD routing issues (30 min)
9. Fix image rendering issues (30 min)
10. Fix cache/reactivity issues (30 min)

**Total**: ~6-7 hours per feature

### DX Pipeline Approach (After This Setup)

1. **Backend** (10 min):
   - Copy ViewSet template
   - Replace entity name
   - Add to router
   
2. **Frontend** (15 min):
   - Copy page template
   - Copy composable template
   - Replace entity name
   - Customize UI
   
3. **Validation** (5 min):
   - Check Swagger documentation auto-generates
   - Test CRUD operations
   - Verify image handling

**Total**: ~30 minutes per feature

**Improvement**: **10x faster!** ⚡

---

## 🔧 Real-World Example: Adding Orders Module

### Step 1: Backend (5 min)

```python
# models.py
class Order(models.Model):
    customer_name = models.CharField(max_length=255)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)  # ✅ Timestamp
    updated_at = models.DateTimeField(auto_now=True)      # ✅ Timestamp

# serializers.py
class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['id', 'customer_name', 'total', 'created_at', 'updated_at']
        read_only_fields = ('created_at', 'updated_at')

# views.py
class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]  # ✅ Required

# v1_urls.py
router.register(r'orders', OrderViewSet, basename='order')
```

**Result**: Swagger UI auto-generates at `/api/docs/` ✅

### Step 2: Frontend (10 min)

**Copy template**:
```bash
cp src/templates/PERFECT_PAGE.TEMPLATE.vue src/views/orders/OrdersView.vue
```

**Edit**:
```vue
<script setup lang="ts">
import { useOrders } from '@/composables/useOrders';
import type { Order } from '@/schemas/order.schema';

const { items: orders, ... } = useOrders();
</script>

<template>
  <div>
    <!-- Replace "Entity" sections with Order-specific content -->
  </div>
</template>
```

**Copy composable**:
```bash
cp src/templates/useEntity.TEMPLATE.ts src/composables/useOrders.ts
```

**Edit composable**:
```typescript
import type { Order } from '@/schemas/order.schema';
import OrderService from '@/services/order.service';

const items = ref<Order[]>([]);
```

**Result**: Fully functional Orders module ✅

### Step 3: Validation (5 min)

```bash
# 1. Check Swagger
# → Visit http://127.0.0.1:8000/api/docs/
# → Verify /api/v1/orders/ endpoints exist

# 2. Test CRUD
# → npm run dev
# → Create order → Verify POST 201
# → Edit order → Verify PATCH 200  
# → Delete order → Verify DELETE 204

# 3. Verify reactivity
# → Update order
# → Check :key pattern triggers re-render
# → Verify data syncs
```

---

## 📋 Common Issues & Solutions

### Issue: Swagger UI shows no endpoints

**Cause**: ViewSet not registered in router  
**Solution**:
```python
# v1_urls.py
router.register(r'products', ProductViewSet, basename='product')
urlpatterns = [path('', include(router.urls))]
```

### Issue: Images not displaying

**Cause**: Using relative URL instead of absolute  
**Solution**:
```python
# serializers.py
def to_representation(self, instance):
    data = super().to_representation(instance)
    if instance.image:
        request = self.context.get('request')
        if request:
            data['image'] = request.build_absolute_uri(instance.image.url)
        # ... fallback to PUBLIC_BASE_URL
    return data
```

### Issue: "SKU already exists" error on update

**Cause**: Using PUT instead of PATCH  
**Solution**:
```typescript
// Always PATCH for updates
await api.patch(`/products/${id}/`, data);  // Not PUT
```

### Issue: Stale images after update

**Cause**: Missing `updated_at` in `:key` binding  
**Solution**:
```vue
<!-- Include updated_at in key -->
<img :key="`${product.id}-${product.updated_at}`" />
```

### Issue: Swagger UI 404 error

**Cause**: drf-spectacular not in INSTALLED_APPS  
**Solution**:
```python
# settings.py
INSTALLED_APPS = [
    # ...
    'drf_spectacular',  # Add this
]
```

---

## 📚 Quick Reference Commands

### Development Server

```bash
# Backend
cd bipdelivery
python manage.py runserver 0.0.0.0:8000

# Frontend (new terminal)
cd bipflow-frontend  
npm run dev
```

### Access Points

```
Frontend:           http://127.0.0.1:5173
Backend API:        http://127.0.0.1:8000/api/
Swagger UI Docs:    http://127.0.0.1:8000/api/docs/
ReDoc Docs:         http://127.0.0.1:8000/api/redoc/
OpenAPI Schema:     http://127.0.0.1:8000/api/schema/
Django Admin:       http://127.0.0.1:8000/admin/
```

### Testing CRUD Operations

```bash
# Create (POST → 201)
curl -X POST http://127.0.0.1:8000/api/v1/products/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","price":"100.00"}'

# Read (GET → 200)
curl http://127.0.0.1:8000/api/v1/products/1/ \
  -H "Authorization: Bearer $TOKEN"

# Update (PATCH → 200)
curl -X PATCH http://127.0.0.1:8000/api/v1/products/1/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated"}'

# Delete (DELETE → 204)
curl -X DELETE http://127.0.0.1:8000/api/v1/products/1/ \
  -H "Authorization: Bearer $TOKEN"
```

---

## ✅ Success Criteria

You've successfully implemented the DX pipeline when:

- [x] Swagger UI shows all endpoints auto-documented
- [x] Creating a new page takes <30 minutes
- [x] New features follow standardized patterns
- [x] All images display correctly as absolute URLs
- [x] CRUD operations use correct HTTP verbs
- [x] No manual documentation needed
- [x] AI assistants can maintain code without breaking patterns

---

## 📖 Additional Resources

**Core Standards**: `AI_CONTEXT.md` (full reference)  
**Cursor Rules**: `.cursorrules` (AI-specific)  
**Page Template**: `bipflow-frontend/src/templates/PERFECT_PAGE.TEMPLATE.vue`  
**Composable Template**: `bipflow-frontend/src/templates/useEntity.TEMPLATE.ts`  

---

## 🎯 Next Steps

1. **Test Swagger UI**: Visit `http://127.0.0.1:8000/api/docs/`
2. **Copy Page Template**: Start a new feature using the templates
3. **Validate First Page**: Ensure image handling and CRUD operations work
4. **Share with Team**: Make sure everyone knows about the templates and standards
5. **Use AI Assistants**: Let Claude/Cursor use the templates for future features

---

**Implementation Complete** ✅

**Date**: April 5, 2026
