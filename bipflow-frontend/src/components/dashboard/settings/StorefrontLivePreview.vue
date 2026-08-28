<script setup lang="ts">
import type { AppearanceDraft, BannerEditor, PreviewMode } from './storefrontAppearanceEditor';

defineProps<{
  mode: PreviewMode;
  draft: AppearanceDraft;
  previewStyle: Record<string, string>;
  previewFrameClass: string;
  storeName: string;
  logoUrl: string;
  faviconUrl: string;
  heroImageUrl: string;
  heroPreviewUrl: string;
  banners: BannerEditor[];
  isOptionsLoading: boolean;
}>();

const emit = defineEmits<{
  'update:mode': [mode: PreviewMode];
}>();

function setMode(mode: PreviewMode): void {
  emit('update:mode', mode);
}
</script>

<template>
  <aside data-cy="storefront-live-preview" class="xl:sticky xl:top-24 xl:self-start">
    <div class="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-[0_20px_60px_-42px_rgba(5,5,10,0.45)]">
      <div class="flex flex-col gap-3 border-b border-[#E5E7EB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Preview ao vivo</h3>
          <p class="mt-1 text-[11px] text-bip-muted">Simula a vitrine antes de salvar.</p>
        </div>
        <div class="inline-flex rounded-lg border border-[#E5E7EB] bg-zinc-100 p-1" role="group" aria-label="Modo de preview">
          <button
            type="button"
            data-cy="storefront-preview-desktop"
            class="h-9 rounded-md px-3 text-[10px] font-black uppercase tracking-widest transition"
            :class="mode === 'desktop' ? 'bg-white text-[#05050A] shadow-sm' : 'text-bip-muted'"
            @click="setMode('desktop')"
          >
            Desktop
          </button>
          <button
            type="button"
            data-cy="storefront-preview-mobile"
            class="h-9 rounded-md px-3 text-[10px] font-black uppercase tracking-widest transition"
            :class="mode === 'mobile' ? 'bg-white text-[#05050A] shadow-sm' : 'text-bip-muted'"
            @click="setMode('mobile')"
          >
            Mobile
          </button>
        </div>
      </div>

      <div class="p-3">
        <div class="transition-all duration-300" :class="previewFrameClass">
          <div
            class="overflow-hidden border border-[#E5E7EB] bg-white"
            :class="mode === 'mobile' ? 'rounded-[1.5rem] border-[6px] border-[#111827] shadow-card' : 'rounded-lg'"
            :style="previewStyle"
          >
            <div class="bg-[var(--preview-background)] p-4 text-[var(--preview-text)]">
              <div class="flex items-center gap-3">
                <div class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[var(--preview-radius)] bg-[var(--preview-surface)]">
                  <img v-if="logoUrl" :src="logoUrl" alt="" class="h-full w-full object-contain" />
                  <span v-else class="text-xs font-black">BF</span>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-sm font-black" style="font-family: var(--preview-font-heading)">{{ storeName }}</p>
                  <p class="truncate text-xs text-[var(--preview-muted)]">{{ draft.tagline || 'Catalogo online' }}</p>
                </div>
                <div v-if="faviconUrl" class="ml-auto flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-black/10 bg-white">
                  <img :src="faviconUrl" alt="" class="h-full w-full object-contain" />
                </div>
              </div>

              <div v-if="draft.hero_enabled && heroImageUrl" class="mt-4 overflow-hidden rounded-[var(--preview-radius)] border border-black/10 bg-[var(--preview-surface)]">
                <img :src="heroImageUrl" :alt="draft.hero_alt_text" class="aspect-[16/7] w-full object-cover" />
                <div v-if="draft.hero_title || draft.hero_subtitle || (draft.hero_cta_text && heroPreviewUrl)" class="space-y-2 p-3">
                  <p v-if="draft.hero_title" class="text-sm font-black leading-tight" style="font-family: var(--preview-font-heading)">{{ draft.hero_title }}</p>
                  <p v-if="draft.hero_subtitle" class="text-xs leading-5 text-[var(--preview-muted)]">{{ draft.hero_subtitle }}</p>
                  <span v-if="draft.hero_cta_text && heroPreviewUrl" class="inline-flex h-9 items-center rounded-[var(--preview-radius)] bg-[var(--preview-accent)] px-3 text-[10px] font-black uppercase tracking-widest text-white">
                    {{ draft.hero_cta_text }}
                  </span>
                </div>
              </div>

              <div v-if="banners.length" class="mt-4 grid gap-2">
                <div v-for="banner in banners" :key="banner.clientId" class="overflow-hidden rounded-[var(--preview-radius)] border border-black/10 bg-[var(--preview-surface)]">
                  <img :src="banner.pendingPreviewUrl || banner.image_url" :alt="banner.alt_text" class="aspect-[5/2] w-full object-cover" />
                  <div v-if="banner.title || banner.subtitle" class="p-2">
                    <p v-if="banner.title" class="text-xs font-black" style="font-family: var(--preview-font-heading)">{{ banner.title }}</p>
                    <p v-if="banner.subtitle" class="text-[11px] text-[var(--preview-muted)]">{{ banner.subtitle }}</p>
                  </div>
                </div>
              </div>

              <div class="mt-4 grid gap-3" :class="mode === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'">
                <div v-for="item in 2" :key="item" class="rounded-[var(--preview-radius)] border border-black/10 bg-[var(--preview-surface)] p-2">
                  <div class="aspect-[4/5] rounded-[calc(var(--preview-radius)*0.75)] bg-[var(--preview-secondary)]/20" />
                  <p class="mt-2 h-3 rounded bg-[var(--preview-text)]/80" />
                  <p class="mt-2 h-3 w-2/3 rounded bg-[var(--preview-muted)]/40" />
                  <span class="mt-3 inline-flex h-7 w-full items-center justify-center rounded-[var(--preview-radius)] bg-[var(--preview-primary)] text-[9px] font-black uppercase tracking-widest text-white">
                    Comprar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p v-if="isOptionsLoading" class="mt-3 text-[11px] text-bip-muted">Carregando destinos...</p>
      </div>
    </div>
  </aside>
</template>
