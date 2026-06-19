import type { RouteRecordRaw } from 'vue-router'

/**
 * 🏷️ Route Name Enumeration (Padrão Sênior)
 * Centraliza os nomes das rotas para evitar erros de digitação em 'router.push'
 */
export const DashboardRoutes = {
  Root: 'dashboard'
} as const

/**
 * 📊 Dashboard Module Routes
 *
 * O dashboard é uma SPA single-page (painéis e drawers deslizantes dentro de
 * DashboardView.vue, sem <router-view> interno). Por isso esta rota não tem
 * filhas: qualquer rota aninhada aqui nunca renderizaria, já que não há um
 * router-view para montá-la.
 */
export const dashboardRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: DashboardRoutes.Root,
    component: () => import(/* webpackChunkName: "dashboard" */ '@/views/dashboard/DashboardView.vue'),
    meta: {
      requiresAuth: true,
      module: 'dashboard',
      title: 'Painel'
    }
  }
]
