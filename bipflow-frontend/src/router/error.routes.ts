import type { RouteRecordRaw } from 'vue-router'

/**
 * 🏷️ Error Routes Enumeration
 * Centraliza os nomes para redirecionamentos internos (ex: router.push({ name: ErrorRoutes.Forbidden }))
 */
export const ErrorRoutes = {
  Forbidden: 'error.forbidden',
  ServerError: 'error.server-error',
  NotFound: 'error.not-found'
} as const

/**
 * ⚠️ System Error & Fallback Routes
 * Padrão: Clean Code, Public Accessibility & SEO Friendly Titles.
 */
export const errorRoutes: RouteRecordRaw[] = [
  {
    path: '/403',
    name: ErrorRoutes.Forbidden,
    component: () => import(/* webpackChunkName: "error-403" */ '@/views/errors/ForbiddenView.vue'),
    meta: { 
      public: true, 
      title: 'Acesso Negado',
      module: 'system'
    }
  },
  {
    path: '/500',
    name: ErrorRoutes.ServerError,
    component: () => import(/* webpackChunkName: "error-500" */ '@/views/errors/ServerErrorView.vue'),
    meta: { 
      public: true, 
      title: 'Erro no Servidor',
      module: 'system'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: ErrorRoutes.NotFound,
    component: () => import(/* webpackChunkName: "error-404" */ '@/views/errors/NotFoundView.vue'),
    meta: { 
      public: true, 
      title: 'Página não Encontrada',
      module: 'system'
    }
  }
]