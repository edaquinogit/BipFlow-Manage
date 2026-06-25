<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
      remove: (widgetId: string) => void
    }
  }
}

const props = defineProps<{ siteKey: string }>()
const emit = defineEmits<{ verified: [token: string]; expired: [] }>()

const container = ref<HTMLElement | null>(null)
let widgetId: string | null = null

function loadScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve()
  }

  const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile]')
  if (existing) {
    return new Promise((resolve) => existing.addEventListener('load', () => resolve()))
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.dataset.turnstile = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar o desafio de seguranca.'))
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  try {
    await loadScript()
  } catch {
    return
  }

  if (!window.turnstile || !container.value) {
    return
  }

  widgetId = window.turnstile.render(container.value, {
    sitekey: props.siteKey,
    callback: (token: string) => emit('verified', token),
    'expired-callback': () => emit('expired'),
  })
})

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
})
</script>

<template>
  <div ref="container" data-cy="turnstile-widget" />
</template>
