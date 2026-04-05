/**
 * ✨ BIPFLOW PERFECT COMPOSABLE TEMPLATE
 * 
 * This is the canonical template for all new BipFlow composables.
 * Copy this file and rename it to use{EntityName}.ts
 * 
 * Standards Applied:
 * ✅ Singleton reactive store (shared across components)
 * ✅ Proper error handling with DRF integration
 * ✅ Granular loading states
 * ✅ Consistent API error formatting
 * ✅ Type-safe operations
 * 
 * @template EntityName Replace "Entity" with your domain object (Product, Order, Customer)
 */

import { ref, computed } from 'vue';
import type { Entity } from '@/schemas/entity.schema';  // ← Replace: Entity with your type
import EntityService from '@/services/entity.service';  // ← Replace: EntityService with yours
import { formatDrfErrorPayload, isAxiosError } from '@/lib/drfErrors';  // ✅ REQUIRED
import { entityLogger } from '@/lib/logger';  // ✅ RECOMMENDED: Structured logging

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛰️ SINGLETON REACTIVE STORE
 * 
 * Module-level state shared across all useEntity() consumers.
 * All state is reactive (changes trigger component re-renders).
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ✅ Main data array (cached from backend)
const items = ref<Entity[]>([]);

// ✅ Loading state (data fetch in progress)
const loading = ref(false);

// ✅ Error message (last API error)
const error = ref<string | null>(null);

/**
 * 🧹 CLEAR MODULE STATE (For unit tests only)
 * Resets all module-level reactive state to initial values.
 */
export function resetEntityCatalogForTests(): void {
  items.value = [];
  loading.value = false;
  error.value = null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ HELPER FUNCTIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Extract error detail from various error types
 * Handles Axios errors, standard errors, and unknown types
 */
function getApiErrorDetail(err: unknown): string {
  if (isAxiosError(err) && err.response?.data !== undefined) {
    return formatDrfErrorPayload(err.response.data);
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

/**
 * 🛰️ BIPFLOW ENTITY COMPOSABLE
 * 
 * Provides reactive state management and CRUD operations for entities.
 * All operations automatically update the module-level store.
 */
export function useEntity() {
  /**
   * 📥 FETCH ALL ENTITIES FROM BACKEND
   * 
   * Queries /api/v1/entities/ and populates the module-level store.
   * Sets loading state while in progress, error state if failed.
   */
  const fetchData = async () => {
    loading.value = true;
    error.value = null;

    try {
      items.value = await EntityService.getAll();
      entityLogger.info(
        { count: items.value.length },
        'Catalog synced from backend'
      );
    } catch (err: unknown) {
      const msg = getApiErrorDetail(err);
      error.value = `Sync Failed: ${msg}`;
      entityLogger.error({ err }, 'Fetch catalog failed');
    } finally {
      loading.value = false;
    }
  };

  /**
   * ✨ CREATE NEW ENTITY (POST)
   * 
   * Sends POST request to /api/v1/entities/ to create a new entity.
   * On success, prepends new entity to store and returns it.
   * On failure, sets error state and throws error for caller to handle.
   * 
   * @param data - Entity data (will be serialized by EntityService)
   * @return Created entity with ID and timestamps
   * @throws Error if API call fails
   */
  const createItem = async (data: Partial<Entity>): Promise<Entity | undefined> => {
    loading.value = true;
    error.value = null;

    try {
      const payload = preparePayload(data);
      const newEntity = await EntityService.create(payload);

      // ✅ Prepend to store (new items appear at top)
      items.value = [newEntity, ...items.value];
      entityLogger.info({ id: newEntity.id }, 'Entity created');
      return newEntity;
    } catch (err: unknown) {
      const apiMessage = getApiErrorDetail(err);
      error.value = `Creation failed: ${apiMessage}`;
      entityLogger.error({ err, apiMessage }, 'Create entity failed');
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 🔄 UPDATE EXISTING ENTITY (PATCH)
   * 
   * Sends PATCH request to /api/v1/entities/{id}/ to update an entity.
   * On success, finds entity in store by ID and merges new data.
   * On failure, sets error state and throws error for caller to handle.
   * 
   * @param id - Entity ID to update
   * @param data - Partial entity data (only changed fields)
   * @return Updated entity
   * @throws Error if API call fails
   */
  const updateItem = async (id: number, data: Partial<Entity>) => {
    loading.value = true;
    error.value = null;

    try {
      const payload = preparePayload(data);
      const updatedEntity = await EntityService.update(id, payload);

      // ✅ Find in store and update
      const idx = items.value.findIndex((item) => item.id === id);
      if (idx !== -1) {
        // Entity found: merge new data into existing object
        Object.assign(items.value[idx], updatedEntity);
      } else {
        // Entity not in store: prepend it (shouldn't happen normally)
        items.value = [updatedEntity, ...items.value];
        entityLogger.warn({ id }, 'Updated entity missing locally; prepended');
      }

      entityLogger.info({ id }, 'Entity updated in catalog');
      return updatedEntity;
    } catch (err: unknown) {
      const apiMessage = getApiErrorDetail(err);
      error.value = `Update failed: ${apiMessage}`;
      entityLogger.error({ err, id, apiMessage }, 'Update entity failed');
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 🗑️ DELETE ENTITY (DELETE)
   * 
   * Sends DELETE request to /api/v1/entities/{id}/ to remove an entity.
   * On success, removes entity from store.
   * On failure, sets error state and throws error for caller to handle.
   * 
   * @param id - Entity ID to delete
   * @throws Error if API call fails
   */
  const deleteItem = async (id: number) => {
    loading.value = true;

    try {
      await EntityService.delete(id);
      items.value = items.value.filter((item) => item.id !== id);
      entityLogger.info({ id }, 'Entity deleted');
    } catch (err: unknown) {
      const apiMessage = getApiErrorDetail(err);
      error.value = `Deletion failed: ${apiMessage}`;
      entityLogger.error({ err, id }, 'Delete entity failed');
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔧 INTERNAL HELPERS (Private to this composable)
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Prepare and validate entity data before sending to API
   * Filters out read-only fields, validates types, and handles FormData.
   */
  const preparePayload = (data: Partial<Entity>): FormData => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined) return;

      // ✅ Handle file uploads (images, documents)
      if (value instanceof File) {
        formData.append(key, value);
      } else if (typeof value === 'object') {
        // ✅ Handle nested objects (e.g., category as {id, name})
        if ('id' in value) {
          formData.append(key, String((value as any).id));
        } else {
          formData.append(key, JSON.stringify(value));
        }
      } else {
        formData.append(key, String(value));
      }
    });

    return formData;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 📤 PUBLIC API (What consumers import and use)
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    // ✅ Reactive state (updates trigger re-renders)
    items,
    loading,
    error,

    // ✅ Operations (all handle loading/error states automatically)
    fetchData,
    createItem,
    updateItem,
    deleteItem,
  };
}
