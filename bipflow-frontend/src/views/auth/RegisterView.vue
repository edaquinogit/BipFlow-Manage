<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
import { usePasswordStrength } from '@/composables/usePasswordStrength'
import AuthShell from '@/components/auth/AuthShell.vue'
import type { ApiError } from '@/types/auth'

const isSubmitting = ref(false)
const errorMessage = ref('')
// Separate from errorMessage: a reminder to finish the form, not a
// rejection -- gets the calmer amber treatment instead of the red banner.
const validationHint = ref('')
const successMessage = ref('')

const form = reactive({
  email: '',
  password: '',
  confirm_password: '',
  store_name: '',
})

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
  Boolean(form.email.trim())
  && Boolean(form.store_name.trim())
  && isPasswordValid.value
  && confirmRule.value.passed
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
  validationHint.value = ''
  errorMessage.value = ''

  if (!isFormReady.value) {
    validationHint.value = 'Preencha o nome da loja, email, senha e confirmação seguindo os critérios de segurança.'
    return
  }

  isSubmitting.value = true
  successMessage.value = ''

  try {
    const response = await authService.register({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      confirm_password: form.confirm_password,
      store_name: form.store_name.trim(),
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
    eyebrow="Novo acesso"
    title="Comece a vender em minutos."
    description="Crie sua loja e tenha controle total sobre produtos, pedidos e atendimento desde o primeiro dia."
  >
    <div class="mb-8">
      <h2 class="text-2xl font-semibold text-bip-black">Criar sua loja</h2>
      <p class="mt-1 text-sm text-bip-muted">
        Configure o nome da sua loja e uma credencial administrativa segura.
      </p>
    </div>

    <div
      v-if="successMessage"
      class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
    >
      <div class="flex gap-3">
        <CheckCircleIcon class="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p class="font-semibold">Conta criada</p>
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

    <form v-if="!successMessage" @submit.prevent="handleRegister" class="space-y-5">
      <div>
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-bip-muted">
          Nome da loja
        </label>
        <input
          v-model="form.store_name"
          type="text"
          autocomplete="organization"
          placeholder="Ex.: Pizzaria do Joao"
          class="h-11 w-full rounded-lg border border-bip-line bg-white px-4 text-bip-black shadow-sm transition-colors placeholder:text-zinc-400 focus:border-bip-rose focus:outline-none focus:ring-2 focus:ring-bip-blush"
          required
        />
      </div>

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
          autocomplete="new-password"
          placeholder="Crie uma senha segura"
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
          Confirmar senha
        </label>
        <input
          v-model="form.confirm_password"
          type="password"
          autocomplete="new-password"
          placeholder="Repita a senha"
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
        {{ isSubmitting ? 'Criando conta...' : 'Criar conta segura' }}
      </button>
    </form>

    <template #footer>
      <RouterLink
        :to="{ name: AuthRouteNames.Login }"
        class="text-sm font-semibold text-bip-muted transition-colors hover:text-bip-rose"
      >
        Ja tenho conta administrativa
      </RouterLink>
      <p class="mt-4 text-xs leading-5 text-bip-muted">
        Contas administrativas devem ser usadas apenas por pessoas autorizadas.
      </p>
    </template>
  </AuthShell>
</template>
