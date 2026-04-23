<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
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
  <main class="login-shell min-h-screen overflow-hidden bg-gray-950 px-4 py-6 text-white sm:px-6">
    <div class="login-orbit" aria-hidden="true"></div>
    <div class="login-grid" aria-hidden="true"></div>

    <section class="relative z-10 flex min-h-[calc(100vh-3rem)] items-center justify-center">
      <div
        class="login-card w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-gray-900/85 p-6 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-8"
      >
        <div class="login-card-glow" aria-hidden="true"></div>

        <div class="relative">
          <div class="mb-8 text-center">
            <div
              class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 shadow-lg shadow-black/30"
            >
              <span class="text-lg font-black tracking-tighter text-indigo-500">BF</span>
            </div>
            <p class="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-500">
              Painel Administrativo
            </p>
            <h1 class="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              BipFlow Manage
            </h1>
            <p class="mt-2 text-sm leading-6 text-gray-400">
              Acesse seu painel para gerenciar produtos, categorias e operacao.
            </p>
          </div>

          <div
            v-if="errorMessage"
            class="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
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
                autocomplete="email"
                placeholder="admin@bipflow.com"
                class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 shadow-inner transition-all placeholder:text-zinc-700 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
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
                autocomplete="current-password"
                placeholder="........"
                class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 shadow-inner transition-all placeholder:text-zinc-700 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                required
              />
            </div>

            <button
              type="submit"
              :disabled="isLoading"
              class="flex w-full items-center justify-center rounded-xl bg-white py-3 text-xs font-black uppercase tracking-widest text-black shadow-xl shadow-white/5 transition-all hover:-translate-y-0.5 hover:bg-zinc-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              <span
                v-if="isLoading"
                class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-950/20 border-t-gray-950"
              ></span>
              {{ isLoading ? 'Authenticating...' : 'Sign In' }}
            </button>
          </form>

          <div class="mt-5 flex flex-col gap-3 sm:flex-row">
            <RouterLink
              :to="{ name: AuthRouteNames.ForgotPassword }"
              class="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-400 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300"
            >
              Recuperar senha
            </RouterLink>

            <RouterLink
              :to="{ name: AuthRouteNames.Register }"
              class="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-300 transition-all hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              Criar conta
            </RouterLink>
          </div>

          <div class="mt-7 border-t border-white/10 pt-5 text-center">
            <RouterLink
              :to="{ name: PublicRoutes.Products }"
              class="group inline-flex items-center justify-center gap-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-indigo-400"
            >
              <ShoppingBagIcon class="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
              Ver catalogo publico
            </RouterLink>
            <p class="mt-4 text-xs leading-5 text-gray-600">
              Acesso administrativo protegido por credenciais. Use uma conta autorizada.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-shell {
  position: relative;
  background:
    radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.12), transparent 32rem),
    radial-gradient(circle at 15% 85%, rgba(39, 39, 42, 0.8), transparent 28rem),
    #09090b;
}

.login-orbit {
  position: absolute;
  inset: -18rem;
  background:
    conic-gradient(
      from 180deg,
      transparent 0deg,
      rgba(99, 102, 241, 0.08) 72deg,
      transparent 150deg,
      rgba(255, 255, 255, 0.07) 240deg,
      transparent 360deg
    );
  filter: blur(36px);
  animation: login-orbit-spin 24s linear infinite;
}

.login-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at center, black, transparent 72%);
}

.login-card {
  position: relative;
  isolation: isolate;
}

.login-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -2;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.42),
    rgba(255, 255, 255, 0.04),
    rgba(255, 255, 255, 0.16)
  );
  opacity: 0.55;
}

.login-card-glow {
  position: absolute;
  inset: auto -30% -30% -30%;
  height: 16rem;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.18), transparent 66%);
  animation: login-glow-float 8s ease-in-out infinite alternate;
}

@keyframes login-orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes login-glow-float {
  from {
    transform: translate3d(-4%, 0, 0) scale(1);
  }

  to {
    transform: translate3d(4%, -8%, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-orbit,
  .login-card-glow {
    animation: none;
  }
}
</style>
