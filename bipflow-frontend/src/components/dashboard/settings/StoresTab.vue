<script setup lang="ts">
import { ref } from 'vue';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import { storeService } from '@/services/store.service';

const { fetchCurrentStore, selectStore } = useCurrentStore();
const { success } = useToast();

const newStoreName = ref('');
const isCreatingStore = ref(false);
const createStoreError = ref<string | null>(null);

async function handleCreateStore(): Promise<void> {
  const name = newStoreName.value.trim();
  if (name.length < 2) {
    return;
  }

  isCreatingStore.value = true;
  createStoreError.value = null;

  try {
    const newStore = await storeService.create(name);
    await fetchCurrentStore(true);
    selectStore(newStore.slug);
    newStoreName.value = '';
    success(`Loja "${newStore.name}" criada com sucesso.`);
  } catch (error: unknown) {
    Logger.error('Store creation failed', { error, name });
    createStoreError.value = 'Nao foi possivel criar a loja. Tente novamente.';
  } finally {
    isCreatingStore.value = false;
  }
}
</script>

<template>
  <section class="max-w-md">
    <p class="text-xs leading-5 text-zinc-500">
      Voce passa a ser dona/dono dessa loja e pode trocar entre as suas lojas pelo seletor no topo.
    </p>

    <form class="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4" @submit.prevent="handleCreateStore">
      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome da loja</span>
        <input
          v-model="newStoreName"
          type="text"
          class="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
          placeholder="Ex.: Filial Centro"
        />
      </label>

      <p v-if="createStoreError" class="text-xs font-semibold text-rose-300">{{ createStoreError }}</p>

      <button
        type="submit"
        :disabled="isCreatingStore || newStoreName.trim().length < 2"
        class="w-full rounded-lg bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {{ isCreatingStore ? 'Criando...' : 'Criar loja' }}
      </button>
    </form>
  </section>
</template>
