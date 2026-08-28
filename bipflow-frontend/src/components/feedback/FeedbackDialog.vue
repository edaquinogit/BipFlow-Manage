<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChatBubbleLeftEllipsisIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { FEEDBACK_TYPE_OPTIONS } from '@/constants/feedback'
import { useCustomerFeedback } from '@/composables/useCustomerFeedback'
import { useDialogA11y } from '@/composables/useDialogA11y'

/**
 * Global, mounted once in App.vue (same pattern as ToastHost) so every
 * trigger across the storefront -- the discreet footer link, or a
 * contextual "Relatar problema" next to a real error -- drives this one
 * instance through useCustomerFeedback(), no prop drilling and no
 * duplicated dialog per page.
 *
 * Deliberately not store-branded (no --store-* tokens): cross-cutting
 * chrome like this stays on the app's own neutral palette, matching
 * ToastHost.vue's own precedent, and keeps working correctly even when
 * teleported to <body>, outside the storefront shell that defines those
 * CSS custom properties.
 */
const { isOpen, submitState, errorMessage, form, close, submit } = useCustomerFeedback()

const containerRef = ref<HTMLElement | null>(null)
const messageFieldRef = ref<HTMLTextAreaElement | null>(null)

useDialogA11y(isOpen, close, containerRef, messageFieldRef)

const isSubmitting = computed(() => submitState.value === 'submitting')
const isSuccess = computed(() => submitState.value === 'success')

async function handleSubmit(): Promise<void> {
  await submit()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="feedback-dialog-fade">
      <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
        <div class="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" @click="close" />

        <div
          ref="containerRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
          data-cy="feedback-dialog"
          class="relative flex w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        >
          <div class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div class="min-w-0">
              <p id="feedback-dialog-title" class="text-base font-bold text-slate-900">
                Algo nao funcionou como esperado?
              </p>
              <p class="mt-1 text-sm leading-5 text-slate-500">
                Conte pra gente. Seu feedback ajuda a melhorar sua experiencia.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              aria-label="Fechar"
              @click="close"
            >
              <XMarkIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div
            v-if="isSuccess"
            data-cy="feedback-success"
            class="flex flex-col items-center gap-3 px-5 py-10 text-center"
          >
            <CheckCircleIcon class="h-10 w-10 text-emerald-600" aria-hidden="true" />
            <p role="status" class="text-sm font-semibold text-slate-900">
              Obrigado! Recebemos seu feedback.
            </p>
            <button
              type="button"
              class="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
              @click="close"
            >
              Fechar
            </button>
          </div>

          <form v-else class="flex flex-col gap-4 px-5 py-5" @submit.prevent="handleSubmit">
            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo do relato
              </span>
              <select
                v-model="form.type"
                data-cy="feedback-type-select"
                class="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option v-for="option in FEEDBACK_TYPE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mensagem
              </span>
              <textarea
                ref="messageFieldRef"
                v-model="form.message"
                rows="4"
                required
                maxlength="2000"
                data-cy="feedback-message-input"
                class="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Conte brevemente o que aconteceu..."
              />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contato (opcional)
              </span>
              <input
                v-model="form.contact"
                type="text"
                maxlength="160"
                class="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="WhatsApp ou e-mail"
              />
            </label>

            <p v-if="submitState === 'error'" role="alert" class="text-sm font-medium text-red-600">
              {{ errorMessage }}
            </p>

            <div class="mt-1 flex items-center justify-end gap-3">
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                @click="close"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="isSubmitting"
                data-cy="feedback-submit-button"
                class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <ChatBubbleLeftEllipsisIcon class="h-4 w-4" aria-hidden="true" />
                {{ isSubmitting ? 'Enviando...' : 'Enviar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.feedback-dialog-fade-enter-active,
.feedback-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.feedback-dialog-fade-enter-from,
.feedback-dialog-fade-leave-to {
  opacity: 0;
}
</style>
