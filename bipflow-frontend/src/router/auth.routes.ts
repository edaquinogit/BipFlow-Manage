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
} as const;

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
    path: "/l/:storeSlug/login",
    component: () => import("@/views/auth/LoginView.vue"),
    meta: guestMeta("Entrar")
  },
  {
    path: "/s/:storeSlug/login",
    component: () => import("@/views/auth/LoginView.vue"),
    meta: guestMeta("Entrar")
  },
  {
    path: "/register",
    name: AuthRouteNames.Register,
    component: () => import("@/views/auth/RegisterView.vue"),
    meta: authTaskMeta("Criar Conta")
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
