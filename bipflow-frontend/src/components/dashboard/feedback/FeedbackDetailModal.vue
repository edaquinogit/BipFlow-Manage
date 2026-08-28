<script setup lang="ts">
import { ref, toRef } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { FEEDBACK_STATUS_OPTIONS, getFeedbackTypeLabel } from '@/constants/feedback'
import { useDialogA11y } from '@/composables/useDialogA11y'
import { formatDateTimeBR } from '@/utils/formatters'
import type { FeedbackReport, FeedbackStatus } from '@/types/feedback'

const props = defineProps<{
  show: boolean
  feedback: FeedbackReport | null
  canManage: boolean
  isUpdating: boolean
  updateError: string | null
}>()

const emit = defineEmits<{
  close: []
  updateStatus: [FeedbackStatus]
}>()

const containerRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

useDialogA11y(toRef(props, 'show'), () => emit('close'), containerRef, closeButtonRef)

function handleStatusChange(event: Event): void {
  emit('updateStatus', (event.target as HTMLSelectElement).value as FeedbackStatus)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show && feedback" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/55" @click="emit('close')" />

        <div
          ref="containerRef"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes do relato"
          class="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-2xl"
        >
          <button
            ref="closeButtonRef"
            type="button"
            class="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-bip-muted transition hover:bg-zinc-100 hover:text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#F3F4F6]"
            aria-label="Fechar"
            @click="emit('close')"
          >
            <XMarkIcon class="h-5 w-5" aria-hidden="true" />
          </button>

          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-bip-muted">
            {{ getFeedbackTypeLabel(feedback.feedback_type) }}
          </p>
          <h2 class="mt-1 text-lg font-black italic tracking-tighter text-[#05050A]">
            Relato #{{ feedback.id }}
          </h2>
          <p class="mt-1 text-xs text-bip-muted">{{ formatDateTimeBR(feedback.created_at) }}</p>

          <div class="mt-5 rounded-lg border border-[#E5E7EB] bg-zinc-50 p-4">
            <p class="whitespace-pre-line text-sm leading-6 text-[#05050A]">{{ feedback.message }}</p>
          </div>

          <dl class="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div v-if="feedback.contact">
              <dt class="text-xs text-bip-muted">Contato</dt>
              <dd class="mt-0.5 font-semibold text-[#05050A]">{{ feedback.contact }}</dd>
            </div>
            <div v-if="feedback.page_path">
              <dt class="text-xs text-bip-muted">Pagina</dt>
              <dd class="mt-0.5 truncate font-semibold text-[#05050A]">{{ feedback.page_path }}</dd>
            </div>
            <div v-if="feedback.product_name">
              <dt class="text-xs text-bip-muted">Produto</dt>
              <dd class="mt-0.5 font-semibold text-[#05050A]">{{ feedback.product_name }}</dd>
            </div>
            <div v-if="feedback.order_reference">
              <dt class="text-xs text-bip-muted">Pedido</dt>
              <dd class="mt-0.5 font-semibold text-[#05050A]">{{ feedback.order_reference }}</dd>
            </div>
            <div v-if="feedback.customer_name">
              <dt class="text-xs text-bip-muted">Cliente</dt>
              <dd class="mt-0.5 font-semibold text-[#05050A]">
                {{ feedback.customer_name }} {{ feedback.customer_phone ? `- ${feedback.customer_phone}` : '' }}
              </dd>
            </div>
            <div v-if="feedback.correlation_id">
              <dt class="text-xs text-bip-muted">Correlation ID</dt>
              <dd class="mt-0.5 truncate font-mono text-xs text-[#05050A]">{{ feedback.correlation_id }}</dd>
            </div>
          </dl>

          <div class="mt-6 border-t border-[#E5E7EB] pt-5">
            <label class="block">
              <span class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-bip-muted">
                Status
              </span>
              <select
                :value="feedback.status"
                :disabled="!canManage || isUpdating"
                class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-60"
                @change="handleStatusChange"
              >
                <option v-for="option in FEEDBACK_STATUS_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <p v-if="updateError" role="alert" class="mt-2 text-xs font-medium text-red-600">
              {{ updateError }}
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
