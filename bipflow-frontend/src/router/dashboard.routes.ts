import type { RouteRecordRaw } from 'vue-router'

/**
 * 🏷️ Route Name Enumeration (Padrão Sênior)
 * Centraliza os nomes das rotas para evitar erros de digitação em 'router.push'
 */
export const DashboardRoutes = {
  Layout: 'dashboard.layout',
  Overview: 'dashboard.overview',
  Products: 'dashboard.products',
  StockMovements: 'dashboard.products.stock-movements',
  Pdv: 'dashboard.pdv',
  Orders: 'dashboard.orders',
  Support: 'dashboard.support',
  SupportConversation: 'dashboard.support.conversation',
  Settings: 'dashboard.settings',
} as const

/**
 * 📊 Dashboard Module Routes
 *
 * Cada secao da central de operacao (vitrine, produtos, pedidos,
 * atendimento, configuracoes) tem sua propria URL navegavel -- o mesmo
 * padrao que a vitrine publica (`/produtos`) ja usava. `DashboardLayout.vue`
 * monta uma vez (header, troca de loja, banner de erro) e renderiza a pagina
 * ativa no `<router-view>` interno.
 */
export const dashboardRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: DashboardRoutes.Overview },
  },
  {
    path: '/dashboard',
    name: DashboardRoutes.Layout,
    component: () => import('@/views/dashboard/DashboardLayout.vue'),
    meta: {
      requiresAuth: true,
      module: 'dashboard',
    },
    children: [
      {
        path: '',
        name: DashboardRoutes.Overview,
        component: () => import('@/views/dashboard/DashboardOverviewView.vue'),
        meta: { title: 'Visao geral' },
      },
      {
        path: 'produtos',
        name: DashboardRoutes.Products,
        component: () => import('@/views/dashboard/DashboardProductsView.vue'),
        meta: { title: 'Produtos' },
      },
      {
        path: 'produtos/movimentacoes',
        name: DashboardRoutes.StockMovements,
        component: () => import('@/views/dashboard/DashboardStockMovementsView.vue'),
        meta: { title: 'Historico de estoque' },
      },
      {
        path: 'pdv',
        name: DashboardRoutes.Pdv,
        component: () => import('@/views/dashboard/DashboardPdvView.vue'),
        meta: { title: 'PDV' },
      },
      {
        path: 'pedidos',
        name: DashboardRoutes.Orders,
        component: () => import('@/views/dashboard/DashboardOrdersView.vue'),
        meta: { title: 'Pedidos' },
      },
      {
        path: 'atendimento',
        name: DashboardRoutes.Support,
        component: () => import('@/views/dashboard/DashboardSupportView.vue'),
        meta: { title: 'Atendimento' },
      },
      {
        path: 'atendimento/:conversationId',
        name: DashboardRoutes.SupportConversation,
        component: () => import('@/views/dashboard/DashboardSupportView.vue'),
        props: true,
        meta: { title: 'Atendimento' },
      },
      {
        path: 'configuracoes',
        name: DashboardRoutes.Settings,
        component: () => import('@/views/dashboard/DashboardSettingsView.vue'),
        meta: { title: 'Configuracoes' },
      },
    ],
  },
]
