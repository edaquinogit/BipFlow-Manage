import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';

/**
 * 🛰️ REGISTRY: Estrutura de Rotas com Tipagem Estrita
 * Utilizamos Lazy Loading para reduzir o bundle inicial e melhorar o FCP (First Contentful Paint).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
    meta: { 
      requiresAuth: true, 
      title: 'Inventory | BipFlow Core',
      module: 'Main Dashboard'
    }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { 
      guestOnly: true, 
      title: 'Auth | BipFlow Station',
      module: 'Access Control'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { 
      title: '404 - Not Found',
      module: 'System'
    }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // ⚡ Experiência de Usuário: Scroll suave entre rotas
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    return { top: 0, behavior: 'smooth' };
  }
});

/**
 * 🛡️ SECURITY & NAVIGATION ORCHESTRATOR
 * Implementa o protocolo de guarda de navegação com telemetria básica.
 */
router.beforeEach((to, from, next) => {
  // 1. UPDATING SYSTEM METADATA (Document Title)
  const baseTitle = 'BipFlow';
  const pageTitle = to.meta.title ? `${to.meta.title}` : baseTitle;
  document.title = pageTitle;

  // 2. IDENTITY VERIFICATION
  // Em projetos reais, substitua localStorage por um Store reativo (Pinia)
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;

  /**
   * 🚨 UNAUTHORIZED INTERCEPTION
   * Bloqueia acesso a rotas privadas e guarda a intenção original do usuário (Redirect Memory).
   */
  if (to.meta.requiresAuth && !isAuthenticated) {
    console.warn(`[BipFlow Guard]: Unauthorized attempt to ${to.fullPath}. Redirecting...`);
    return next({ 
      name: 'login',
      query: { redirect: to.fullPath } 
    });
  }

  /**
   * 🚫 AUTHENTICATED REDIRECTION
   * Impede que usuários logados retornem à tela de login via URL.
   */
  if (to.meta.guestOnly && isAuthenticated) {
    return next({ name: 'dashboard' });
  }

  // 3. TELEMETRY LOG (Audit)
  if (import.meta.env.DEV) {
    console.info(`🚀 Navigating to: ${String(to.name)} | Module: ${to.meta.module}`);
  }

  next();
});

/**
 * 🛰️ GLOBAL AFTER HOOKS
 * Ideal para encerrar barras de progresso ou disparar analytics.
 */
router.afterEach((to) => {
  // Exemplo: Disparar evento de visualização de página
  // analytics.logPageView(to.name);
});

export default router;