import type { RouteRecordRaw } from 'vue-router'

/**
 * 🏷️ Route Name Enumeration (Padrão Sênior)
 * Centraliza os nomes das rotas para evitar erros de digitação em 'router.push'
 */
export const DashboardRoutes = {
  Root: 'dashboard',
  Home: 'dashboard.home',
  Products: 'dashboard.products',
  ProductCreate: 'dashboard.products.create',
  ProductEdit: 'dashboard.products.edit',
  Categories: 'dashboard.categories',
  Settings: 'dashboard.settings'
} as const

/**
 * 📊 Dashboard Module Routes
 * Padrão: Clean Code, Lazy Loading & Meta Inheritance.
 */
export const dashboardRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: DashboardRoutes.Root,
    component: () => import(/* webpackChunkName: "dashboard" */ '@/views/dashboard/DashboardView.vue'),
    meta: { 
      requiresAuth: true, 
      module: 'dashboard' 
    },
    children: [
      {
        path: '',
        name: DashboardRoutes.Home,
        component: () => import(/* webpackChunkName: "dashboard-home" */ '@/views/dashboard/OverviewView.vue'),
        meta: { title: 'Visão Geral' }
      },
      {
        path: 'products',
        meta: { title: 'Gestão de Produtos' },
        children: [
          {
            path: '',
            name: DashboardRoutes.Products,
            component: () => import(/* webpackChunkName: "products" */ '@/views/dashboard/products/ProductListView.vue'),
          },
          {
            path: 'new',
            name: DashboardRoutes.ProductCreate,
            component: () => import(/* webpackChunkName: "products-form" */ '@/views/dashboard/products/ProductFormView.vue'),
          },
          {
            path: ':id/edit',
            name: DashboardRoutes.ProductEdit,
            component: () => import(/* webpackChunkName: "products-form" */ '@/views/dashboard/products/ProductFormView.vue'),
            props: true,
          }
        ]
      },
      {
        path: 'categories',
        name: DashboardRoutes.Categories,
        component: () => import(/* webpackChunkName: "categories" */ '@/views/dashboard/categories/CategoryListView.vue'),
        meta: { title: 'Categorias' }
      },
      {
        path: 'settings',
        name: DashboardRoutes.Settings,
        component: () => import(/* webpackChunkName: "settings" */ '@/views/dashboard/SettingsView.vue'),
        meta: { title: 'Configurações' }
      }
    ]
  }
]