<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowTopRightOnSquareIcon,
  ShoppingBagIcon,
} from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import { DashboardRoutes } from '@/router/dashboard.routes'
import { PublicRoutes } from '@/router/public.routes'
import type { ApiError } from '@/types/auth'

const router = useRouter()
const isLoading = ref(false)
const errorMessage = ref('')

const form = reactive({
  email: '',
  password: '',
})

const handleLogin = async () => {
  if (!form.email || !form.password) {
    errorMessage.value = 'Please fill in all fields.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await authService.login(form)
    router.push({ name: DashboardRoutes.Root })
  } catch (error) {
    const err = error as ApiError
    errorMessage.value = err.response?.data?.detail || 'Connection failed. Check your backend.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 p-4 text-white">
    <div
      class="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/30 lg:grid-cols-[1.08fr_0.92fr]"
    >
      <section
        class="relative hidden overflow-hidden border-r border-gray-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_30%),linear-gradient(160deg,_rgba(2,6,23,0.98),_rgba(17,24,39,0.96))] p-10 lg:flex lg:flex-col lg:justify-between"
      >
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
          <div class="absolute left-10 top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl"></div>
          <div class="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl"></div>
        </div>

        <div class="relative space-y-8">
          <span
            class="inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200"
          >
            Jornada pública
          </span>

          <div class="space-y-4">
            <h1 class="max-w-lg text-4xl font-bold tracking-tight text-white xl:text-5xl">
              O catálogo público fica acessível desde o primeiro carregamento.
            </h1>
            <p class="max-w-md text-sm leading-7 text-gray-300">
              Para visualizar a experiência do cliente, validar a vitrine ou testar a jornada
              de compra, o acesso pode acontecer sem autenticação. O login continua reservado
              para o fluxo administrativo.
            </p>
          </div>

          <RouterLink
            :to="{ name: PublicRoutes.Products }"
            class="group inline-flex w-fit items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition-all hover:border-cyan-300/50 hover:bg-cyan-400/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:ring-offset-2 focus:ring-offset-gray-950"
          >
            <ShoppingBagIcon class="h-5 w-5 transition-transform group-hover:scale-105" />
            <span>Abrir catálogo público</span>
            <ArrowTopRightOnSquareIcon
              class="h-4 w-4 text-cyan-100/80 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </RouterLink>
        </div>

        <div class="relative grid gap-4">
          <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p class="text-sm font-semibold text-white">Onde acessar</p>
            <p class="mt-2 font-mono text-xs text-cyan-200">http://localhost:5173/produtos</p>
          </div>

          <div class="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p class="text-sm font-semibold text-white">Por que esse atalho existe</p>
            <p class="mt-2 text-sm leading-6 text-gray-400">
              Ele reduz fricção para quem precisa testar a jornada pública sem se perder entre
              rotas administrativas.
            </p>
          </div>
        </div>
      </section>

      <section class="flex items-center p-6 sm:p-10">
        <div class="mx-auto w-full max-w-md">
          <div class="mb-8 text-center">
            <h2 class="text-3xl font-bold tracking-tight text-white">BipFlow Manage</h2>
            <p class="mt-2 text-sm text-gray-400">Sign in to manage your operation safely</p>
          </div>

          <div class="mb-6 rounded-2xl border border-gray-800 bg-gray-950/70 p-4 text-left lg:hidden">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Catálogo público
            </p>
            <p class="mt-2 text-sm leading-6 text-gray-400">
              Quer navegar como cliente? O catálogo fica disponível sem autenticação.
            </p>
            <RouterLink
              :to="{ name: PublicRoutes.Products }"
              class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
            >
              <ShoppingBagIcon class="h-4 w-4" />
              <span>Ir para o catálogo</span>
            </RouterLink>
          </div>

          <div
            v-if="errorMessage"
            class="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400"
          >
            {{ errorMessage }}
          </div>

          <form @submit.prevent="handleLogin" class="space-y-5">
            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email Address
              </label>
              <input
                v-model="form.email"
                type="email"
                placeholder="ceo@bipflow.com"
                class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Password
              </label>
              <input
                v-model="form.password"
                type="password"
                placeholder="........"
                class="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-white transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <button
              type="submit"
              :disabled="isLoading"
              class="flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700"
            >
              <span
                v-if="isLoading"
                class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
              ></span>
              {{ isLoading ? 'Authenticating...' : 'Sign In' }}
            </button>
          </form>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <RouterLink
              :to="{ name: PublicRoutes.Products }"
              class="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-cyan-200 transition-all hover:border-cyan-300/40 hover:bg-cyan-400/15"
            >
              <ShoppingBagIcon class="h-4 w-4" />
              Catalogo publico
            </RouterLink>
            <RouterLink
              :to="{ name: AuthRouteNames.Register }"
              class="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-200 transition-all hover:border-white/20 hover:bg-white/[0.08]"
            >
              Criar conta
            </RouterLink>
          </div>

          <div class="mt-8 space-y-4">
            <p class="text-center text-sm text-gray-500">
              By signing in, you agree to our
              <a href="#" class="text-blue-500 hover:underline">Terms of Service</a>.
            </p>

            <p class="text-center text-xs leading-6 text-gray-500">
              Se a sua intenção for validar a experiência do cliente, use o acesso rápido para o
              catálogo público nesta mesma tela.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
