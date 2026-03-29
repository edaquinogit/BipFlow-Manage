import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

/**
 * 🛰️ REGISTRY: Definição de Rotas com Tipagem Estrita e Code-Splitting
 * Otimizado para performance de carregamento (LCP) e escalabilidade.
 */
const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "dashboard",
    // Carregamento imediato para a rota principal
    component: () => import("@/views/DashboardView.vue"),
    meta: {
      requiresAuth: true,
      title: "Inventory | BipFlow Core",
      module: "Main Dashboard",
    },
  },
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/LoginView.vue"),
    meta: {
      guestOnly: true,
      title: "Auth | BipFlow Station",
      module: "Access Control",
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("@/views/NotFoundView.vue"),
    meta: {
      title: "404 - Not Found",
      module: "System",
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // ⚡ UX: Preservação de posição de scroll entre navegações
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    return { top: 0, behavior: "smooth" };
  },
});

/**
 * 🛡️ SECURITY & NAVIGATION ORCHESTRATOR
 * Implementa o protocolo de guarda de navegação com tratamento de intenção (Redirect Memory).
 */
router.beforeEach((to, from, next) => {
  // 1. DYNAMIC METADATA (SEO & Branding)
  const baseTitle = "BipFlow";
  document.title = to.meta.title ? `${to.meta.title}` : baseTitle;

  // 2. AUTHENTICATION STATE (Sincronizado com o LocalStorage do Cypress/App)
  // Nota: access_token é o padrão usado no seu comando cy.loginViaApi()
  const token = localStorage.getItem("access_token");
  const isAuthenticated = !!token;

  /**
   * 🚨 INTERCEPTOR: Acesso não autorizado
   * Redireciona para o login salvando a rota pretendida para retorno após auth.
   */
  if (to.meta.requiresAuth && !isAuthenticated) {
    if (import.meta.env.DEV) {
      console.warn(
        `[BipFlow Guard]: Unauthorized access to ${to.fullPath}. Redirecting to Login.`,
      );
    }
    return next({
      name: "login",
      query: { redirect: to.fullPath },
    });
  }

  /**
   * 🚫 INTERCEPTOR: Redirecionamento de Logado
   * Impede que o usuário volte ao login manualmente se a sessão estiver ativa.
   */
  if (to.meta.guestOnly && isAuthenticated) {
    return next({ name: "dashboard" });
  }

  // 3. TELEMETRY & AUDIT (Apenas em Dev)
  if (import.meta.env.DEV) {
    console.info(
      `🚀 Navigating: ${String(to.name)} | Context: ${to.meta.module}`,
    );
  }

  next();
});

/**
 * 🛰️ POST-NAVIGATION HOOKS
 */
router.afterEach((_to) => {
  // Finalização de loadings globais ou disparos de analytics podem entrar aqui
});

export default router;
