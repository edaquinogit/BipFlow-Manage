<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import { authService } from '@/services/auth.service';

import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';

const {
  stores,
  selectedStore,
  branding: storeBranding,
  storefrontPath,
  loading: isCurrentStoreLoading,
  error: currentStoreError,
  fetchCurrentStore,
  selectStore,
} = useCurrentStore();
const { currentUserName, fetchCurrentUser } = useCurrentUser();
const { success } = useToast();
const router = useRouter();

const activeStoreBadgeLabel = computed(() => (
  selectedStore.value ? storeBranding.value.name : 'Carregando loja'
));
const activeStoreSlug = computed(() => (
  storeBranding.value.slug ? `/${storeBranding.value.slug}` : ''
));
const activeStoreStatusLabel = computed(() => storeBranding.value.statusLabel);

const handleSelectStore = (storeSlug: string): void => {
  if (storeSlug === selectedStore.value?.slug) {
    return;
  }

  selectStore(storeSlug);
  success('Loja ativa atualizada.');
};

const handleOpenStore = (): void => {
  window.open(storefrontPath.value, '_blank', 'noopener,noreferrer');
};

const handleLogout = async (): Promise<void> => {
  await authService.logout();
};

onMounted(async () => {
  const canAccessDashboard = await fetchCurrentUser();

  if (!canAccessDashboard) {
    await router.replace('/403');
    return;
  }

  await fetchCurrentStore();
});
</script>

<template>
  <div class="min-h-screen bg-[#FAFAFA] text-[#05050A] selection:bg-[#FCE7F3] font-sans antialiased" data-cy="dashboard-view">
    <DashboardHeader
      :user-name="currentUserName"
      :stores="stores"
      :selected-store="selectedStore"
      :is-store-loading="isCurrentStoreLoading"
      :storefront-path="storefrontPath"
      @select-store="handleSelectStore"
      @open-store="handleOpenStore"
      @logout="handleLogout"
    />

    <div class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-5 z-40 hidden max-w-[18rem] items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white/95 px-4 py-3 text-xs shadow-[0_14px_35px_-28px_rgba(5,5,10,0.45)] backdrop-blur-xl sm:flex">
      <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]" />
      <div class="min-w-0">
        <p class="font-black uppercase tracking-[0.18em] text-bip-muted">Loja {{ activeStoreStatusLabel.toLowerCase() }}</p>
        <p class="mt-1 truncate font-semibold text-[#05050A]">
          {{ activeStoreBadgeLabel }}
          <span class="font-normal text-bip-muted">{{ activeStoreSlug }}</span>
        </p>
      </div>
    </div>

    <div
      v-if="currentStoreError"
      class="mx-auto mt-6 max-w-7xl px-6"
    >
      <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        {{ currentStoreError }}
      </div>
    </div>

    <main class="max-w-7xl mx-auto px-6 py-12">
      <RouterView />
    </main>
  </div>
</template>
