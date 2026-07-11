<script setup lang="ts">
import { onMounted, ref } from 'vue'

// Deliberately a plain fetch(), not the authenticated `api` axios client
// (src/services/api.ts): this page must render correctly for a logged-out
// visitor and for CI, without triggering the token-refresh/401 machinery
// that client carries. store-settings/public/ is an existing, already
// public, already-proxied (dev Vite proxy + prod nginx) endpoint that also
// touches the DB -- a more meaningful signal than a plain process-alive
// check would be.
const BACKEND_PROBE_URL = '/api/v1/store-settings/public/'

const renderedAt = ref('')
const backendStatus = ref<'checking' | 'ok' | 'down'>('checking')
const backendLatencyMs = ref<number | null>(null)

onMounted(async () => {
  renderedAt.value = new Date().toLocaleString('pt-BR')

  const startedAt = performance.now()
  try {
    const response = await fetch(BACKEND_PROBE_URL, { method: 'GET' })
    backendLatencyMs.value = Math.round(performance.now() - startedAt)
    backendStatus.value = response.ok ? 'ok' : 'down'
  } catch {
    backendLatencyMs.value = Math.round(performance.now() - startedAt)
    backendStatus.value = 'down'
  }
})
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white"
    data-testid="status-page"
  >
    <main class="w-full max-w-xl rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl shadow-black/30">
      <p class="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-300">Diagnostico do sistema</p>
      <h1 class="mt-4 text-3xl font-black tracking-tight">Frontend operacional</h1>
      <p class="mt-2 text-sm text-gray-400">Renderizado em {{ renderedAt }}</p>

      <div class="mt-8 space-y-3 text-left">
        <div class="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
          <span class="text-xs font-bold uppercase tracking-widest text-gray-400">Frontend</span>
          <span
            class="flex items-center gap-2 text-sm font-semibold text-emerald-400"
            data-testid="frontend-status"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-400" />
            OK
          </span>
        </div>

        <div class="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
          <span class="text-xs font-bold uppercase tracking-widest text-gray-400">Backend</span>
          <span
            class="flex items-center gap-2 text-sm font-semibold"
            :class="{
              'text-gray-400': backendStatus === 'checking',
              'text-emerald-400': backendStatus === 'ok',
              'text-rose-400': backendStatus === 'down'
            }"
            data-testid="backend-status"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="{
                'bg-gray-500': backendStatus === 'checking',
                'bg-emerald-400': backendStatus === 'ok',
                'bg-rose-400': backendStatus === 'down'
              }"
            />
            <template v-if="backendStatus === 'checking'">verificando...</template>
            <template v-else-if="backendStatus === 'ok'">OK ({{ backendLatencyMs }}ms)</template>
            <template v-else>indisponivel</template>
          </span>
        </div>
      </div>

      <p class="mt-8 text-xs text-gray-500">
        Rota dedicada a verificacao do pipeline de CI e a depuracao manual -- nao faz parte do fluxo de usuario.
      </p>
    </main>
  </div>
</template>
