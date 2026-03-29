
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { authRoutes, AuthRouteNames } from './auth.routes'
import { dashboardRoutes, DashboardRoutes } from './dashboard.routes'
import { errorRoutes } from './error.routes'

/**
 * 🔀 Route Aggregation
 * Estrutura flat para performance máxima do matcher.
 */
const routes: RouteRecordRaw[] = [
  ...authRoutes,
  ...dashboardRoutes,
  ...errorRoutes
]

/**
 * 🔐 Auth State Helper
 * Centraliza a verificação para facilitar migração futura (ex: Pinia/Cookies).
 */
const isAuthenticated = (): boolean => {
  return !!(localStorage.getItem('access_token') || localStorage.getItem('token'))
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    // Se houver posição salva (ex: botão voltar), retorna para ela
    if (savedPosition) return savedPosition
    // Se a rota tiver um hash (ex: #contato), foca no elemento
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    // Caso contrário, topo da página
    return { top: 0, behavior: 'smooth' }
  }
})

/**
 * 🛡️ Navigation Guard (Enterprise Pattern)
 * Implementação limpa sem 'next()', seguindo o padrão moderno do Vue Router 4.
 */
router.beforeEach((to) => {
  const isLogged = isAuthenticated()

  // 1. Proteção de Rotas Privadas (Requires Auth)
  if (to.meta.requiresAuth && !isLogged) {
    return { 
      name: AuthRouteNames.Login, 
      query: { redirect: to.fullPath } 
    }
  }

  // 2. Proteção de Rotas de Convidados (Guest Only - Login/Register)
  if (to.meta.guestOnly && isLogged) {
    return { name: DashboardRoutes.Root }
  }

  // 3. Telemetria em modo Desenvolvimento
  if (import.meta.env.DEV) {
    const moduleName = to.meta.module || 'system'
    console.info(`[Router] Navigating to: ${String(to.name)} | Module: ${moduleName}`)
  }

  // Se nenhuma condição acima for atendida, a navegação flui naturalmente
})

/**
 * 🏁 Global After Hooks
 */
router.afterEach((to) => {
  // Define o título da página dinamicamente
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} | BipFlow` : 'BipFlow - Manage'
})

export default router