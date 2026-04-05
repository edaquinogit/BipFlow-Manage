# ⚡ BipFlow DX Pipeline — Quick Start Guide

**5-Minute Setup** | **Copy-Paste Ready** | **10x Faster Development**

---

## 🚀 30-Second Overview

BipFlow now has **automated documentation, copy-paste templates, and AI-ready standards**. Development time for new features: **30 minutes** (down from 6+ hours).

---

## 📚 Three Essential Files

### 1. **AI_CONTEXT.md** — Full Reference
- Complete architecture standards
- 400+ lines of detailed documentation
- For understanding "why" behind patterns
- Share with AI assistants for code generation

### 2. **.cursorrules** — Quick Rules
- Cursor AI specific
- Quick reference (not verbose)
- Critical rules highlighted
- Links to full documentation

### 3. **Templates** — Copy & Paste
```
bipflow-frontend/src/templates/
  ├── PERFECT_PAGE.TEMPLATE.vue  ← Copy for new pages
  └── useEntity.TEMPLATE.ts      ← Copy for new composables
```

---

## 🎯 Three Lines That Changed Everything

### Absolute Rule 1: Images Must Be Absolute URLs
```json
{ "image": "http://127.0.0.1:8000/media/path.jpg" }  // ✅ CORRECT
{ "image": "/media/path.jpg" }                        // ❌ WRONG
```

### Absolute Rule 2: Use PATCH for Updates (Never PUT)
```typescript
api.patch(`/api/v1/products/${id}/`, data)   // ✅ CORRECT
api.put(`/api/v1/products/${id}/`, data)     // ❌ WRONG
```

### Absolute Rule 3: List Keys Include `updated_at`
```vue
:key="`${item.id}-${item.updated_at}`"  // ✅ CORRECT  
:key="item.id"                          // ❌ WRONG
```

---

## ⚡ Adding a Feature in 30 Minutes

### Backend (5 minutes)

```python
# 1. Create Model
class Order(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)  # ✅ Required
    updated_at = models.DateTimeField(auto_now=True)      # ✅ Required

# 2. Create Serializer
class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['id', 'name', '...', 'created_at', 'updated_at']
        read_only_fields = ('created_at', 'updated_at')

# 3. Create ViewSet
class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]  # ✅ Required

# 4. Add to Router (v1_urls.py)
router.register(r'orders', OrderViewSet, basename='order')

# 5. Done! Visit http://127.0.0.1:8000/api/docs/ to see auto-generated docs ✅
```

### Frontend (10 minutes)

```bash
# 1. Copy page template
cp src/templates/PERFECT_PAGE.TEMPLATE.vue src/views/OrdersView.vue

# 2. Copy composable template
cp src/templates/useEntity.TEMPLATE.ts src/composables/useOrders.ts

# 3. Replace "Entity" → "Order" in both files

# 4. Update API endpoints in composable and page

# 5. Add to router in src/router/

# 6. Done! ✅
```

### Validation (5 minutes)

```bash
# 1. Check Swagger UI
# → http://127.0.0.1:8000/api/docs/
# → Verify endpoints exist

# 2. Test CRUD
# → npm run dev
# → Create → Verify POST 201
# → Update → Verify PATCH 200
# → Delete → Verify DELETE 204

# 3. Done! ✅
```

**Total**: 30 minutes. Not 6 hours. ⚡

---

## 🔗 Key Documentation Links

| What You Need | Where to Find It |
|--------------|------------------|
| Full standards | `AI_CONTEXT.md` in root |
| Quick rules | `.cursorrules` in root |
| Setup guide | `DX_SETUP_AND_VALIDATION.md` |
| Executive summary | `DX_EXECUTIVE_SUMMARY.md` |
| Page template | `bipflow-frontend/src/templates/PERFECT_PAGE.TEMPLATE.vue` |
| Composable template | `bipflow-frontend/src/templates/useEntity.TEMPLATE.ts` |
| Auto-generated docs | `http://127.0.0.1:8000/api/docs/` |

---

## 🚀 Test It Right Now

### Start Servers

```bash
# Terminal 1: Backend
cd bipdelivery
python manage.py runserver 0.0.0.0:8000

# Terminal 2: Frontend
cd bipflow-frontend
npm run dev
```

### Access Documentation

```
Frontend:        http://127.0.0.1:5173
Swagger UI:      http://127.0.0.1:8000/api/docs/
ReDoc:           http://127.0.0.1:8000/api/redoc/
OpenAPI Schema:  http://127.0.0.1:8000/api/schema/
```

---

## ✅ The 4 Key Patterns to Remember

