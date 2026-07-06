<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { BoltIcon, Square3Stack3DIcon, ChatBubbleLeftRightIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import { DashboardRoutes } from '@/router/dashboard.routes'
import { isAxiosError } from '@/types/errors'
import AuthShell from '@/components/auth/AuthShell.vue'
import TurnstileWidget from '@/components/auth/TurnstileWidget.vue'
import Button from '@/components/ui/Button.vue'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

const router = useRouter()
const route = useRoute()
const isLoading = ref(false)
const errorMessage = ref('')
// Separate from errorMessage on purpose: this is a reminder to finish
// filling the form or completing a required step (captcha), not a
// rejection -- it gets a calmer amber treatment instead of the red "your
// credentials/code were wrong" banner.
const validationHint = ref('')
const requiresCaptcha = ref(false)
const captchaToken = ref('')
const rememberMe = ref(false)

const mfaToken = ref('')
const mfaCode = ref('')
const useBackupCode = ref(false)
const isVerifyingMfa = ref(false)

const form = reactive({
  email: '',
  password: '',
})

const canSubmit = computed(() => !isLoading.value && (!requiresCaptcha.value || Boolean(captchaToken.value)))
const canSubmitMfa = computed(() => !isVerifyingMfa.value && mfaCode.value.trim().length > 0)

const handleCaptchaVerified = (token: string) => {
  captchaToken.value = token
}

const handleCaptchaExpired = () => {
  captchaToken.value = ''
}

const highlights = [
  { icon: BoltIcon, label: 'Pedidos em tempo real, sem recarregar a tela' },
  { icon: Square3Stack3DIcon, label: 'Catálogo e categorias sempre atualizados' },
  { icon: ChatBubbleLeftRightIcon, label: 'Atendimento centralizado em um só painel' },
]

const formatWait = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  return `${Math.ceil(seconds / 60)} min`
}

const handleLogin = async () => {
  validationHint.value = ''
  errorMessage.value = ''

  if (!form.email || !form.password) {
    validationHint.value = 'Preencha email e senha para continuar.'
    return
  }

  if (requiresCaptcha.value && !captchaToken.value) {
    validationHint.value = 'Confirme que você não é um robô para continuar.'
    return
  }

  isLoading.value = true

  try {
    const result = await authService.login({
      ...form,
      remember_me: rememberMe.value,
      captcha_token: captchaToken.value || undefined,
    })

    if ('mfa_required' in result) {
      mfaToken.value = result.mfa_token
      return
    }

    goToPostLoginDestination()
  } catch (error) {
    if (isAxiosError(error)) {
      const status = error.response?.status

      if (error.response?.data?.details?.requires_captcha) {
        requiresCaptcha.value = true
        captchaToken.value = ''
        validationHint.value = 'Confirme que você não é um robô para continuar.'
      } else if (status === 429) {
        const retryAfterHeader = error.response?.headers?.['retry-after']
        const waitSeconds = Number(retryAfterHeader)
        errorMessage.value = Number.isFinite(waitSeconds) && waitSeconds > 0
          ? `Muitas tentativas. Tente novamente em ${formatWait(waitSeconds)}.`
          : 'Muitas tentativas. Aguarde um momento e tente novamente.'
      } else if (status === 401) {
        errorMessage.value = 'Email ou senha inválidos.'
        captchaToken.value = ''
      } else if (status) {
        errorMessage.value = error.response?.data?.detail || 'Não foi possível entrar agora. Tente novamente.'
      } else {
        errorMessage.value = 'Falha de conexão. Verifique sua internet e tente novamente.'
      }
    } else {
      errorMessage.value = 'Não foi possível entrar agora. Tente novamente.'
    }
  } finally {
    isLoading.value = false
  }
}

const handleVerifyMfa = async () => {
  if (!canSubmitMfa.value) return

  isVerifyingMfa.value = true
  errorMessage.value = ''
  validationHint.value = ''

  try {
    await authService.verifyMfa({
      mfa_token: mfaToken.value,
      ...(useBackupCode.value ? { backup_code: mfaCode.value.trim() } : { code: mfaCode.value.trim() }),
    })
    goToPostLoginDestination()
  } catch (error) {
    errorMessage.value = isAxiosError(error) && error.response?.status === 429
      ? 'Muitas tentativas. Aguarde um momento e tente novamente.'
      : useBackupCode.value
        ? 'Codigo de backup invalido ou ja utilizado.'
        : 'Codigo invalido. Confira o app autenticador e tente novamente.'
  } finally {
    isVerifyingMfa.value = false
  }
}

/**
 * Where to send the user after a successful login/MFA verification.
 *
 * Etapa 2 of docs/architecture/customer-profile-checkout-evolution.md:
 * this view is reused verbatim at the storefront login routes
 * (/l/:storeSlug/login), so a storefront customer logging in there must
 * NOT land in the dashboard they have no membership for. The router
 * guard's requiresAuth redirect already sets `?redirect=`, and the
 * storefront's "Entrar" link does the same -- honor it when present,
 * otherwise fall back to the dashboard (the only case before this fix).
 */
const postLoginRedirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect ? redirect : null
})

const goToPostLoginDestination = () => {
  const redirect = postLoginRedirectTarget.value
  if (redirect) {
    router.push(redirect)
    return
  }

  router.push({ name: DashboardRoutes.Overview })
}

const handleBackToLogin = () => {
  mfaToken.value = ''
  mfaCode.value = ''
  useBackupCode.value = false
  errorMessage.value = ''
  validationHint.value = ''
}
</script>

