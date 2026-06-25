<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import { usePasswordStrength } from '@/composables/usePasswordStrength'
import AuthShell from '@/components/auth/AuthShell.vue'
import type { ApiError } from '@/types/auth'

const route = useRoute()
const isSubmitting = ref(false)
const errorMessage = ref('')
// Separate from errorMessage: a reminder to finish the form, not a
// rejection -- gets the calmer amber treatment instead of the red banner.
const validationHint = ref('')
const successMessage = ref('')

const form = reactive({
  password: '',
  confirm_password: '',
})

const uid = computed(() => String(route.query.uid || route.params.token || ''))
const token = computed(() => String(route.query.token || ''))
const hasValidLink = computed(() => Boolean(uid.value && token.value))

const {
  rules: passwordRules,
  label: strengthLabel,
  barClass: strengthBarClass,
  filledBars: strengthFilledBars,
  totalBars: strengthTotalBars,
  isValid: isPasswordValid,
} = usePasswordStrength(computed(() => form.password))

const confirmRule = computed(() => ({
  label: 'Confirmação igual à senha',
  passed: Boolean(form.confirm_password) && form.password === form.confirm_password,
}))

const allPasswordRules = computed(() => [...passwordRules.value, confirmRule.value])

const isFormReady = computed(() =>
  hasValidLink.value && isPasswordValid.value && confirmRule.value.passed
)

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  const data = err.response?.data

  if (!data) return 'Nao foi possivel redefinir a senha agora.'
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

const handlePasswordResetConfirm = async () => {
  validationHint.value = ''
  errorMessage.value = ''

  if (!isFormReady.value) {
    validationHint.value = hasValidLink.value
      ? 'Preencha a nova senha seguindo os critérios de segurança.'
      : 'Link de recuperação incompleto. Solicite um novo email.'
    return
  }

  isSubmitting.value = true
  successMessage.value = ''

  try {
    const response = await authService.confirmPasswordReset({
      uid: uid.value,
      token: token.value,
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
  <AuthShell
    eyebrow="Nova senha"
    title="Defina uma senha forte e exclusiva."
    description="Uma senha exclusiva para o BipFlow Manage protege o acesso administrativo da sua loja."
  >
    <div class="mb-8">
      <h2 class="text-2xl font-semibold text-bip-black">Criar nova senha</h2>
      <p class="mt-1 text-sm text-bip-muted">
        Defina uma senha forte para recuperar o acesso administrativo.
      </p>
    </div>

    <div
      v-if="successMessage"
      class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
    >
      <div class="flex gap-3">
        <CheckCircleIcon class="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p class="font-semibold">Senha redefinida</p>
          <p class="mt-1 leading-6 text-emerald-700">{{ successMessage }}</p>
        </div>
      </div>

      <RouterLink
        :to="{ name: AuthRouteNames.Login }"
        class="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-bip-rose text-sm font-bold uppercase tracking-widest text-white shadow-sm transition-all hover:bg-[#b8154f]"
      >
        Ir para o login
      </RouterLink>
    </div>

    <div
      v-if="validationHint"
      class="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
    >
      <ExclamationTriangleIcon class="h-5 w-5 shrink-0 text-amber-600" />
      <span>{{ validationHint }}</span>
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-xl border border-[#FCE7F3] bg-[#FCE7F3] p-3 text-sm text-[#7A143D]"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="!hasValidLink"
      class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"
    >
      Este link não possui os parâmetros de segurança necessários. Solicite um novo email de recuperação.
    </div>

    <form v-if="!successMessage" @submit.prevent="handlePasswordResetConfirm" class="space-y-5">
      <div>
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-bip-muted">
          Nova senha
        </label>
        <input
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          placeholder="Digite a nova senha"
          class="h-11 w-full rounded-lg border border-bip-line bg-white px-4 text-bip-black shadow-sm transition-colors placeholder:text-zinc-400 focus:border-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
          required
        />

        <div v-if="form.password" class="mt-2 space-y-1">
          <div class="flex gap-1">
            <span
              v-for="index in strengthTotalBars"
              :key="index"
              class="h-1.5 flex-1 rounded-full transition-colors"
              :class="index <= strengthFilledBars ? strengthBarClass : 'bg-zinc-200'"
            />
          </div>
          <p class="text-xs font-semibold text-bip-muted">Força: {{ strengthLabel }}</p>
        </div>
      </div>

      <div>
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-bip-muted">
          Confirmar nova senha
        </label>
        <input
          v-model="form.confirm_password"
          type="password"
          autocomplete="new-password"
          placeholder="Repita a nova senha"
          class="h-11 w-full rounded-lg border border-bip-line bg-white px-4 text-bip-black shadow-sm transition-colors placeholder:text-zinc-400 focus:border-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
          required
        />
      </div>

      <ul class="grid gap-2 border-t border-bip-line pt-4">
        <li
          v-for="rule in allPasswordRules"
          :key="rule.label"
          class="flex items-center gap-2 text-xs"
          :class="rule.passed ? 'text-emerald-700' : 'text-bip-muted'"
        >
          <span
            class="h-2 w-2 rounded-full"
            :class="rule.passed ? 'bg-emerald-500' : 'bg-zinc-300'"
          ></span>
          {{ rule.label }}
        </li>
      </ul>

      <button
        type="submit"
        :disabled="isSubmitting || !isFormReady"
        class="flex h-11 w-full items-center justify-center rounded-lg bg-bip-rose text-sm font-bold uppercase tracking-widest text-white shadow-sm transition-all hover:bg-[#b8154f] disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {{ isSubmitting ? 'Redefinindo senha...' : 'Redefinir senha' }}
      </button>
    </form>

    <template #footer>
      <RouterLink
        :to="{ name: AuthRouteNames.Login }"
        class="text-sm font-semibold text-bip-muted transition-colors hover:text-bip-rose"
      >
        Voltar para login
      </RouterLink>
      <p class="mt-4 text-xs leading-5 text-bip-muted">
        Use uma senha exclusiva para proteger o painel administrativo.
      </p>
    </template>
  </AuthShell>
</template>
