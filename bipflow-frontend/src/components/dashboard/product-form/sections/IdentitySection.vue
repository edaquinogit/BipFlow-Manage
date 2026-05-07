<script setup lang="ts">
import { computed, ref } from 'vue';
import { CheckIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import FormInput from '@/components/common/FormInput.vue';

const name = defineModel<string>('name', { default: '' });
const sku = defineModel<string>('sku', { default: '' });
const description = defineModel<string>('description', { default: '' });
const category = defineModel<string | number | null>('category', { default: null });

interface Props {
  categories: Array<{ id: number; name: string }>;
  errors: Record<string, string[]>;
}

const props = defineProps<Props>();

const isCategoryMenuOpen = ref(false);

const selectedCategoryName = computed(() => {
  const selectedCategory = props.categories.find((item) => item.id === Number(category.value));
  return selectedCategory?.name ?? 'Selecionar categoria';
});

const isSelectedCategory = (categoryId: number) => Number(category.value) === categoryId;

const toggleCategoryMenu = () => {
  if (!props.categories.length) {
    return;
  }

  isCategoryMenuOpen.value = !isCategoryMenuOpen.value;
};

const selectCategory = (categoryId: number) => {
  category.value = categoryId;
  isCategoryMenuOpen.value = false;
};

const handleCategoryFocusOut = (event: FocusEvent) => {
  const wrapper = event.currentTarget as HTMLElement;

  requestAnimationFrame(() => {
    if (!wrapper.contains(document.activeElement)) {
      isCategoryMenuOpen.value = false;
    }
  });
};
</script>

<template>
  <section class="space-y-8 border-b border-zinc-800/50 pb-10" @click="isCategoryMenuOpen = false">
    <header>
      <h3 class="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
        Identidade do produto
      </h3>
      <p class="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        Dados que aparecem na vitrine publica
      </p>
    </header>

    <FormInput
      v-model="name"
      label="Nome do produto"
      name="name"
      data-cy="input-product-name"
      placeholder="Ex.: Combo artesanal"
      :error="errors.name?.[0]"
    />

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <FormInput
        v-model="sku"
        label="SKU"
        name="sku"
        data-cy="input-product-sku"
        placeholder="BPF-001"
        :error="errors.sku?.[0]"
      />

      <div class="group flex flex-col">
        <label class="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 transition-colors group-focus-within:text-indigo-400">
          Categoria
        </label>

        <div class="relative" @click.stop @focusout="handleCategoryFocusOut">
          <input type="hidden" name="category" :value="category ?? ''" />
          <button
            type="button"
            data-cy="select-category"
            :aria-expanded="isCategoryMenuOpen"
            aria-haspopup="listbox"
            aria-controls="product-category-menu"
            class="flex h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left text-sm transition-all"
            :class="[
              errors.category
                ? 'border-red-500/50 bg-red-500/5 text-red-100'
                : 'border-white/10 bg-zinc-950/90 text-zinc-100 hover:border-white/20 hover:bg-zinc-900/90',
              isCategoryMenuOpen ? 'border-indigo-500/70 ring-2 ring-indigo-500/10' : ''
            ]"
            @click="toggleCategoryMenu"
          >
            <span class="truncate" :class="{ 'text-zinc-500': !category }">
              {{ categories.length ? selectedCategoryName : 'Nenhuma categoria cadastrada' }}
            </span>
            <ChevronDownIcon
              class="h-4 w-4 shrink-0 text-zinc-500 transition-transform"
              :class="{ 'rotate-180 text-indigo-400': isCategoryMenuOpen }"
            />
          </button>

          <Transition name="category-popover">
            <div
              v-if="isCategoryMenuOpen"
              id="product-category-menu"
              role="listbox"
              class="category-menu-scroll absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              <button
                v-for="item in categories"
                :key="item.id"
                type="button"
                role="option"
                :aria-selected="isSelectedCategory(item.id)"
                :data-cy="`category-option-${item.id}`"
                class="flex h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-xs font-semibold text-zinc-200 transition hover:bg-white/5 hover:text-white"
                :class="{ 'bg-indigo-500/15 text-white': isSelectedCategory(item.id) }"
                @click="selectCategory(item.id)"
              >
                <span class="truncate">{{ item.name }}</span>
                <CheckIcon v-if="isSelectedCategory(item.id)" class="h-4 w-4 shrink-0 text-indigo-300" />
              </button>
            </div>
          </Transition>
        </div>

        <p v-if="errors.category" class="mt-2 text-[9px] font-black uppercase tracking-widest text-red-500">
          {{ errors.category[0] }}
        </p>
      </div>
    </div>

    <div class="group flex flex-col gap-2">
      <label class="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 transition-colors group-focus-within:text-indigo-400">
        Descricao publica
      </label>
      <textarea
        v-model="description"
        name="description"
        data-cy="input-product-description"
        rows="4"
        class="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 shadow-inner outline-none transition-all placeholder:text-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
        placeholder="Descreva o produto para a vitrine: ingredientes, materiais, diferenciais ou forma de uso."
      />
      <p v-if="errors.description" class="text-[9px] font-black uppercase tracking-widest text-red-500">
        {{ errors.description[0] }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.category-popover-enter-active,
.category-popover-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.category-popover-enter-from,
.category-popover-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.category-menu-scroll::-webkit-scrollbar {
  width: 4px;
}

.category-menu-scroll::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 999px;
}
</style>
