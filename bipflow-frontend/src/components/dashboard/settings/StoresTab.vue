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
    createStoreError.value = 'Não foi possível criar a loja. Tente novamente.';
  } finally {
    isCreatingStore.value = false;
  }
}
</script>

<template>
  <section class="max-w-md">
    <p class="text-xs leading-5 text-bip-muted">
      Você passa a ser dona/dono dessa loja e pode trocar entre as suas lojas pelo seletor no topo.
    </p>

    <form class="mt-4 space-y-3 rounded-lg border border-[#E5E7EB] bg-white p-4" @submit.prevent="handleCreateStore">
      <label class="block">
        <span class="mb-2 block text-[10px] font-black uppercase tracking-widest text-bip-muted">Nome da loja</span>
        <input
          v-model="newStoreName"
          type="text"
          class="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          placeholder="Ex.: Filial Centro"
        />
      </label>

      <p v-if="createStoreError" class="text-xs font-semibold text-[#D81B60]">{{ createStoreError }}</p>

      <button
        type="submit"
        :disabled="isCreatingStore || newStoreName.trim().length < 2"
        class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
      >
        {{ isCreatingStore ? 'Criando...' : 'Criar loja' }}
      </button>
    </form>
  </section>
</template>
