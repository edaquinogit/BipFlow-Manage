<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useCategories } from '@/composables/useCategories';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import type { CategoryCreatePayload } from '@/schemas/category.schema';
import { Logger } from '@/services/logger';
import { buildErrorContext, type ApplicationError } from '@/types/errors';
import { buildCategoryTree, categoryHasParent } from '@/utils/categories';

const { canManageCatalog } = useCurrentUser();
const { success, error: toastError } = useToast();

const {
  categories,
  loading: isCategoriesLoading,
  error: categoriesError,
  fetchCategories,
  addCategory,
  deleteCategory,
} = useCategories();

const isSavingCategory = ref(false);
const deletingCategoryId = ref<number | null>(null);
const categoryDraft = ref<CategoryCreatePayload>({ name: '', description: '', parent: null });

const categoryTree = computed(() => buildCategoryTree(categories.value));
const parentCategories = computed(() =>
  categories.value.filter((category) => !categoryHasParent(category)),
);
const isSubcategoryDraft = computed(() => categoryDraft.value.parent !== null && categoryDraft.value.parent !== undefined);
const selectedParentName = computed(() => {
  const parent = parentCategories.value.find((category) => category.id === Number(categoryDraft.value.parent));
  return parent?.name ?? '';
});
const submitButtonLabel = computed(() => {
  if (isSavingCategory.value) {
    return 'Salvando...';
  }

  return isSubcategoryDraft.value ? 'Adicionar subcategoria' : 'Adicionar categoria';
});

function resetCategoryDraft(): void {
  categoryDraft.value = { name: '', description: '', parent: null };
}

function handleParentChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  categoryDraft.value.parent = value ? Number(value) : null;
}

function startSubcategory(parentId: number): void {
  categoryDraft.value.parent = parentId;
}

async function submitCategory(): Promise<void> {
  const name = categoryDraft.value.name.trim();
  if (name.length < 2) {
    return;
  }

  isSavingCategory.value = true;
  try {
    await addCategory({
      name,
      description: categoryDraft.value.description?.trim() ?? '',
      parent: categoryDraft.value.parent ?? null,
    });
    success(isSubcategoryDraft.value ? 'Subcategoria criada com sucesso.' : 'Categoria criada com sucesso.');
    resetCategoryDraft();
  } catch (error: unknown) {
    Logger.error('Category save failed', buildErrorContext(error as ApplicationError));
    toastError('Não foi possível salvar a categoria.');
  } finally {
    isSavingCategory.value = false;
  }
}

async function handleDeleteCategory(categoryId: number): Promise<void> {
  deletingCategoryId.value = categoryId;
  try {
    await deleteCategory(categoryId);
    success('Categoria removida com sucesso.');
  } catch (error: unknown) {
    Logger.error('Category deletion failed', buildErrorContext(error as ApplicationError, { categoryId }));
    toastError('Não foi possível remover a categoria. Verifique se ela possui produtos ou subcategorias vinculados.');
  } finally {
    deletingCategoryId.value = null;
  }
}

onMounted(() => {
  void fetchCategories(true);
});

useStoreSwitchEffect(() => {
  void fetchCategories(true);
});
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
    <form v-if="canManageCatalog" class="space-y-3 rounded-lg border border-[#E5E7EB] bg-white p-4" @submit.prevent="submitCategory">
      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">Categoria principal</span>
        <select
          :value="categoryDraft.parent ?? ''"
          class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="handleParentChange"
        >
          <option value="">Nenhuma, criar categoria principal</option>
          <option
            v-for="parent in parentCategories"
            :key="parent.id"
            :value="parent.id"
          >
            {{ parent.name }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">
          {{ isSubcategoryDraft ? 'Nome da subcategoria' : 'Nome' }}
        </span>
        <input
          v-model="categoryDraft.name"
          type="text"
          maxlength="100"
          class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          :placeholder="isSubcategoryDraft ? 'Biquíni, Macacão, Saída de praia...' : 'Moda Praia, Acessórios, Combos...'"
        />
      </label>

      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">Descrição (opcional)</span>
        <textarea
          v-model="categoryDraft.description"
          rows="2"
          class="w-full resize-none rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          :placeholder="isSubcategoryDraft && selectedParentName ? `Dentro de ${selectedParentName}` : 'Contexto rápido para a equipe'"
        />
      </label>

      <button
        type="submit"
        :disabled="isSavingCategory || categoryDraft.name.trim().length < 2"
        class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
      >
        {{ submitButtonLabel }}
      </button>
    </form>

    <div class="space-y-3">
      <div v-if="isCategoriesLoading" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <div class="h-4 w-40 animate-pulse rounded bg-zinc-100" />
        <div class="mt-3 h-3 w-56 animate-pulse rounded bg-zinc-100" />
      </div>

      <div v-else-if="categoriesError" class="rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-4 text-sm text-[#7A143D]">
        {{ categoriesError }}
      </div>

      <div v-else-if="categories.length === 0" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <p class="text-sm font-semibold text-[#05050A]">Nenhuma categoria cadastrada.</p>
        <p class="mt-1 text-xs leading-5 text-bip-muted">Cadastre ao menos uma categoria para liberar o formulário de produtos.</p>
      </div>

      <article v-for="category in categoryTree" :key="category.id" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-[#05050A]">{{ category.name }}</p>
            <p v-if="category.description" class="mt-1 line-clamp-2 text-xs leading-5 text-bip-muted">{{ category.description }}</p>
            <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-bip-muted">
              {{ category.children.length }} subcategoria{{ category.children.length === 1 ? '' : 's' }}
              <span v-if="category.product_count"> · {{ category.product_count }} produto{{ category.product_count === 1 ? '' : 's' }} direto{{ category.product_count === 1 ? '' : 's' }}</span>
            </p>
          </div>

          <div v-if="canManageCatalog" class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-bip-muted transition hover:border-[#D81B60]/40 hover:bg-[#FCE7F3] hover:text-[#D81B60]"
              title="Adicionar subcategoria"
              @click="startSubcategory(category.id)"
            >
              <PlusIcon class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] text-[#D81B60] transition hover:border-[#D81B60]/40 hover:bg-[#FCE7F3]/70 disabled:cursor-not-allowed disabled:opacity-50"
              title="Remover categoria"
              :disabled="deletingCategoryId === category.id"
              @click="handleDeleteCategory(category.id)"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div v-if="category.children.length" class="mt-4 divide-y divide-[#E5E7EB] border-t border-[#E5E7EB] pt-2">
          <div
            v-for="child in category.children"
            :key="child.id"
            class="flex items-center justify-between gap-4 py-2 pl-4"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-bold text-[#05050A]">{{ child.name }}</p>
              <p v-if="child.description" class="mt-0.5 line-clamp-1 text-[11px] text-bip-muted">{{ child.description }}</p>
              <p v-if="child.product_count" class="mt-1 text-[9px] font-bold uppercase tracking-widest text-bip-muted">
                {{ child.product_count }} produto{{ child.product_count === 1 ? '' : 's' }}
              </p>
            </div>

            <button
              v-if="canManageCatalog"
              type="button"
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] text-[#D81B60] transition hover:border-[#D81B60]/40 hover:bg-[#FCE7F3]/70 disabled:cursor-not-allowed disabled:opacity-50"
              title="Remover subcategoria"
              :disabled="deletingCategoryId === child.id"
              @click="handleDeleteCategory(child.id)"
            >
              <TrashIcon class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
