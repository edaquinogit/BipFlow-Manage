<template>
  <div class="flex items-center gap-3 min-w-0">
    <div class="flex h-10 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-bip-line bg-white">
      <img
        v-if="branding.logoUrl"
        :src="branding.logoUrl"
        :alt="branding.name"
        class="h-full w-full object-contain"
      />
      <div v-else class="flex h-full w-full items-center justify-center bg-zinc-100 text-[10px] uppercase tracking-[0.24em] text-bip-muted">
        Logo
      </div>
    </div>

    <div class="min-w-0">
      <p class="brand-wordmark brand-wordmark-premium max-w-[16rem] truncate text-base leading-tight">
        {{ branding.name }}
      </p>
      <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-bip-rose">
        {{ branding.tagline }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface HeaderBranding {
  logoUrl?: string | null
  name: string
  tagline: string
}

defineProps<{ branding: HeaderBranding }>();
</script>