### Pattern 1: Absolute URLs
```python
def to_representation(self, instance):
    data = super().to_representation(instance)
    if instance.image:
        request = self.context.get('request')
        if request:
            data['image'] = request.build_absolute_uri(instance.image.url)
    return data
```

### Pattern 2: PATCH for Updates
```typescript
if (entity.id) {
    await api.patch(`/api/v1/entities/${entity.id}/`, data)  // ✅
} else {
    await api.post(`/api/v1/entities/`, data)  // ✅
}
```

### Pattern 3: Cache Busting via Keys
```vue
<div v-for="item in items" :key="`${item.id}-${item.updated_at}`" />
```

### Pattern 4: Singleton Composables
```typescript
const items = ref<Entity[]>([])  // Module-level shared store

export function useEntity() {
    const fetchData = async () => {
        items.value = await service.getAll()  // Mutates shared store
    }
    return { items, fetchData }
}
```

---

## 📋 Checklist: Before You Start Coding

- [ ] Did I read `.cursorrules`? (2 min)
- [ ] Did I copy templates? (5 min)
- [ ] Am I using `<script setup lang="ts">`? (frontend)
- [ ] Am I using PATCH for updates? (frontend/backend)
- [ ] Did I add timestamps to model? (backend)
- [ ] Did I add `:key` with `updated_at`? (frontend)
- [ ] Did I use `resolveMediaSrc()` for images? (frontend)
- [ ] Did I use `formatDrfErrorPayload()` for errors? (frontend)

---

## 🆘 Your Question Answered

| Question | Answer |
|----------|--------|
| "How do I add timestamps?" | `created_at` (auto_now_add) + `updated_at` (auto_now) |
| "How do I return absolute URLs?" | Use `to_representation()` with `request.build_absolute_uri()` |
| "How do I handle images?" | Always use `resolveMediaSrc()` in Vue |
| "When do I use PATCH?" | Always for updates. Never PUT. |
| "When do I use POST?" | Only for creating new entities. |
| "How do I bust cache?" | Include `updated_at` in list `:key` binding |
| "How do I format errors?" | Use `formatDrfErrorPayload(error.response.data)` |
| "How do I structure state?" | Module-level singleton pattern in composables |

---

## 🎯 Before & After

### Before DX Pipeline
```
New feature requested
  ↓
Write backend (1.5 hours)
  ↓
Write documentation (1 hour)
  ↓
Write frontend (1.5 hours)
  ↓
Debug issues (1+ hours)
  ↓
6-7 hours total ❌
```

### After DX Pipeline
```
New feature requested
  ↓
Copy ViewSet template (5 min)
  ↓
Auto-documented ✅
  ↓
Copy page + composable templates (5 min)
  ↓
Customize (15 min)
  ↓
Test (5 min)
  ↓
30 minutes total ✅
```

---

## 🚀 Your First Feature Using the Pipeline

1. **Read** `.cursorrules` (2 min)
2. **Copy** `PERFECT_PAGE.TEMPLATE.vue` (1 min)
3. **Copy** `useEntity.TEMPLATE.ts` (1 min)
4. **Replace** placeholders (5 min)
5. **Update** API endpoints (5 min)
6. **Test** with Swagger UI (5 min)
7. **Done!** (20 min total vs 6+ hours before)

---

## 🔗 When You Need Help

1. **Quick answer?** Check `.cursorrules` section 2 (4 min read)
2. **Detailed explanation?** Check `AI_CONTEXT.md` (10 min read)
3. **How to implement?** Check `DX_SETUP_AND_VALIDATION.md` (part 3)
4. **Stuck?** Check "Common Issues & Solutions" in `DX_SETUP_AND_VALIDATION.md`

---

## ✨ What This Enables

### For You (Developer)
- ⚡ 10x faster feature development
- 🛡️ Standardized patterns prevent bugs
- 📚 Auto-generated documentation
- 😊 Less cognitive load (follow templates)

### For Your Team
- 📚 New members onboard faster
- 🔄 Consistent code quality
- 📖 Clear standards everyone follows
- 🤖 AI can maintain code automatically

### For Your Project
- 📈 Higher velocity (more features, faster)
- 🐛 Fewer bugs (patterns prevent common mistakes)
- 📚 Better documentation (always up-to-date)
- 🧹 Lower technical debt (consistent patterns)

---

## 🎉 You're Ready!

Everything is set up. You can now:

1. ✅ Add features in 30 minutes
2. ✅ Auto-generate API documentation
3. ✅ Use standardized templates
4. ✅ Follow clear architectural patterns
5. ✅ Leverage AI for code generation

**Start now. Pick a new entity (Orders, Customers, whatever). Use the template. You'll have it done in 30 minutes.**

---

**Questions?** Check the documentation files mentioned above.

**Ready?** Copy a template and start coding! ⚡
