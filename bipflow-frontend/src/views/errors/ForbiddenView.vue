<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { AuthRouteNames } from '@/router/auth.routes'
import { PublicRoutes } from '@/router/public.routes'
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
    <main class="w-full max-w-xl rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl shadow-black/30">
      <p class="text-xs font-semibold uppercase tracking-[0.26em] text-amber-300">Acesso restrito</p>
      <h1 class="mt-4 text-5xl font-black tracking-tight">403</h1>
      <p class="mt-4 text-sm leading-6 text-gray-400">
        Esta area exige uma conta administrativa ativa. Se voce esta validando a experiencia
        do cliente, o catalogo publico continua disponivel sem login.
      </p>

      <div class="mt-8 grid gap-3 sm:grid-cols-2">
        <RouterLink
          :to="{ name: AuthRouteNames.Login }"
          class="rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-700"
        >
          Fazer login
        </RouterLink>
        <RouterLink
          :to="{ name: PublicRoutes.Products }"
          class="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-cyan-200 transition-colors hover:bg-cyan-400/15"
        >
          Catalogo publico
        </RouterLink>
      </div>
    </main>
  </div>
</template>
