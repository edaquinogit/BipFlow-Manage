<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { EnvelopeIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import type { ApiError } from '@/types/auth'

const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  email: '',
})

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  return err.response?.data?.detail || err.response?.data?.message || 'Nao foi possivel enviar o link agora.'
}

const handlePasswordResetRequest = async () => {
  if (!form.email.trim()) {
    errorMessage.value = 'Informe o email cadastrado para continuar.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await authService.requestPasswordReset({
      email: form.email.trim().toLowerCase(),
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
  <main class="forgot-shell min-h-screen overflow-hidden bg-gray-950 px-4 py-6 text-white sm:px-6">
    <div class="forgot-orbit" aria-hidden="true"></div>
    <div class="forgot-grid" aria-hidden="true"></div>

    <section class="relative z-10 flex min-h-[calc(100vh-3rem)] items-center justify-center">
      <div
        class="forgot-card w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-gray-900/85 p-6 shadow-2xl shadow-black/35 backdrop-blur-2xl sm:p-8"
      >
        <div class="forgot-card-glow" aria-hidden="true"></div>

        <div class="relative">
          <div class="mb-8 text-center">
            <div
              class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 shadow-lg shadow-black/30"
            >
              <span class="text-lg font-black tracking-tighter text-indigo-500">BF</span>
            </div>
            <p class="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-500">
              Recuperacao segura
            </p>
            <h1 class="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Redefinir senha
            </h1>
            <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-400">
              Informe o email administrativo para receber um link seguro de recuperacao.
            </p>
          </div>

          <div
            v-if="successMessage"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"
          >
            <div class="flex gap-3">
              <EnvelopeIcon class="h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p class="font-semibold">Email enviado</p>
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

          <form v-if="!successMessage" @submit.prevent="handlePasswordResetRequest" class="space-y-5">
            <div>
              <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email cadastrado
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

            <button
              type="submit"
              :disabled="isSubmitting"
              class="flex w-full items-center justify-center rounded-xl bg-white py-3 text-xs font-black uppercase tracking-widest text-black shadow-xl shadow-white/5 transition-all hover:-translate-y-0.5 hover:bg-zinc-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {{ isSubmitting ? 'Enviando link...' : 'Enviar link seguro' }}
            </button>
          </form>

          <div class="mt-7 border-t border-white/10 pt-5 text-center">
            <RouterLink
              :to="{ name: AuthRouteNames.Login }"
              class="text-sm font-semibold text-zinc-400 transition-colors hover:text-indigo-300"
            >
              Voltar para login
            </RouterLink>
            <p class="mt-4 text-xs leading-5 text-gray-600">
              O link e valido apenas para redefinir uma senha administrativa.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.forgot-shell {
  position: relative;
  background:
    radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.12), transparent 32rem),
    radial-gradient(circle at 15% 85%, rgba(39, 39, 42, 0.8), transparent 28rem),
    #09090b;
}

.forgot-orbit {
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
  animation: forgot-orbit-spin 24s linear infinite;
}

.forgot-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at center, black, transparent 72%);
}

.forgot-card {
  position: relative;
  isolation: isolate;
}

.forgot-card::before {
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

.forgot-card-glow {
  position: absolute;
  inset: auto -30% -30% -30%;
  height: 16rem;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.18), transparent 66%);
  animation: forgot-glow-float 8s ease-in-out infinite alternate;
}

@keyframes forgot-orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes forgot-glow-float {
  from {
    transform: translate3d(-4%, 0, 0) scale(1);
  }

  to {
    transform: translate3d(4%, -8%, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .forgot-orbit,
  .forgot-card-glow {
    animation: none;
  }
}
</style>
