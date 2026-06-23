<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { TrashIcon } from '@heroicons/vue/24/outline';
import { useCategories } from '@/composables/useCategories';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import type { CategoryCreatePayload } from '@/schemas/category.schema';
import { Logger } from '@/services/logger';

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
    Logger.error('Category save failed', { error });
    toastError('Nao foi possivel salvar a categoria.');
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
    Logger.error('Category deletion failed', { error, categoryId });
    toastError('Nao foi possivel remover a categoria. Verifique se ela possui produtos vinculados.');
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
    <form v-if="canManageCatalog" class="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="submitCategory">
      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome</span>
        <input
          v-model="categoryDraft.name"
          type="text"
          class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
          placeholder="Bebidas, Combos, Acessorios..."
        />
      </label>

      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Descricao (opcional)</span>
        <textarea
          v-model="categoryDraft.description"
          rows="2"
          class="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
          placeholder="Contexto rapido para a equipe"
        />
      </label>

      <button
        type="submit"
        :disabled="isSavingCategory || categoryDraft.name.trim().length < 2"
        class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {{ isSavingCategory ? 'Salvando...' : 'Adicionar categoria' }}
      </button>
    </form>

    <div class="space-y-3">
      <div v-if="isCategoriesLoading" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div class="h-4 w-40 animate-pulse rounded bg-zinc-800" />
        <div class="mt-3 h-3 w-56 animate-pulse rounded bg-zinc-800" />
      </div>

      <div v-else-if="categoriesError" class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
        {{ categoriesError }}
      </div>

      <div v-else-if="categories.length === 0" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p class="text-sm font-semibold text-white">Nenhuma categoria cadastrada.</p>
        <p class="mt-1 text-xs leading-5 text-zinc-500">Cadastre ao menos uma categoria para liberar o formulario de produtos.</p>
      </div>

      <article v-for="category in categories" :key="category.id" class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-white">{{ category.name }}</p>
            <p v-if="category.description" class="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{{ category.description }}</p>
          </div>
          <button
            v-if="canManageCatalog"
            type="button"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
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
