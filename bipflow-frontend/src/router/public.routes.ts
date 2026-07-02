import type { RouteRecordRaw } from 'vue-router'

/**
 * 🛍️ Public Route Name Enumeration
 * Routes for customer-facing pages that don't require authentication
 */
export const PublicRoutes = {
  Products: 'public.products',
  ProductDetails: 'public.product-details',
  StoreProducts: 'public.store-products',
  StoreProductDetails: 'public.store-product-details',
  StoreProductByCode: 'public.store-product-by-code',
} as const

/**
 * 🌐 Public Routes
 * Customer-facing pages accessible without authentication
 */
export const publicRoutes: RouteRecordRaw[] = [
  {
    path: '/l/:storeSlug/produtos',
    alias: ['/s/:storeSlug/products'],
    name: PublicRoutes.StoreProducts,
    component: () => import('@/views/products/ProductsView.vue'),
    meta: {
      title: 'Produtos',
      requiresAuth: false,
      public: true,
      module: 'catalog'
    }
  },
  {
    path: '/l/:storeSlug/produtos/:slug',
    alias: ['/s/:storeSlug/products/:slug'],
    name: PublicRoutes.StoreProductDetails,
    component: () => import('@/views/products/ProductDetailView.vue'),
    meta: {
      title: 'Produto',
      requiresAuth: false,
      public: true,
      module: 'catalog'
    }
  },
  {
    // Etapa 4 of the QR-code stock-exit evolution: the URL a printed QR
    // Code encodes (see bipdelivery/api/product_labels.py's
    // build_product_deep_link_url()). Reuses ProductDetailView.vue, the
    // same way StoreProductDetails does for a slug -- only the lookup key
    // differs (public_code instead of slug).
    path: '/l/:storeSlug/p/:code',
    name: PublicRoutes.StoreProductByCode,
    component: () => import('@/views/products/ProductDetailView.vue'),
    meta: {
      title: 'Produto',
      requiresAuth: false,
      public: true,
      module: 'catalog'
    }
  },
  {
    path: '/produtos',
    alias: ['/products'],
    name: PublicRoutes.Products,
    component: () => import('@/views/products/ProductsView.vue'),
    meta: {
      title: 'Produtos',
      requiresAuth: false,
      public: true,
      module: 'catalog'
    }
  },
  {
    path: '/produtos/:slug',
    alias: ['/products/:slug'],
    name: PublicRoutes.ProductDetails,
    component: () => import('@/views/products/ProductDetailView.vue'),
    meta: {
      title: 'Produto',
      requiresAuth: false,
      public: true,
      module: 'catalog'
    }
  }
]
