<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CheckCircleIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import type { ApiError } from '@/types/auth'

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  email: '',
  password: '',
  confirm_password: '',
})

const passwordRules = computed(() => [
  { label: 'No minimo 8 caracteres', passed: form.password.length >= 8 },
  { label: 'Contem uma letra', passed: /[A-Za-z]/.test(form.password) },
  { label: 'Contem um numero', passed: /\d/.test(form.password) },
  {
    label: 'Confirmacao igual a senha',
    passed: Boolean(form.confirm_password) && form.password === form.confirm_password,
  },
])

const isFormReady = computed(() =>
  Boolean(form.email.trim()) && passwordRules.value.every((rule) => rule.passed)
)

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  const data = err.response?.data

  if (!data) return 'Nao foi possivel criar sua conta agora.'
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.message === 'string') return data.message

  const firstFieldError = Object.values(data).find((value) => Array.isArray(value) || typeof value === 'string')

  if (Array.isArray(firstFieldError)) {
    return String(firstFieldError[0] || 'Confira os dados informados.')
  }

  return typeof firstFieldError === 'string'
    ? firstFieldError
    : 'Confira os dados informados e tente novamente.'
}

const handleRegister = async () => {
  if (!isFormReady.value) {
    errorMessage.value = 'Preencha email, senha e confirmacao seguindo os criterios de seguranca.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await authService.register({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      confirm_password: form.confirm_password,
    })
    successMessage.value = response.message
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="register-shell min-h-screen overflow-hidden bg-gray-950 px-4 py-6 text-white sm:px-6">
    <div class="register-orbit" aria-hidden="true"></div>
    <div class="register-grid" aria-hidden="true"></div>

    <section class="relative z-10 flex min-h-[calc(100vh-3rem)] items-center justify-center">
      <div
        class="register-card w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-gray-900/85 p-6 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-8"
      >
        <div class="register-card-glow" aria-hidden="true"></div>

        <div class="relative">
          <div class="mb-8 text-center">
            <div
              class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 shadow-lg shadow-black/30"
            >
              <span class="text-lg font-black tracking-tighter text-indigo-500">BF</span>
            </div>
            <p class="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-500">
              Novo acesso
            </p>
            <h1 class="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Criar conta
            </h1>
            <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-400">
              Configure uma credencial administrativa segura para acessar o BipFlow Manage.
            </p>
          </div>

          <div
            v-if="successMessage"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"
          >
            <div class="flex gap-3">
              <CheckCircleIcon class="h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p class="font-semibold">Conta criada</p>
                <p class="mt-1 leading-6 text-emerald-100/80">{{ successMessage }}</p>
              </div>
            </div>
          </div>

          <div
            v-if="errorMessage"
            class="mb-6 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {{ errorMessage }}
          </div>

          <form v-if="!successMessage" @submit.prevent="handleRegister" class="space-y-5">
            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email
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
                Senha
              </label>
              <input
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                placeholder="Crie uma senha segura"
                class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 shadow-inner transition-all placeholder:text-zinc-700 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Confirmar senha
              </label>
              <input
                v-model="form.confirm_password"
                type="password"
                autocomplete="new-password"
                placeholder="Repita a senha"
                class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-100 shadow-inner transition-all placeholder:text-zinc-700 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                required
              />
            </div>

            <ul class="grid gap-2 border-t border-white/10 pt-4">
              <li
                v-for="rule in passwordRules"
                :key="rule.label"
                class="flex items-center gap-2 text-xs"
                :class="rule.passed ? 'text-emerald-300' : 'text-gray-500'"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :class="rule.passed ? 'bg-emerald-300' : 'bg-gray-700'"
                ></span>
                {{ rule.label }}
              </li>
            </ul>

            <button
              type="submit"
              :disabled="isSubmitting || !isFormReady"
              class="flex w-full items-center justify-center rounded-xl bg-white py-3 text-xs font-black uppercase tracking-widest text-black shadow-xl shadow-white/5 transition-all hover:-translate-y-0.5 hover:bg-zinc-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {{ isSubmitting ? 'Criando conta...' : 'Criar conta segura' }}
            </button>
          </form>

          <div class="mt-7 border-t border-white/10 pt-5 text-center">
            <RouterLink
              :to="{ name: AuthRouteNames.Login }"
              class="text-sm font-semibold text-zinc-400 transition-colors hover:text-indigo-300"
            >
              Ja tenho conta administrativa
            </RouterLink>
            <p class="mt-4 text-xs leading-5 text-gray-600">
              Contas administrativas devem ser usadas apenas por pessoas autorizadas.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.register-shell {
  position: relative;
  background:
    radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.12), transparent 32rem),
    radial-gradient(circle at 15% 85%, rgba(39, 39, 42, 0.8), transparent 28rem),
    #09090b;
}

.register-orbit {
  position: absolute;
  inset: -18rem;
  background:
    conic-gradient(
      from 180deg,
      transparent 0deg,
      rgba(99, 102, 241, 0.08) 72deg,
      transparent 150deg,
      rgba(255, 255, 255, 0.06) 240deg,
      transparent 360deg
    );
  filter: blur(36px);
  animation: register-orbit-spin 24s linear infinite;
}

.register-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at center, black, transparent 72%);
}

.register-card {
  position: relative;
  isolation: isolate;
}

.register-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  z-index: -2;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.42),
    rgba(255, 255, 255, 0.04),
    rgba(255, 255, 255, 0.14)
  );
  opacity: 0.55;
}

.register-card-glow {
  position: absolute;
  inset: auto -30% -30% -30%;
  height: 16rem;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.18), transparent 66%);
  animation: register-glow-float 8s ease-in-out infinite alternate;
}

@keyframes register-orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes register-glow-float {
  from {
    transform: translate3d(-4%, 0, 0) scale(1);
  }

  to {
    transform: translate3d(4%, -8%, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .register-orbit,
  .register-card-glow {
    animation: none;
  }
}
</style>
