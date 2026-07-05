import { computed, ref } from "vue";
import type { Store } from "@/types/store";
import { authService } from "@/services/auth.service";
import { storeService } from "@/services/store.service";
import { getSelectedStoreSlug, setSelectedStoreSlug } from "@/services/store-scope";
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

export function useCurrentStore() {
  const selectedStore = computed(() => {
    if (!stores.value.length) {
      return store.value;
    }

    return (
      stores.value.find((item) => item.slug === selectedStoreSlug.value)
      ?? store.value
      ?? stores.value[0]
      ?? null
    );
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
      const resolvedStore = await storeService.getCurrent();
      store.value = resolvedStore;
      stores.value = [resolvedStore];
      selectedStoreSlug.value = resolvedStore.slug;
      setSelectedStoreSlug(resolvedStore.slug);
      lastFetched.value = Date.now();

      if (authService.isAuthenticated()) {
        try {
          const myStores = await storeService.getMine();
          if (myStores.length) {
            stores.value = myStores;
          }
        } catch (err) {
          // Non-fatal: the dashboard still works with just the resolved
          // store, same as before the switcher existed.
        }
      }
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
