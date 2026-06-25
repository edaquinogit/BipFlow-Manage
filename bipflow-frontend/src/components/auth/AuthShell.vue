<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description: string
}>()

const year = new Date().getFullYear()
</script>

<template>
  <main class="grid min-h-screen lg:grid-cols-2">
    <section
      class="auth-brand-panel relative hidden flex-col justify-between overflow-hidden bg-bip-black px-12 py-12 lg:flex"
    >
      <div class="auth-brand-glow" aria-hidden="true"></div>
      <div class="auth-brand-grid" aria-hidden="true"></div>

      <div class="relative z-10 flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
          <span class="text-sm font-black text-bip-rose">BF</span>
        </div>
        <span class="brand-wordmark brand-wordmark-premium-dark text-xl">BipFlow Manage</span>
      </div>

      <div class="relative z-10 max-w-md">
        <p class="text-[11px] font-bold uppercase tracking-[0.3em] text-bip-rose">{{ eyebrow }}</p>
        <h1 class="hero-display-title mt-4 text-4xl text-white sm:text-5xl">{{ title }}</h1>
        <p class="premium-copy mt-4 text-base leading-7 text-zinc-400">{{ description }}</p>

        <ul v-if="$slots.highlights" class="mt-10 space-y-4">
          <slot name="highlights" />
        </ul>
      </div>

      <p class="relative z-10 text-xs text-zinc-500">&copy; {{ year }} BipFlow. Painel administrativo seguro.</p>
    </section>

    <section class="flex items-center justify-center bg-bip-soft px-4 py-10 sm:px-6 lg:py-16">
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-bip-line bg-white shadow-sm">
            <span class="text-sm font-black text-bip-rose">BF</span>
          </div>
          <span class="brand-wordmark brand-wordmark-premium text-lg">BipFlow Manage</span>
        </div>

        <slot />

        <div v-if="$slots.footer" class="mt-7 border-t border-bip-line pt-5 text-center">
          <slot name="footer" />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-brand-panel {
  background:
    radial-gradient(circle at 50% 0%, rgba(216, 27, 96, 0.16), transparent 32rem),
    radial-gradient(circle at 15% 85%, rgba(39, 39, 42, 0.8), transparent 28rem),
    #05050a;
}

.auth-brand-glow {
  position: absolute;
  inset: auto -30% -30% -30%;
  height: 18rem;
  background: radial-gradient(circle, rgba(216, 27, 96, 0.2), transparent 66%);
  animation: auth-glow-float 8s ease-in-out infinite alternate;
}

.auth-brand-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at 30% 30%, black, transparent 72%);
}

@keyframes auth-glow-float {
  from {
    transform: translate3d(-4%, 0, 0) scale(1);
  }

  to {
    transform: translate3d(4%, -8%, 0) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-brand-glow {
    animation: none;
  }
}
</style>
