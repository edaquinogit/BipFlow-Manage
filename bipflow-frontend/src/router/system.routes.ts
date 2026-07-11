import type { RouteRecordRaw } from 'vue-router'

export const SystemRoutes = {
  Status: 'system.status'
} as const

// Standalone, unauthenticated route dedicated to CI/pipeline verification
// and manual debugging -- not part of any user-facing flow. Curling any SPA
// route returns 200 for the same static index.html shell regardless of
// whether Vue actually mounted, so this page exists to give the pipeline
// (and a human) something real to check: a client-rendered marker plus a
// live backend connectivity probe. See cypress/e2e/system_status.cy.ts.
export const systemRoutes: RouteRecordRaw[] = [
  {
    path: '/status',
    name: SystemRoutes.Status,
    component: () => import('@/views/system/StatusView.vue'),
    meta: { title: 'Status', requiresAuth: false, public: true, module: 'system' }
  }
]
