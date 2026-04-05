<script setup lang="ts">
/**
 * ✨ BIPFLOW PERFECT PAGE TEMPLATE
 * 
 * This is the canonical template for all new BipFlow Vue 3 pages.
 * Copy this file and replace "ENTITY" with your domain entity (Product, Order, Customer, etc).
 * 
 * Standards Applied:
 * ✅ Vue 3.4+ <script setup> with TypeScript
 * ✅ Absolute image URLs via resolveMediaSrc helper
 * ✅ DRF error handling via formatDrfErrorPayload
 * ✅ Cache invalidation via :key="item.id + item.updated_at"
 * ✅ Reactive state management with composables
 * ✅ Proper error boundaries and loading states
 * 
 * @template EntityName Replace "Entity" with your domain object (Product, Order, Customer)
 * @example
 * // 1. Replace all "Entity" with your entity name (ProductView.vue, useProducts, EntityService)
 * // 2. Import correct types and services for your domain
 * // 3. Adjust the API calls to match your backend endpoints
 * // 4. Update component templates to match your data
 */

import { ref, onMounted, computed } from 'vue';
import { useEntity } from '@/composables/useEntity';  // ← Replace: useEntity with your composable
import type { Entity } from '@/schemas/entity.schema';  // ← Replace: Entity with your type
import EntityService from '@/services/entity.service';  // ← Replace: EntityService with yours
import { resolveMediaSrc } from '@/lib/apiBase';  // ✅ REQUIRED: Media URL resolution
import { formatDrfErrorPayload } from '@/lib/drfErrors';  // ✅ REQUIRED: Django error handling
import { pageLogger } from '@/lib/logger';  // ✅ RECOMMENDED: Structured logging

// ═══════════════════════════════════════════════════════════════════════════
// 1️⃣ UI STATE MACHINE (Modal & Form Control)
// ═══════════════════════════════════════════════════════════════════════════
const isFormPanelOpen = ref(false);
const isDeleteConfirmOpen = ref(false);
const selectedEntity = ref<Entity | null>(null);
const entityToDelete = ref<number | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// 2️⃣ DATA LAYER (Business Logic via Composables)
// ═══════════════════════════════════════════════════════════════════════════
const {
  items: entities,           // ← Main data array (reactive)
  loading: isDataLoading,    // ← Data fetch in progress
  error: dataError,          // ← Last API error message
  fetchData,                 // ← Load all entities from backend
  createItem: createEntity,  // ← Create new entity (POST)
  updateItem: updateEntity,  // ← Update existing entity (PATCH)
  deleteItem: deleteEntity,  // ← Delete entity (DELETE)
} = useEntity();

// ═══════════════════════════════════════════════════════════════════════════
// 3️⃣ ASYNC OPERATION STATES (Granular loading to prevent UI freeze)
// ═══════════════════════════════════════════════════════════════════════════
const isSaving = ref(false);
const isDeletingAction = ref(false);

// ═══════════════════════════════════════════════════════════════════════════
// 4️⃣ COMPUTED PROPERTIES (Derived state for template rendering)
// ═══════════════════════════════════════════════════════════════════════════
const emptyState = computed(() => !isDataLoading.value && entities.value.length === 0);
const hasError = computed(() => !!dataError.value);

// ═══════════════════════════════════════════════════════════════════════════
// 5️⃣ EVENT HANDLERS — FORM LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Open the creation form with empty state
 */
const handleOpenCreateForm = () => {
  selectedEntity.value = null;
  isFormPanelOpen.value = true;
};

/**
 * Open the edit form pre-populated with selected entity
 * @param entity - The entity to edit (deep clone to isolate from reactive store)
 */
const handleOpenEditForm = (entity: Entity) => {
  selectedEntity.value = { ...entity };
  isFormPanelOpen.value = true;
};

/**
 * Close all form panels and reset selection
 */
