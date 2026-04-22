import type { RouteRecordRaw } from 'vue-router'

/**
 * 🛍️ Public Route Name Enumeration
 * Routes for customer-facing pages that don't require authentication
 */
export const PublicRoutes = {
  Products: 'public.products',
  ProductDetails: 'public.product-details',
} as const

/**
 * 🌐 Public Routes
 * Customer-facing pages accessible without authentication
 */
export const publicRoutes: RouteRecordRaw[] = [
  {
    path: '/produtos',
    alias: ['/products'],
    name: PublicRoutes.Products,
    component: () => import(/* webpackChunkName: "public-products" */ '@/views/products/ProductsView.vue'),
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
    component: () => import(/* webpackChunkName: "public-product-details" */ '@/views/products/ProductDetailView.vue'),
    meta: {
      title: 'Produto',
      requiresAuth: false,
      public: true,
      module: 'catalog'
    }
  }
]
