<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { ProductFormSchema, type Product, type ProductFormData } from '@/schemas/product.schema';
import IdentitySection from '@/components/dashboard/product-form/sections/IdentitySection.vue';
import ValuationSection from '@/components/dashboard/product-form/sections/ValuationSection.vue';
import MediaSection from '@/components/dashboard/product-form/sections/MediaSection.vue';

interface Props {
  isOpen: boolean;
  initialData?: Product | null;
  categories: Array<{ id: number; name: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  initialData: null,
  categories: () => [],
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: ProductFormData): void;
}>();

const isSubmitting = ref(false);
const errors = ref<Record<string, string[]>>({});

type ProductFormState = {
  name: string;
  price: number;
  stock_quantity: number;
  category: ProductFormData['category'] | null | undefined;
  sku: string;
  size: string;
  image: ProductFormData['image'];
  images: ProductFormData['images'];
  description: string;
  is_available?: boolean;
};

const createEmptyForm = (): ProductFormState => ({
  name: '',
  price: 0,
  stock_quantity: 0,
  category: undefined,
  sku: '',
  size: '',
  image: null,
  images: [],
  description: '',
});

const toNumberOrZero = (value: unknown): number => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const resolveCategoryId = (
  category: Product['category']
): ProductFormState['category'] => {
  if (!category) {
    return undefined;
  }

  if (typeof category === 'object' && 'id' in category) {
    return category.id;
  }

  return category;
};

const normalizeInitialFormData = (
  product: Product | null | undefined
): ProductFormState => {
  if (!product) {
    return createEmptyForm();
  }

  const coverImage = typeof product.image === 'string' ? product.image : null;
  const productImages = Array.isArray(product.images) ? product.images : [];
  const galleryImages = coverImage
    ? productImages.filter((imageUrl) => imageUrl !== coverImage)
    : productImages;

  return {
    name: product.name ?? '',
    price: toNumberOrZero(product.price),
    stock_quantity: Math.trunc(toNumberOrZero(product.stock_quantity)),
    category: resolveCategoryId(product.category),
    sku: product.sku ?? '',
    size: product.size ?? '',
    image: product.image ?? null,
    images: galleryImages.slice(0, 2),
    description: product.description ?? '',
    is_available: product.is_available ?? true,
  };
};

const form = ref<ProductFormState>(createEmptyForm());

watch(() => props.isOpen, (isVisible) => {
  if (isVisible) {
    form.value = normalizeInitialFormData(props.initialData);
    errors.value = {};
  }
}, { immediate: true });

const handleSubmit = async () => {
  isSubmitting.value = true;
  errors.value = {};

  await new Promise((resolve) => setTimeout(resolve, 50));

  const result = ProductFormSchema.safeParse(form.value);

  if (!result.success) {
    errors.value = result.error.flatten().fieldErrors as Record<string, string[]>;
    isSubmitting.value = false;
    return;
  }

  try {
    emit('save', result.data);
  } finally {
    isSubmitting.value = false;
  }
};

const title = computed(() => props.initialData ? 'Editar produto' : 'Novo produto');
const subtitle = computed(() => (
  props.initialData ? 'Atualize os dados da vitrine' : 'Cadastre um item para venda'
));
const submitLabel = computed(() => {
  if (isSubmitting.value) {
    return 'Salvando...';
  }

  return props.initialData ? 'Salvar alteracoes' : 'Criar produto';
});
</script>

<template>
  <Transition name="slide">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex justify-end">
      <div
        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
        @click="emit('close')"
      />

      <aside
        class="relative flex w-full max-w-xl flex-col overflow-hidden border-l border-white/10 bg-zinc-950/95 p-6 shadow-2xl shadow-black/40 sm:p-8"
        data-cy="product-form-panel"
      >
        <header class="mb-9 flex shrink-0 items-start justify-between gap-6">
          <div>
            <h2 class="text-2xl font-semibold leading-none tracking-normal text-white">
              {{ title }}
            </h2>
            <p class="mt-2 text-sm text-zinc-500">
              {{ subtitle }}
            </p>
          </div>

          <button
            type="button"
            data-cy="btn-close-form"
            aria-label="Fechar formulario de produto"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
            @click="emit('close')"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </header>

        <form
          id="product-registry-form"
          class="custom-scrollbar flex-1 space-y-12 overflow-y-auto pr-2"
          @submit.prevent="handleSubmit"
        >
          <IdentitySection
            v-model:name="form.name"
            v-model:sku="form.sku"
            v-model:description="form.description"
            v-model:category="form.category"
            :categories="categories"
            :errors="errors"
          />

          <ValuationSection
            v-model:price.number="form.price"
            v-model:stock="form.stock_quantity"
            v-model:size="form.size"
            :errors="errors"
          />

          <MediaSection
            v-model:cover-image="form.image"
            v-model:gallery-images="form.images"
            :error="errors.image?.[0] || errors.images?.[0] || errors.uploaded_images?.[0]"
          />
        </form>

        <footer class="mt-8 shrink-0 border-t border-white/10 pt-5">
          <button
            form="product-registry-form"
            type="submit"
            data-cy="btn-submit-product"
            :disabled="isSubmitting"
            class="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white px-5 text-sm font-semibold text-black shadow-xl shadow-white/5 transition-all hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span v-if="isSubmitting" class="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            <CheckIcon v-else class="h-4 w-4" />
            <span>{{ submitLabel }}</span>
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #27272a;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #3f3f46;
}
</style>
