import { ref } from "vue";
import { authService } from "../services/auth.service";
import { Logger } from "../services/logger";

// Singleton (mesmo padrao de useCategories/useCurrentStore/useToast): o
// DashboardLayout busca o perfil uma vez e as paginas filhas (Produtos,
// Pedidos, Configuracoes) so leem canManageCatalog sem refazer a chamada.
const currentUserName = ref<string | null>(null);
const canManageCatalog = ref(false);
const canAccessDashboard = ref<boolean | null>(null);
const mfaEnabled = ref(false);
const loading = ref(false);

export function useCurrentUser() {
  const fetchCurrentUser = async (): Promise<boolean> => {
    loading.value = true;

    try {
      const currentUser = await authService.getCurrentUser();
      canAccessDashboard.value = currentUser.can_access_dashboard;

      if (!currentUser.can_access_dashboard) {
        return false;
      }

      currentUserName.value = currentUser.display_name || currentUser.email || currentUser.username;
      canManageCatalog.value = currentUser.can_manage_catalog;
      mfaEnabled.value = currentUser.mfa_enabled;
      return true;
    } catch (error: unknown) {
      Logger.warn("Failed to fetch dashboard user profile", { error });
      currentUserName.value = null;
      canManageCatalog.value = false;
      canAccessDashboard.value = false;
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    currentUserName,
    canManageCatalog,
    canAccessDashboard,
    mfaEnabled,
    loading,
    fetchCurrentUser,
  };
}
