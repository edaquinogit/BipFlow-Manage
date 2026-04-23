<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { PublicRoutes } from '@/router/public.routes'
</script>

<template>
  <section class="min-h-screen bg-zinc-950 p-6 text-white">
    <div class="mx-auto max-w-5xl">
      <div class="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Configuracoes</p>
        <h1 class="mt-3 text-3xl font-black tracking-tight">Central de operacao</h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Esta area concentra ajustes administrativos do BipFlow. Enquanto novos controles sao
          evoluidos, os atalhos essenciais permanecem visiveis para reduzir friccao operacional.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
          <h2 class="text-lg font-bold">Catalogo publico</h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Use este atalho para validar rapidamente a vitrine que o cliente acessa sem login.
          </p>
          <RouterLink
            :to="{ name: PublicRoutes.Products }"
            class="mt-5 inline-flex rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-cyan-200 transition-colors hover:bg-cyan-400/15"
          >
            Abrir catalogo
          </RouterLink>
        </div>

        <div class="rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
          <h2 class="text-lg font-bold">Seguranca de acesso</h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Novas contas administrativas devem confirmar o email antes de conseguir autenticar
            e acessar rotas protegidas.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
