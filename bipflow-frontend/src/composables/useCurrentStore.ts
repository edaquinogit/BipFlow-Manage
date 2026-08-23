import { computed, ref } from "vue";
import type { Store } from "@/types/store";
import { authService } from "@/services/auth.service";
import { storeService } from "@/services/store.service";
import {
  getSelectedStoreSlug,
  setSelectedStoreSlug,
  subscribeStoreScopeChange,
} from "@/services/store-scope";
import { buildStoreBranding } from "@/composables/useStoreBranding";

// Singleton compartilhado pelo dashboard e pelo catalogo publico. `getMine()`
// (Etapa 4: a lista real de lojas do usuario) so e' chamado quando autenticado
// -- visitantes anonimos do catalogo nunca devem bater nesse endpoint.
const store = ref<Store | null>(null);
const stores = ref<Store[]>([]);
const selectedStoreSlug = ref<string | null>(getSelectedStoreSlug());
const loading = ref(false);
const error = ref<string | null>(null);
const lastFetched = ref<number | null>(null);

subscribeStoreScopeChange((slug) => {
  selectedStoreSlug.value = slug;

  if (slug) {
    return;
  }

  store.value = null;
  stores.value = [];
  error.value = null;
  lastFetched.value = null;
});

function applySelectedStore(nextStore: Store, availableStores: Store[] = [nextStore]): void {
  store.value = nextStore;
  stores.value = availableStores;
  selectedStoreSlug.value = nextStore.slug;
  setSelectedStoreSlug(nextStore.slug);
  lastFetched.value = Date.now();
}

export function useCurrentStore() {
  const selectedStore = computed(() => {
    if (!stores.value.length) {
      return store.value;
    }

    const selectedFromMemberships = stores.value.find((item) => item.slug === selectedStoreSlug.value);
    if (selectedFromMemberships) {
      return selectedFromMemberships;
    }

    if (store.value) {
      const currentFromMemberships = stores.value.find((item) => item.slug === store.value?.slug);
      if (currentFromMemberships) {
        return currentFromMemberships;
      }
    }

    return stores.value[0] ?? null;
  });

  const storefrontPath = computed(() => (
    selectedStore.value?.slug ? `/l/${selectedStore.value.slug}/produtos` : "/produtos"
  ));
  const branding = computed(() => buildStoreBranding(selectedStore.value));

  const fetchCurrentStore = async (force = false) => {
    const isCacheFresh = Boolean(
      lastFetched.value && Date.now() - lastFetched.value < 300000
    );
    const doesCacheMatchRequestedSlug =
      !selectedStoreSlug.value || store.value?.slug === selectedStoreSlug.value;

    if (!force && store.value && isCacheFresh && doesCacheMatchRequestedSlug) return;

    loading.value = true;
    error.value = null;

    try {
      if (authService.isAuthenticated()) {
        const myStores = await storeService.getMine();
        if (myStores.length) {
          const fallbackStore = myStores[0];
          if (!fallbackStore) {
            return;
          }

          const trustedStore =
            myStores.find((item) => item.slug === selectedStoreSlug.value)
            ?? fallbackStore;
          applySelectedStore(trustedStore, myStores);
          return;
        }
      }

      const resolvedStore = await storeService.getCurrent();
      applySelectedStore(resolvedStore);
    } catch (err) {
      error.value = "Nao foi possivel carregar a loja atual.";
    } finally {
      loading.value = false;
    }
  };

  const selectStore = (slug: string) => {
    const nextStore = stores.value.find((item) => item.slug === slug);

    if (!nextStore) {
      return;
    }

    store.value = nextStore;
    selectedStoreSlug.value = nextStore.slug;
    setSelectedStoreSlug(nextStore.slug);
  };

  return {
    store,
    stores,
    selectedStore,
    selectedStoreSlug,
    branding,
    storefrontPath,
    loading,
    error,
    fetchCurrentStore,
    selectStore,
  };
}
