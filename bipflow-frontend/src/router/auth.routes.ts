// src/router/auth.routes.ts
import type { RouteRecordRaw } from 'vue-router'

/**
 * Nomes de rota centralizados para evitar strings mágicas
 * e facilitar refactors e testes
 */
export const AuthRouteNames = {
  Login: 'login',
  Register: 'register',
  ForgotPassword: 'forgot-password',
  ResetPassword: 'reset-password'
} as const

type AuthRouteName = (typeof AuthRouteNames)[keyof typeof AuthRouteNames]

/**
 * Helper para criar meta padrão de rotas auth
 */
const guestMeta = (title?: string) => ({ guestOnly: true, public: true, title })

/**
 * Rotas de autenticação
 * - props: extrai token de query ou params
 * - lazy loaded components
 * - nomes centralizados
 */
export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: AuthRouteNames.Login,
    component: () => import('@/views/LoginView.vue'),
    meta: guestMeta('Login')
  },
  {
    path: '/register',
    name: AuthRouteNames.Register,
    component: () => import('@/views/RegisterView.vue'),
    meta: guestMeta('Registrar')
  },
  {
    path: '/forgot-password',
    name: AuthRouteNames.ForgotPassword,
    component: () => import('@/views/auth/ForgotPasswordView.vue'),
    meta: guestMeta('Recuperar senha')
  },
  {
    // rota única que aceita token via query ou param
    path: '/reset-password/:token?',
    name: AuthRouteNames.ResetPassword,
    component: () => import('@/views/auth/ResetPasswordView.vue'),
    props: (route) => ({
      token: (route.params?.token as string) || (route.query?.token as string) || ''
    }),
    meta: guestMeta('Redefinir senha')
  }
]