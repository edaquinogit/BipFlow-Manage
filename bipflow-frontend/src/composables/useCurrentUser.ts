import { ref } from "vue";
import { authService } from "../services/auth.service";
import { Logger } from "../services/logger";

// Singleton (mesmo padrao de useCategories/useCurrentStore/useToast): o
// DashboardLayout busca o perfil uma vez e as paginas filhas (Produtos,
// Pedidos, Configuracoes) so leem canManageCatalog sem refazer a chamada.
const currentUserName = ref<string | null>(null);
const canManageCatalog = ref(false);
// Etapa 0 of the pedidos/NF/envio evolution: same underlying permission as
// canManageCatalog today (see CurrentUserSerializer.get_can_manage_orders),
// kept as its own field/name so order-management gating reads correctly
// once it becomes a real separate role later.
const canManageOrders = ref(false);
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
      canManageOrders.value = currentUser.can_manage_orders;
      mfaEnabled.value = currentUser.mfa_enabled;
      return true;
    } catch (error: unknown) {
      Logger.warn("Failed to fetch dashboard user profile", { error });
      currentUserName.value = null;
      canManageCatalog.value = false;
      canManageOrders.value = false;
      canAccessDashboard.value = false;
      return false;
    } finally {
      loading.value = false;
    }
  };

  return {
    currentUserName,
    canManageCatalog,
    canManageOrders,
    canAccessDashboard,
    mfaEnabled,
    loading,
    fetchCurrentUser,
  };
}