<template>
  <AuthShell
    eyebrow="Painel administrativo"
    title="Sua operação, sob controle total."
    description="Gerencie produtos, pedidos e atendimento em um painel pensado para o dia a dia do seu delivery."
  >
    <template #highlights>
      <li v-for="item in highlights" :key="item.label" class="flex items-center gap-3 text-sm text-zinc-300">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <component :is="item.icon" class="h-4 w-4 text-bip-rose" />
        </span>
        {{ item.label }}
      </li>
    </template>

    <div class="mb-8">
      <h2 class="text-2xl font-semibold text-bip-black">{{ mfaToken ? 'Verificacao em duas etapas' : 'Entrar' }}</h2>
      <p class="mt-1 text-sm text-bip-muted">
        {{ mfaToken
          ? (useBackupCode ? 'Digite um dos seus codigos de backup.' : 'Digite o codigo do seu app autenticador.')
          : 'Acesse sua conta para gerenciar sua loja.' }}
      </p>
    </div>

    <div
      v-if="validationHint"
      data-cy="login-hint"
      class="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
    >
      <ExclamationTriangleIcon class="h-5 w-5 shrink-0 text-amber-600" />
      <span>{{ validationHint }}</span>
    </div>

    <div
      v-if="errorMessage"
      data-cy="login-error"
      class="mb-6 rounded-xl border border-[#FCE7F3] bg-[#FCE7F3] p-3 text-sm text-[#7A143D]"
    >
      {{ errorMessage }}
    </div>

    <form v-if="!mfaToken" @submit.prevent="handleLogin" class="space-y-5">
      <div>
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-bip-muted">
          Email
        </label>
        <input
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="admin@suaempresa.com"
          class="h-11 w-full rounded-lg border border-bip-line bg-white px-4 text-bip-black shadow-sm transition-colors placeholder:text-zinc-400 focus:border-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
          required
        />
      </div>

      <div>
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-bip-muted">
          Senha
        </label>
        <input
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          placeholder="........"
          class="h-11 w-full rounded-lg border border-bip-line bg-white px-4 text-bip-black shadow-sm transition-colors placeholder:text-zinc-400 focus:border-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
          required
        />
      </div>

      <label class="flex items-center gap-2 text-sm text-bip-muted">
        <input
          v-model="rememberMe"
          type="checkbox"
          class="h-4 w-4 rounded border-bip-line text-bip-rose focus:ring-2 focus:ring-bip-blush"
        />
        Lembrar de mim neste dispositivo
      </label>

      <TurnstileWidget
        v-if="requiresCaptcha && TURNSTILE_SITE_KEY"
        :site-key="TURNSTILE_SITE_KEY"
        @verified="handleCaptchaVerified"
        @expired="handleCaptchaExpired"
      />

      <Button type="submit" :disabled="!canSubmit" :loading="isLoading">
        {{ isLoading ? 'Entrando...' : 'Entrar' }}
      </Button>
    </form>

    <form v-else @submit.prevent="handleVerifyMfa" class="space-y-5" data-cy="mfa-verify-form">
      <div>
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-bip-muted">
          {{ useBackupCode ? 'Codigo de backup' : 'Codigo de 6 digitos' }}
        </label>
        <input
          v-model="mfaCode"
          type="text"
          inputmode="text"
          autocomplete="one-time-code"
          :placeholder="useBackupCode ? 'AB3K-9XQ2' : '123456'"
          class="h-11 w-full rounded-lg border border-bip-line bg-white px-4 text-center text-lg tracking-[0.3em] text-bip-black shadow-sm transition-colors placeholder:tracking-normal placeholder:text-zinc-400 focus:border-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
          required
          autofocus
        />
      </div>

      <Button type="submit" :disabled="!canSubmitMfa" :loading="isVerifyingMfa">
        {{ isVerifyingMfa ? 'Verificando...' : 'Verificar' }}
      </Button>

      <div class="flex items-center justify-between text-xs">
        <button
          type="button"
          class="font-semibold text-bip-muted transition-colors hover:text-bip-rose"
          @click="useBackupCode = !useBackupCode; mfaCode = ''"
        >
          {{ useBackupCode ? 'Usar codigo do app autenticador' : 'Usar codigo de backup' }}
        </button>
        <button
          type="button"
          class="font-semibold text-bip-muted transition-colors hover:text-bip-rose"
          @click="handleBackToLogin"
        >
          Voltar
        </button>
      </div>
    </form>

    <div class="mt-5 flex flex-col gap-3 sm:flex-row">
      <RouterLink
        :to="{ name: AuthRouteNames.ForgotPassword }"
        class="inline-flex flex-1 items-center justify-center rounded-lg border border-bip-line bg-white px-4 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-bip-muted transition-colors hover:border-bip-rose hover:text-bip-rose"
      >
        Recuperar senha
      </RouterLink>

      <RouterLink
        :to="{ name: AuthRouteNames.Register }"
        class="inline-flex flex-1 items-center justify-center rounded-lg border border-bip-line bg-white px-4 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-bip-muted transition-colors hover:border-bip-rose hover:text-bip-rose"
      >
        Criar conta
      </RouterLink>
    </div>

    <template #footer>
      <p class="text-xs leading-5 text-bip-muted">
        Acesso administrativo protegido por credenciais. Use uma conta autorizada.
      </p>
    </template>
  </AuthShell>
</template>
