<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import { authService } from '@/services/auth.service';

import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';

const {
  stores,
  selectedStore,
  storefrontPath,
  loading: isCurrentStoreLoading,
  error: currentStoreError,
  fetchCurrentStore,
  selectStore,
} = useCurrentStore();
const { currentUserName, fetchCurrentUser } = useCurrentUser();
const { success } = useToast();
const router = useRouter();

const handleSelectStore = (storeSlug: string): void => {
  if (storeSlug === selectedStore.value?.slug) {
    return;
  }

  selectStore(storeSlug);
  success('Loja ativa atualizada.');
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
      @logout="handleLogout"
    />


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
