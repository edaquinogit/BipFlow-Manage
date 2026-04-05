# 03 - FRONTEND ARCHITECTURE & COMPONENT DESIGN

> Component hierarchy, design system rules, and UI patterns for Vue 3

## Overview

This level documents **component organization**, **styling conventions**, **state management patterns**, and **code standards** for the Vue 3 frontend.

## Component Hierarchy

```
App.vue (Root)
│
├─ LayoutComponent
│  ├─ Sidebar (Navigation)
│  └─ MainContent (Route outlet)
│
└─ RouteComponent (per-page)
   ├─ ProductDashboard
   │  ├─ ProductTable (Feature)
   │  ├─ ProductForm (Feature)
   │  └─ CategoryForm (Feature)
   │
   └─ NotFoundPage
```

## Folder Structure

```
src/
├─ assets/
│  └─ main.css          (Global styles + Tailwind imports)
│
├─ components/
│  ├─ common/           (Reusable, cross-feature)
│  │  ├─ FormInput.vue  (Text, select, number inputs)
│  │  ├─ Sidebar.vue    (Navigation menu)
│  │  └─ ...            (Other shared UI)
│  │
│  └─ dashboard/        (Feature-specific components)
│     ├─ category-form/
│     │  └─ CategoryForm.vue
│     ├─ product-form/
│     │  ├─ ProductForm.vue
│     │  ├─ ImageUpload.vue
│     │  └─ SkuInput.vue
│     ├─ product-table/
│     │  ├─ ProductTable.vue
│     │  ├─ ProductRow.vue
│     │  └─ ProductFilter.vue
│     ├─ stats/
│     │  ├─ TotalProducts.vue
│     │  └─ StockStatus.vue
│     └─ layout/
│        ├─ DashboardLayout.vue
│        └─ Header.vue
│
├─ composables/         (Reusable logic)
│  ├─ useProducts.ts    (Product state + API)
│  ├─ useCategories.ts  (Category state + API)
│  ├─ __tests__/        (Unit tests for composables)
│  └─ useProductState.ts (Form state management)
│
├─ services/            (API layer)
│  ├─ api.ts            (Axios instance + interceptors)
│  ├─ product.service.ts
│  ├─ category.service.ts
│  └─ error-handler.ts
│
├─ schemas/             (Zod validation)
│  └─ product.schema.ts
│
├─ types/               (TypeScript interfaces)
│  ├─ auth.ts
│  ├─ product.ts
│  └─ error.ts
│
├─ router/              (Vue Router)
│  └─ index.ts
│
├─ lib/                 (Utilities)
│  ├─ logger.ts         (Structured logging)
│  ├─ drfErrors.ts      (DRF error parsing)
│  └─ formats.ts        (Date, currency formatting)
│
├─ config/
│  └─ navigation.ts     (Menu structure)
│
├─ constants/           (App-wide constants)
│
├─ views/               (Page-level components)
│  ├─ Dashboard.vue
│  ├─ Login.vue
│  └─ NotFound.vue
│
└─ tests/               (Integration tests)
```

## Component Design System

### Component Types

#### 1. **Presentational (Dumb) Components**
- Pure data → UI transformation
- No API calls, no side effects
- Props-in, events-out pattern
- Example: `FormInput.vue`, `ProductRow.vue`

```vue
<script setup lang="ts">
interface Props {
  label: string;
  modelValue: string;
  type?: 'text' | 'email' | 'number';
  disabled?: boolean;
}

defineProps<Props>();
defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
</script>
```

#### 2. **Container (Smart) Components**
- Fetch data from API via services
- Manage local state
- Orchestrate child components
- Example: `ProductTable.vue`, `ProductForm.vue`

```vue
<script setup lang="ts">
import { useProducts } from '@/composables/useProducts';

const { products, loading, error } = useProducts();
</script>
```

#### 3. **Layout Components**
- Provide page structure
- Handle navigation
- Example: `DashboardLayout.vue`

### Styling Conventions

- **Framework**: Tailwind CSS 3
- **Color Palette**: 
  - Primary: Blue-600
  - Success: Green-500
  - Error: Red-500
  - Warning: Yellow-500
  
- **Spacing**: Tailwind default scale (4px base unit)
- **Components**: No custom CSS classes unless Tailwind insufficient

### State Management

#### Pattern: Composables + Services

```typescript
// composable: useProducts.ts
export function useProducts() {
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchProducts = async () => {
    loading.value = true;
    error.value = null;
    try {
      products.value = await ProductService.getAll();
    } catch (err) {
      error.value = 'Failed to fetch products';
    } finally {
      loading.value = false;
    }
  };

  return { products, loading, error, fetchProducts };
}

// Component usage
const { products, fetchProducts } = useProducts();
onMounted(() => fetchProducts());
```

#### Cache Strategy
- **TTL**: 5 minutes (check cache before API call)
- **Invalidation**: Manual refresh on create/update/delete
- **Optimistic updates**: UI updates before API response

## TypeScript Conventions

### Strict Mode Enabled
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "strictNullChecks": true
  }
}
```

### Type Naming Conventions
- **Types**: `ProductState`, `FormErrors`, `ApiResponse`
- **Interfaces**: `IProduct`, `ICategory` (optional prefix)
- **Enums**: `UserRole`, `ProductStatus`

### No `any` Type
- Use unions: `string | number | null`
- Use generics: `T extends Record<string, unknown>`
- Use `unknown` for truly unknown types, then narrow

## Form Handling

### Validation Pattern

```typescript
// 1. Define schema with Zod
const ProductFormSchema = z.object({
  name: z.string().min(3),
  price: z.coerce.number().nonnegative(),
  // ...
});

// 2. Validate in composable
const errors = ref<Partial<Product>>({});

const validateForm = (data: FormData) => {
  const result = ProductFormSchema.safeParse(data);
  if (!result.success) {
    errors.value = result.error.flatten().fieldErrors;
    return false;
  }
  return true;
};

// 3. Display in component
<FormInput
  v-model="form.name"
  :error="errors.name?.[0]"
  label="Product Name"
/>
```

## Error Handling

### Error Types
```typescript
class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### Error Display Pattern
```typescript
const handleError = (error: unknown) => {
  if (error instanceof APIError) {
    if (error.status === 409) {
      // Conflict - SKU already exists
      showToast('SKU already exists', 'error');
    } else if (error.status === 400) {
      // Validation error
      parseFieldErrors(error.details);
    }
  }
};
```

## Performance Guidelines

| Goal | Strategy |
|------|----------|
| **Bundle Size** | Tree-shake unused Tailwind,  lazy-load routes |
| **API Calls** | Cache with 5-min TTL, batch requests |
| **Rendering** | Use `<Suspense>`, virtual scroll for long lists |
| **Images** | WebP format, lazy-load, max 2MB |

## Testing (Vitest + Vue Test Utils)

```typescript
// Example: ProductTable.test.ts
describe('ProductTable', () => {
  it('renders product list', async () => {
    const { getByText } = render(ProductTable, {
      props: {
        products: [{ id: 1, name: 'Widget' }]
      }
    });
    expect(getByText('Widget')).toBeDefined();
  });
});
```

---

## Navigation

- **Previous**: [02-api-specs/](../02-api-specs/README.md) - API contracts
- **Next**: [04-operations/](../04-operations/README.md) - Deployment & operations
