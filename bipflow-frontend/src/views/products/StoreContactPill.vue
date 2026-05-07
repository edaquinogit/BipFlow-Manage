<template>
  <button
    v-if="isConfigured"
    type="button"
    class="inline-flex max-w-full items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-left shadow-sm transition hover:border-rose-200 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
    :aria-label="`Abrir duvidas frequentes da loja no WhatsApp ${formattedPhone}`"
    @click="$emit('openContactOptions')"
  >
    <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-700 shadow-sm">
      <PhoneIcon class="h-5 w-5" aria-hidden="true" />
    </span>

    <span class="min-w-0">
      <span class="block text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
        WhatsApp da loja
      </span>
      <span class="mt-0.5 block whitespace-nowrap text-sm font-semibold text-slate-900">
        {{ formattedPhone }}
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PhoneIcon } from '@heroicons/vue/24/outline'
import { formatWhatsAppPhone } from '@/utils/formatters'

const props = defineProps<{
  phoneDigits: string
}>()

defineEmits<{
  openContactOptions: []
}>()

const normalizedDigits = computed(() => props.phoneDigits.replace(/\D/g, ''))
const isConfigured = computed(() => normalizedDigits.value.length > 0)
const formattedPhone = computed(() => formatWhatsAppPhone(normalizedDigits.value))
</script>
