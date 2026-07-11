<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { TrashIcon } from '@heroicons/vue/24/outline';
import { useCategories } from '@/composables/useCategories';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import type { CategoryCreatePayload } from '@/schemas/category.schema';
import { Logger } from '@/services/logger';
import { buildErrorContext, type ApplicationError } from '@/types/errors';

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
const categoryDraft = ref<CategoryCreatePayload>({ name: '', description: '' });

function resetCategoryDraft(): void {
  categoryDraft.value = { name: '', description: '' };
}

async function submitCategory(): Promise<void> {
  const name = categoryDraft.value.name.trim();
  if (name.length < 2) {
    return;
  }

  isSavingCategory.value = true;
  try {
    await addCategory({ name, description: categoryDraft.value.description?.trim() ?? '' });
    success('Categoria criada com sucesso.');
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
    toastError('Não foi possível remover a categoria. Verifique se ela possui produtos vinculados.');
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
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">Nome</span>
        <input
          v-model="categoryDraft.name"
          type="text"
          class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          placeholder="Bebidas, Combos, Acessórios..."
        />
      </label>

      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">Descrição (opcional)</span>
        <textarea
          v-model="categoryDraft.description"
          rows="2"
          class="w-full resize-none rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          placeholder="Contexto rápido para a equipe"
        />
      </label>

      <button
        type="submit"
        :disabled="isSavingCategory || categoryDraft.name.trim().length < 2"
        class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
      >
        {{ isSavingCategory ? 'Salvando...' : 'Adicionar categoria' }}
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

      <article v-for="category in categories" :key="category.id" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-[#05050A]">{{ category.name }}</p>
            <p v-if="category.description" class="mt-1 line-clamp-2 text-xs leading-5 text-bip-muted">{{ category.description }}</p>
          </div>
          <button
            v-if="canManageCatalog"
            type="button"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#D81B60] transition hover:border-[#D81B60]/40 hover:bg-[#FCE7F3]/70 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="deletingCategoryId === category.id"
            @click="handleDeleteCategory(category.id)"
          >
            <TrashIcon class="h-4 w-4" />
            {{ deletingCategoryId === category.id ? 'Removendo' : 'Remover' }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
