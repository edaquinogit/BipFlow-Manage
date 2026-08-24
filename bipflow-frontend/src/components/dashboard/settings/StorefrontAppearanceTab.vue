<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useStorefrontAppearance } from '@/composables/useStorefrontAppearance';
import BannerSection from './storefront-appearance/BannerSection.vue';
import IdentityColorsSection from './storefront-appearance/IdentityColorsSection.vue';
import LayoutMotionSection from './storefront-appearance/LayoutMotionSection.vue';

type AppearanceSection = 'identidade' | 'banner' | 'estilo';

const SECTIONS: { value: AppearanceSection; label: string }[] = [
  { value: 'identidade', label: 'Identidade e cores' },
  { value: 'banner', label: 'Banner' },
  { value: 'estilo', label: 'Estilo e animacoes' },
];

const { selectedStore, storefrontPath } = useCurrentStore();
const storeSlug = computed(() => selectedStore.value?.slug);
const { appearance, isLoading, loadError, save } = useStorefrontAppearance(storeSlug);

const activeSection = ref<AppearanceSection>('identidade');
const isStorefrontLinkReady = computed(() => Boolean(selectedStore.value?.slug));
</script>

<template>
  <section>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="max-w-xl text-xs leading-5 text-bip-muted">
        Personalize a aparencia da vitrine desta loja. A estrutura, a acessibilidade e o desempenho
        continuam garantidos pelo BipFlow -- voce controla identidade, cores, banner, estilo e animacoes.
      </p>

      <a
        data-cy="open-current-storefront-link"
        :href="isStorefrontLinkReady ? storefrontPath : undefined"
        target="_blank"
        rel="noopener"
        :aria-disabled="!isStorefrontLinkReady"
        :tabindex="isStorefrontLinkReady ? 0 : -1"
        class="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] transition hover:border-[#D81B60] hover:text-[#D81B60] aria-disabled:cursor-not-allowed aria-disabled:bg-zinc-100 aria-disabled:text-bip-muted"
      >
        Abrir vitrine
      </a>
    </div>

    <nav role="tablist" aria-label="Secoes de aparencia" class="mt-5 inline-flex flex-wrap items-center gap-1 rounded-full border border-[#E5E7EB] bg-zinc-100 p-1">
      <button
        v-for="section in SECTIONS"
        :key="section.value"
        type="button"
        :data-cy="`storefront-appearance-section-${section.value}`"
        role="tab"
        :aria-selected="activeSection === section.value"
        class="rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300"
        :class="activeSection === section.value ? 'bg-[#D81B60] text-white shadow-lg shadow-[#D81B60]/30' : 'text-bip-muted hover:text-[#05050A]'"
        @click="activeSection = section.value"
      >
        {{ section.label }}
      </button>
    </nav>

    <p v-if="loadError" data-cy="storefront-appearance-load-error" class="mt-4 text-xs font-semibold text-[#D81B60]">{{ loadError }}</p>
    <p v-else-if="isLoading" data-cy="storefront-appearance-loading" class="mt-4 text-xs text-bip-muted">Carregando aparencia da vitrine...</p>

    <template v-else>
      <IdentityColorsSection v-if="activeSection === 'identidade'" class="mt-6" :appearance="appearance" :save="save" />
      <BannerSection v-else-if="activeSection === 'banner'" class="mt-6" :appearance="appearance" :save="save" />
      <LayoutMotionSection v-else class="mt-6" :appearance="appearance" :save="save" />
    </template>
  </section>
</template>