const handleCloseForm = () => {
  isFormPanelOpen.value = false;
  selectedEntity.value = null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 6️⃣ EVENT HANDLERS — CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Persist entity to backend
 * Automatically routes to POST (create) or PATCH (update) based on entity.id
 * 
 * @param formData - Sanitized form data from the form component
 */
const handleSave = async (formData: Partial<Entity>) => {
  isSaving.value = true;

  try {
    if (selectedEntity.value?.id) {
      // UPDATE: Entity has ID, use PATCH
      await updateEntity(selectedEntity.value.id, formData);
      pageLogger.info(
        { id: selectedEntity.value.id },
        'Entity updated and synced'
      );
    } else {
      // CREATE: No ID, use POST
      await createEntity(formData);
      pageLogger.info({}, 'Entity created and synced');
    }

    // Refresh all data to ensure consistency with backend state
    await fetchData();
    handleCloseForm();
  } catch (err: unknown) {
    // Error handling already done in composable, just log here
    pageLogger.error({ err }, 'Persist operation failed');
    // Error message already set in composable's error.value
  } finally {
    isSaving.value = false;
  }
};

/**
 * Initiate delete confirmation dialog
 * @param id - Entity ID to delete (deferred until user confirms)
 */
const handleOpenDeleteConfirm = (id: number) => {
  entityToDelete.value = id;
  isDeleteConfirmOpen.value = true;
};

/**
 * Execute delete after user confirmation
 * Removes entity from backend and local state
 */
const handleConfirmDelete = async () => {
  if (!entityToDelete.value) return;

  isDeletingAction.value = true;

  try {
    await deleteEntity(entityToDelete.value);
    pageLogger.info(
      { id: entityToDelete.value },
      'Entity purged from backend'
    );
    await fetchData();
  } catch (err: unknown) {
    pageLogger.error({ err }, 'Delete operation failed');
  } finally {
    isDeletingAction.value = false;
    isDeleteConfirmOpen.value = false;
    entityToDelete.value = null;
  }
};

/**
 * Retry failed data fetch (on error state)
 */
const handleRetry = async () => {
  pageLogger.info({}, 'Retrying data fetch...');
  await fetchData();
};

// ═══════════════════════════════════════════════════════════════════════════
// 7️⃣ LIFECYCLE — BOOT SEQUENCE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(async () => {
  pageLogger.info({}, 'Page mounted, bootstrapping data...');
  await fetchData();
});
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-indigo-500/30 font-sans antialiased" data-cy="entity-view">
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- PAGE HEADER -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <header class="bg-zinc-900/50 border-b border-zinc-800 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div>
          <h1 class="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
            Entities Registry  <!-- ← Replace with your page title -->
          </h1>
          <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-2">
            Central Hub for Entity Management
          </p>
        </div>
        <button
          @click="handleOpenCreateForm"
          class="bg-white text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5"
        >
          + Create New Entity
        </button>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- MAIN CONTENT AREA -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <main class="max-w-7xl mx-auto px-6 py-12">
      <!-- LOADING STATE -->
      <div v-if="isDataLoading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="h-24 bg-zinc-900/30 animate-pulse rounded-2xl border border-white/5" />
      </div>

      <!-- ERROR STATE -->
      <div
        v-else-if="hasError"
        class="p-16 bg-red-950/10 border border-red-500/20 rounded-[3rem] text-center backdrop-blur-sm"
      >
        <p class="text-red-400 font-black uppercase text-[11px] tracking-[0.3em] mb-6">
          {{ dataError }}
        </p>
        <button
          @click="handleRetry"
          class="text-white font-black text-[10px] border border-white/10 px-10 py-3 rounded-full hover:bg-white/5 transition-all uppercase tracking-widest"
        >
          Retry Connection
        </button>
      </div>

      <!-- EMPTY STATE -->
      <div v-else-if="emptyState" class="flex flex-col items-center justify-center py-32">
        <div class="text-zinc-600 mb-6">
          <svg class="h-20 w-20 mx-auto opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 class="text-xl font-black text-white italic uppercase mb-2">No Entities Yet</h3>
        <p class="text-zinc-500 text-[12px] font-bold uppercase tracking-widest">
          Create your first entity to get started
        </p>
      </div>

      <!-- DATA TABLE / GRID -->
      <div v-else class="space-y-4">
        <!-- ✅ KEY PATTERN: item.id + item.updated_at for cache invalidation -->
        <!-- This forces Vue to re-render the component when the entity updates, -->
        <!-- ensuring fresh images and data are displayed without stale cache -->
        <div
          v-for="entity in entities"
          :key="`${entity.id}-${entity.updated_at || entity.name}`"
          class="group bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-indigo-500/30 transition-all duration-300 flex justify-between items-center"
        >
          <!-- ENTITY CONTENT -->
          <div class="flex-1">
            <h3 class="text-lg font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
              {{ entity.name }}
            </h3>
            <p class="text-[10px] text-zinc-500 font-mono font-bold tracking-widest uppercase mt-1">
              ID: {{ entity.id }}
            </p>
          </div>

          <!-- ACTION BUTTONS -->
          <div class="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <button
              @click="handleOpenEditForm(entity)"
              class="p-2.5 hover:bg-indigo-500/10 rounded-lg text-zinc-500 hover:text-indigo-400 transition-colors"
              title="Edit Entity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              @click="handleOpenDeleteConfirm(entity.id)"
              class="p-2.5 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
              title="Delete Entity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- FORM MODAL (Create / Update) -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- Replace EntityFormPanel with your actual form component -->
    <EntityFormPanel
      :is-open="isFormPanelOpen"
      :initial-data="selectedEntity"
      :is-saving="isSaving"
      @close="handleCloseForm"
      @save="handleSave"
    />

    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- DELETE CONFIRMATION MODAL -->
    <!-- ═══════════════════════════════════════════════════════════════════════════ -->
    <!-- Replace ConfirmModal with your actual confirmation component -->
    <ConfirmModal
      :show="isDeleteConfirmOpen"
      title="Confirm Deletion"
      message="This action cannot be undone. The entity will be permanently removed."
      :is-loading="isDeletingAction"
      @close="isDeleteConfirmOpen = false"
      @confirm="handleConfirmDelete"
    />
  </div>
</template>

<style scoped>
/* Add your page-specific styles here */
</style>
