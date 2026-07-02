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
