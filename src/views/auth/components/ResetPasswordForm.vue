<template>
  <form @submit.prevent="onSubmit" novalidate>
    <label for="password">Nova senha</label>
    <input id="password" v-model="form.password" type="password" />

    <label for="confirm">Confirmar senha</label>
    <input id="confirm" v-model="form.confirmPassword" type="password" />

    <p v-if="errors.password" class="error">{{ errors.password }}</p>
    <p v-if="errors.confirmPassword" class="error">{{ errors.confirmPassword }}</p>

    <button :disabled="isSubmitting" type="submit">Redefinir senha</button>

    <p v-if="successMessage" class="success">{{ successMessage }}</p>
    <p v-if="serverError" class="error">{{ serverError }}</p>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter } from 'vue-router'
import { confirmReset } from '../services/auth.reset.service'
import type { ConfirmResetPayload } from '@/types/auth'

const propsToken = ''
const route = useRoute()
const router = useRouter()
const token = computed(() => propsToken || (route.query.token as string) || (route.params.token as string) || '')

const schema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string()
}).refine(d => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Senhas não coincidem' })

type FormData = z.infer<typeof schema>
const form = reactive<FormData>({ password: '', confirmPassword: '' })
const errors = reactive<{ password?: string; confirmPassword?: string }>({})
const isSubmitting = ref(false)
const successMessage = ref<string | null>(null)
const serverError = ref<string | null>(null)

const onSubmit = async (): Promise<void> => {
  errors.password = undefined
  errors.confirmPassword = undefined
  serverError.value = null
  successMessage.value = null

  const result = schema.safeParse(form)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.password = fieldErrors.password?.[0]
    errors.confirmPassword = fieldErrors.confirmPassword?.[0]
    return
  }

  const resolvedToken = token.value?.trim() ?? ''
  if (!resolvedToken) {
    serverError.value = 'Token ausente.'
    return
  }

  isSubmitting.value = true
  try {
    const payload: ConfirmResetPayload = { token: resolvedToken, password: form.password }
    await confirmReset(payload)
    successMessage.value = 'Senha redefinida com sucesso. Redirecionando...'
    setTimeout(() => router.push({ name: 'login' }), 1200)
  } catch (err: any) {
    serverError.value = err?.response?.data?.message ?? 'Erro ao redefinir senha.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.error { color: #b00020; }
.success { color: #0a7a0a; }
</style>