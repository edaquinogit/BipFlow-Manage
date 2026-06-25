<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { EnvelopeIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { authService } from '@/services/auth.service'
import { AuthRouteNames } from '@/router/auth.routes'
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
})

const extractErrorMessage = (error: unknown) => {
  const err = error as ApiError
  return err.response?.data?.detail || err.response?.data?.message || 'Nao foi possivel enviar o link agora.'
}

const handlePasswordResetRequest = async () => {
  validationHint.value = ''
  errorMessage.value = ''

  if (!form.email.trim()) {
    validationHint.value = 'Informe o email cadastrado para continuar.'
    return
  }

  isSubmitting.value = true
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
  <AuthShell
    eyebrow="Recuperação segura"
    title="Vamos recuperar seu acesso."
    description="Enviamos um link seguro e com expiração para o email administrativo cadastrado na sua loja."
  >
    <div class="mb-8">
      <h2 class="text-2xl font-semibold text-bip-black">Redefinir senha</h2>
      <p class="mt-1 text-sm text-bip-muted">
        Informe o email administrativo para receber o link de recuperação.
      </p>
    </div>

    <div
      v-if="successMessage"
      class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
    >
      <div class="flex gap-3">
        <EnvelopeIcon class="h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p class="font-semibold">Email enviado</p>
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

    <form v-if="!successMessage" @submit.prevent="handlePasswordResetRequest" class="space-y-5">
      <div>
        <label class="mb-2 block text-xs font-semibold uppercase tracking-wider text-bip-muted">
          Email cadastrado
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

      <button
        type="submit"
        :disabled="isSubmitting"
        class="flex h-11 w-full items-center justify-center rounded-lg bg-bip-rose text-sm font-bold uppercase tracking-widest text-white shadow-sm transition-all hover:bg-[#b8154f] disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {{ isSubmitting ? 'Enviando link...' : 'Enviar link seguro' }}
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
        O link é válido apenas para redefinir uma senha administrativa.
      </p>
    </template>
  </AuthShell>
</template>
