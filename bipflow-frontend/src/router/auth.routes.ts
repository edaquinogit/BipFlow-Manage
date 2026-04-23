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
 */
const guestMeta = (title: string) => ({
  guestOnly: true, // Redireciona para o Dashboard se já estiver logado
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
    component: () => import(/* webpackChunkName: "auth-login" */ "@/views/auth/LoginView.vue"),
    meta: guestMeta("Entrar")
  },
  {
    path: "/register",
    name: AuthRouteNames.Register,
    component: () => import(/* webpackChunkName: "auth-register" */ "@/views/auth/RegisterView.vue"),
    meta: guestMeta("Criar Conta")
  },
  {
    path: "/forgot-password",
    name: AuthRouteNames.ForgotPassword,
    component: () => import(/* webpackChunkName: "auth-forgot" */ "@/views/auth/ForgotPasswordView.vue"),
    meta: guestMeta("Recuperar Senha")
  },
  {
    /**
     * Rota híbrida para Reset de Senha
     * Aceita o token via URL Params (/reset-password/abc) ou Query String (?token=abc)
     */
    path: "/reset-password/:token?",
    name: AuthRouteNames.ResetPassword,
    component: () => import(/* webpackChunkName: "auth-reset" */ "@/views/auth/ResetPasswordView.vue"),
    props: (route) => ({
      token: (route.params?.token as string) || (route.query?.token as string) || ""
    }),
    meta: guestMeta("Redefinir Senha")
  }
];
