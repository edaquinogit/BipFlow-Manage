import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    }
  ]
})

// O "Guarda" de Navegação Único e Robusto
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('token')

  // 1. Se a rota exige login e você não tem o token: tchau!
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
  } 
  // 2. Se você JÁ está logado e tenta ir para a tela de login: volta pro dashboard!
  else if (to.name === 'login' && isAuthenticated) {
    next({ name: 'dashboard' })
  } 
  // 3. Caso contrário: segue viagem
  else {
    next()
  }
})

export default router