import type { RouteRecordRaw } from "vue-router";

/**
 * 🏷️ Centralized Auth Route Names
 * Evita "Magic Strings" e garante consistência em redirects e testes.
 */
export const AuthRouteNames = {
  Login: "auth.login",
  Register: "auth.register",
  ForgotPassword: "auth.forgot-password",
  ResetPassword: "auth.reset-password",
  CreateCustomerProfile: "auth.create-customer-profile",
  CustomerAccount: "auth.customer-account",
  CustomerLogin: "auth.customer-login",
} as const;

/**
 * 🧭 Storefront customer path builders
 *
 * CreateCustomerProfile/CustomerAccount/CustomerLogin are only registered
 * with a `name` on the slug-scoped path variant (`/l/:storeSlug/...`) --
 * pushing that name with an empty storeSlug throws "missing required
 * param". Every consumer needs a plain path string instead, chosen by
 * whether a storeSlug is known; centralized here so the three call sites
 * (useCheckoutProfileGate, CustomerProfileMenuButton, CartDrawer) can't
 * drift out of sync with each other or with the routes below.
 */
export function createCustomerProfilePath(storeSlug: string): string {
  return storeSlug ? `/l/${storeSlug}/perfil/criar` : "/perfil/criar";
}

export function customerAccountPath(storeSlug: string): string {
  return storeSlug ? `/l/${storeSlug}/conta` : "/conta";
}

export function customerLoginPath(storeSlug: string): string {
  return storeSlug ? `/l/${storeSlug}/login` : "/entrar";
}

/**
 * 🛡️ Guest Meta Helper
 * Define permissões para rotas acessíveis apenas por usuários não autenticados.
 *
 * Só faz sentido para /login: se você já está logado, não há motivo para ver
 * o formulário de login de novo. As demais (registrar segunda loja, recuperar
 * senha de OUTRA conta, ou completar um link de reset clicado enquanto uma
 * sessão antiga ainda está ativa em outra aba) são tarefas legítimas mesmo
 * autenticado -- guestOnly nelas bloqueava essas tarefas, jogando o usuário
 * direto para o dashboard sem nunca completar o que veio fazer.
 */
const guestMeta = (title: string) => ({
  guestOnly: true, // Redireciona para o Dashboard se já estiver logado
  public: true,
  title,
  module: "auth"
});

const authTaskMeta = (title: string) => ({
  public: true,
  title,
  module: "auth"
});

/**
 * 🚀 Authentication Routes
 * Estrutura modular com Lazy Loading e caminhos normalizados para @/views/auth/
 */
export const authRoutes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: AuthRouteNames.Login,
    component: () => import("@/views/auth/LoginView.vue"),
    meta: guestMeta("Entrar")
  },
  {
    // Storefront customer login -- deliberately its OWN component, not
    // LoginView.vue (which is dashboard-branded: "Painel administrativo",
    // dashboard feature highlights). A shopper clicking "Entrar" from the
    // vitrine must land somewhere that reads as logging into their
    // customer profile, not into the admin panel. Not guestOnly, same
    // reasoning as CreateCustomerProfile/CustomerAccount below.
    path: "/l/:storeSlug/login",
    name: AuthRouteNames.CustomerLogin,
    component: () => import("@/views/customer/CustomerLoginView.vue"),
    meta: authTaskMeta("Entrar")
  },
  {
    path: "/s/:storeSlug/login",
    component: () => import("@/views/customer/CustomerLoginView.vue"),
    meta: authTaskMeta("Entrar")
  },
  {
    path: "/entrar",
    component: () => import("@/views/customer/CustomerLoginView.vue"),
    meta: authTaskMeta("Entrar")
  },
  {
    path: "/register",
    name: AuthRouteNames.Register,
    component: () => import("@/views/auth/RegisterView.vue"),
    meta: authTaskMeta("Criar Conta")
  },
  {
    // Storefront customer profile creation (not dashboard registration) --
    // deliberately not guestOnly: an already-authenticated visitor (e.g. a
    // dashboard owner browsing their own storefront) should still be able
    // to load this route and see the "you already have a profile" state
    // handled inside the component, rather than being redirected into the
    // dashboard by the guestOnly guard (which has no concept of a
    // storefront-customer context to redirect back to).
    path: "/l/:storeSlug/perfil/criar",
    name: AuthRouteNames.CreateCustomerProfile,
    component: () => import("@/views/customer/CreateCustomerProfileView.vue"),
    meta: authTaskMeta("Criar perfil")
  },
  {
    path: "/s/:storeSlug/perfil/criar",
    component: () => import("@/views/customer/CreateCustomerProfileView.vue"),
    meta: authTaskMeta("Criar perfil")
  },
  {
    path: "/perfil/criar",
    component: () => import("@/views/customer/CreateCustomerProfileView.vue"),
    meta: authTaskMeta("Criar perfil")
  },
  {
    // Minimal authenticated customer account page (profile data + logout) --
    // deliberately not guestOnly, same reasoning as CreateCustomerProfile.
    path: "/l/:storeSlug/conta",
    name: AuthRouteNames.CustomerAccount,
    component: () => import("@/views/customer/CustomerAccountView.vue"),
    meta: { public: true, title: "Minha conta", module: "auth", requiresCustomerAuth: true }
  },
  {
    path: "/s/:storeSlug/conta",
    component: () => import("@/views/customer/CustomerAccountView.vue"),
    meta: { public: true, title: "Minha conta", module: "auth", requiresCustomerAuth: true }
  },
  {
    path: "/conta",
    component: () => import("@/views/customer/CustomerAccountView.vue"),
    meta: { public: true, title: "Minha conta", module: "auth", requiresCustomerAuth: true }
  },
  {
    path: "/forgot-password",
    name: AuthRouteNames.ForgotPassword,
    component: () => import("@/views/auth/ForgotPasswordView.vue"),
    meta: authTaskMeta("Recuperar Senha")
  },
  {
    /**
     * Rota híbrida para Reset de Senha
     * Aceita o token via URL Params (/reset-password/abc) ou Query String (?token=abc)
     */
    path: "/reset-password/:token?",
    name: AuthRouteNames.ResetPassword,
    component: () => import("@/views/auth/ResetPasswordView.vue"),
    props: (route) => ({
      token: (route.params?.token as string) || (route.query?.token as string) || ""
    }),
    meta: authTaskMeta("Redefinir Senha")
  }
];
